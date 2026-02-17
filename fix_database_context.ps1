# =====================================================
# IPHONESHOP USA - Reemplazar DatabaseContext + Dashboard
# Ejecutar desde: D:\MIS APP\IPHONESHOP-USA-main
# .\fix_database_context.ps1
# =====================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reemplazando DatabaseContext.tsx      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ─────────────────────────────────────────
# contexts/DatabaseContext.tsx
# ─────────────────────────────────────────
$databaseContext = @'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, ProductType, Sale, RepairOrder, Customer, SaleStatus, RepairStatus, CashRegisterSession, Company, DianSettings, DianEnvironment } from '../types';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';

interface DatabaseState {
  company: Company | null;
  companyId: string | null;
  branchId: string | null;
  products: Product[];
  repairs: RepairOrder[];
  sales: Sale[];
  customers: Customer[];
  session: CashRegisterSession | null;
  sessionsHistory: CashRegisterSession[];
  isLoading: boolean;
}

interface DatabaseContextType extends DatabaseState {
  addProduct: (product: Omit<Product, 'id' | 'company_id'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addRepair: (repair: Omit<RepairOrder, 'id'>) => Promise<void>;
  updateRepairStatus: (id: string, status: RepairStatus) => Promise<void>;
  processSale: (saleData: { customer: string, customerDoc?: string, customerEmail?: string, customerPhone?: string, items: any[], total: number }) => Promise<Sale>;
  updateCompanyConfig: (data: Partial<Company>) => Promise<void>;
  saveDianSettings: (settings: DianSettings) => void;
  openSession: (amount: number) => Promise<void>;
  closeSession: (endAmount: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [sessionsHistory, setSessionsHistory] = useState<CashRegisterSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── BOOTSTRAP: get user profile → company ──────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, branch_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) { setIsLoading(false); return; }

      setCompanyId(profile.company_id);
      setBranchId(profile.branch_id);

      await Promise.all([
        loadCompany(profile.company_id),
        loadProducts(profile.company_id),
        loadRepairs(profile.company_id),
        loadSales(profile.company_id),
        loadCustomers(profile.company_id),
        loadSession(profile.company_id),
      ]);

      setIsLoading(false);
    };
    init();
  }, []);

  // ── LOADERS ─────────────────────────────────────────────────────────────
  const loadCompany = async (cid: string) => {
    const { data } = await supabase.from('companies').select('*').eq('id', cid).single();
    if (data) setCompany(data as any);
  };

  const loadProducts = async (cid: string) => {
    const { data } = await supabase
      .from('products').select('*')
      .eq('company_id', cid).eq('is_active', true).order('name');
    setProducts((data || []) as any);
  };

  const loadRepairs = async (cid: string) => {
    const { data } = await supabase
      .from('repair_orders').select('*')
      .eq('company_id', cid).order('created_at', { ascending: false });
    setRepairs((data || []) as any);
  };

  const loadSales = async (cid: string) => {
    const { data } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('company_id', cid).order('created_at', { ascending: false }).limit(50);
    setSales((data || []) as any);
  };

  const loadCustomers = async (cid: string) => {
    const { data } = await supabase
      .from('customers').select('*').eq('company_id', cid).order('name');
    setCustomers((data || []) as any);
  };

  const loadSession = async (cid: string) => {
    const { data } = await supabase
      .from('cash_register_sessions').select('*')
      .eq('company_id', cid).eq('status', 'OPEN').single();
    setSession(data as any || null);

    const { data: history } = await supabase
      .from('cash_register_sessions').select('*')
      .eq('company_id', cid).eq('status', 'CLOSED')
      .order('end_time', { ascending: false }).limit(10);
    setSessionsHistory((history || []) as any);
  };

  const refreshProducts = useCallback(async () => {
    if (companyId) await loadProducts(companyId);
  }, [companyId]);

  // ── PRODUCTS ────────────────────────────────────────────────────────────
  const addProduct = async (data: Omit<Product, 'id' | 'company_id'>) => {
    if (!companyId) return;
    const { error } = await supabase.from('products').insert({
      ...data, company_id: companyId, is_active: true
    });
    if (error) { toast.error(error.message); return; }
    await loadProducts(companyId);
    toast.success('Producto creado correctamente');
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const { error } = await supabase.from('products').update(data).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (companyId) await loadProducts(companyId);
    toast.success('Producto actualizado');
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (companyId) await loadProducts(companyId);
    toast.success('Producto eliminado');
  };

  // ── REPAIRS ─────────────────────────────────────────────────────────────
  const addRepair = async (data: Omit<RepairOrder, 'id'>) => {
    if (!companyId) return;
    const { error } = await supabase.from('repair_orders').insert({
      ...data,
      company_id: companyId,
      branch_id: branchId,
      updated_at: new Date().toISOString()
    });
    if (error) { toast.error(error.message); return; }
    await loadRepairs(companyId);
    toast.success('Orden de reparación creada');
  };

  const updateRepairStatus = async (id: string, status: RepairStatus) => {
    const { error } = await supabase.from('repair_orders')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (companyId) await loadRepairs(companyId);
    toast.success(`Estado actualizado a ${status}`);
  };

  // ── SALES ───────────────────────────────────────────────────────────────
  const processSale = async (saleData: {
    customer: string, customerDoc?: string,
    customerEmail?: string, customerPhone?: string,
    items: any[], total: number
  }): Promise<Sale> => {
    if (!companyId || !branchId) throw new Error('No company/branch');

    // Get next invoice number
    const { count } = await supabase
      .from('invoices').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);
    const invoiceNumber = `POS-${String((count || 0) + 1).padStart(6, '0')}`;

    const subtotal = saleData.total / 1.19;
    const taxAmount = saleData.total - subtotal;

    // Create invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices').insert({
        company_id: companyId,
        branch_id: branchId,
        invoice_number: invoiceNumber,
        customer_id: null,
        subtotal: Math.round(subtotal),
        tax_amount: Math.round(taxAmount),
        total_amount: saleData.total,
        status: 'PENDING_ELECTRONIC',
        payment_method: { method: 'CASH', amount: saleData.total }
      }).select().single();

    if (invErr) throw invErr;

    // Create invoice items
    const items = saleData.items.map((i: any) => ({
      invoice_id: invoice.id,
      product_id: i.product.id,
      quantity: i.quantity,
      price: i.product.price,
      tax_rate: i.product.tax_rate || 19,
    }));
    await supabase.from('invoice_items').insert(items);

    // Decrement stock
    for (const i of saleData.items) {
      const { data: p } = await supabase
        .from('products').select('stock_quantity').eq('id', i.product.id).single();
      if (p) {
        await supabase.from('products')
          .update({ stock_quantity: Math.max(0, p.stock_quantity - i.quantity) })
          .eq('id', i.product.id);
      }
    }

    // Update session totals
    if (session?.id) {
      await supabase.from('cash_register_sessions')
        .update({ total_sales_cash: (session.total_sales_cash || 0) + saleData.total })
        .eq('id', session.id);
    }

    await loadSales(companyId);
    await loadProducts(companyId);

    toast.success('Venta guardada en Supabase');
    return invoice as any;
  };

  // ── COMPANY ─────────────────────────────────────────────────────────────
  const updateCompanyConfig = async (data: Partial<Company>) => {
    if (!companyId) return;
    const { error } = await supabase.from('companies').update(data).eq('id', companyId);
    if (error) { toast.error(error.message); return; }
    await loadCompany(companyId);
    toast.success('Configuración guardada');
  };

  const saveDianSettings = (settings: DianSettings) => {
    setCompany(prev => prev ? { ...prev, dian_settings: settings } : prev);
    toast.success('Configuración DIAN guardada (local)');
  };

  // ── SESSION ─────────────────────────────────────────────────────────────
  const openSession = async (amount: number) => {
    if (!companyId) return;
    const { data, error } = await supabase.from('cash_register_sessions').insert({
      company_id: companyId,
      branch_id: branchId,
      start_cash: amount,
      start_time: new Date().toISOString(),
      total_sales_cash: 0,
      total_sales_card: 0,
      status: 'OPEN'
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setSession(data as any);
    toast.success('Caja abierta');
  };

  const closeSession = async (endAmount: number) => {
    if (!session?.id || !companyId) return;
    const expectedCash = session.start_cash + (session.total_sales_cash || 0);
    const difference = endAmount - expectedCash;
    const { error } = await supabase.from('cash_register_sessions').update({
      status: 'CLOSED',
      end_time: new Date().toISOString(),
      end_cash: endAmount,
      difference
    }).eq('id', session.id);
    if (error) { toast.error(error.message); return; }
    await loadSession(companyId);
    toast.success('Turno cerrado correctamente');
  };

  return (
    <DatabaseContext.Provider value={{
      company, companyId, branchId, isLoading,
      products, repairs, sales, customers, session, sessionsHistory,
      addProduct, updateProduct, deleteProduct,
      addRepair, updateRepairStatus,
      processSale,
      updateCompanyConfig, saveDianSettings,
      openSession, closeSession,
      refreshProducts,
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('useDatabase must be used within DatabaseProvider');
  return context;
};
'@
Set-Content -Path "contexts\DatabaseContext.tsx" -Value $databaseContext -Encoding UTF8
Write-Host "[OK] contexts/DatabaseContext.tsx" -ForegroundColor Green

# ─────────────────────────────────────────
# pages/Dashboard.tsx
# ─────────────────────────────────────────
$dashboardPage = @'
import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { DollarSign, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue' }: any) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      <p className="text-slate-400 text-sm mt-4">{subtext}</p>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { products, repairs, sales, isLoading, company } = useDatabase();
  const [salesChart, setSalesChart] = useState<any[]>([]);

  useEffect(() => {
    // Build chart data from real sales
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const grouped: Record<string, number> = {};
    // Initialize all days to 0
    dayNames.forEach(d => grouped[d] = 0);
    sales.forEach((s: any) => {
      const d = dayNames[new Date(s.created_at).getDay()];
      grouped[d] = (grouped[d] || 0) + (s.total_amount || 0);
    });
    setSalesChart(dayNames.map(name => ({ name, sales: grouped[name] })));
  }, [sales]);

  const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
  const inventoryValue = products.reduce((sum, p) => sum + (p.cost * (p.stock_quantity || 0)), 0);
  const activeRepairs = repairs.filter((r: any) =>
    !['DELIVERED', 'CANCELLED'].includes(r.status)
  ).length;
  const urgentRepairs = repairs.filter((r: any) => r.status === 'READY').length;

  const topProducts = [...products]
    .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard General</h2>
          <p className="text-slate-500">{company?.name || 'IPHONESHOP USA'}</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm">
            <option>Esta Semana</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Exportar Reporte
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Totales"
          value={formatMoney(totalSales)}
          subtext={`${sales.length} facturas registradas`}
          icon={DollarSign} color="blue"
        />
        <StatCard
          title="Utilidad Estimada"
          value={formatMoney(totalSales * 0.25)}
          subtext="Margen ~25%"
          icon={TrendingUp} color="green"
        />
        <StatCard
          title="Inventario Valorizado"
          value={formatMoney(inventoryValue)}
          subtext={`${products.length} productos activos`}
          icon={Package} color="purple"
        />
        <StatCard
          title="Reparaciones Activas"
          value={activeRepairs.toString()}
          subtext={`${urgentRepairs} listas para entregar`}
          icon={AlertCircle} color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Ventas por Día (esta semana)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }}
                  tickFormatter={(v) => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}K`} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Top Productos (por margen)</h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin productos aún</p>
            ) : topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-slate-500">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-800 truncate">{p.name}</h4>
                  <p className="text-xs text-slate-400">Stock: {p.stock_quantity ?? 0}</p>
                </div>
                <span className="font-bold text-slate-700 text-sm">{formatMoney(p.price)}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 text-blue-600 text-sm font-medium hover:text-blue-700">
            Ver reporte completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
'@
Set-Content -Path "pages\Dashboard.tsx" -Value $dashboardPage -Encoding UTF8
Write-Host "[OK] pages/Dashboard.tsx" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LISTO - Ahora ejecuta:               " -ForegroundColor Cyan
Write-Host "  git add .                            " -ForegroundColor Yellow
Write-Host "  git commit -m 'fix: real supabase'   " -ForegroundColor Yellow
Write-Host "  git push                             " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
