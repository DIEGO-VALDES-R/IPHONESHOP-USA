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
  processSale: (saleData: {
    customer: string;
    customerDoc?: string;
    customerEmail?: string;
    customerPhone?: string;
    items: any[];
    total: number;
    subtotal: number;
    taxAmount: number;
    applyIva?: boolean;
  }) => Promise<Sale>;
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

  // ── BOOTSTRAP ────────────────────────────────────────────────────────────
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

  // ── LOADERS ──────────────────────────────────────────────────────────────
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
    const [{ data: openSession }, { data: history }] = await Promise.all([
      supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('company_id', cid)
        .eq('status', 'OPEN')
        .maybeSingle(),
      supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('company_id', cid)
        .eq('status', 'CLOSED')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setSession(openSession as any || null);
    setSessionsHistory((history || []) as any);
  };

  const refreshProducts = useCallback(async () => {
    if (companyId) await loadProducts(companyId);
  }, [companyId]);

  // ── PRODUCTS ─────────────────────────────────────────────────────────────
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

  // ── REPAIRS ──────────────────────────────────────────────────────────────
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

  // ── SALES ─────────────────────────────────────────────────────────────────
  const processSale = async (saleData: {
    customer: string;
    customerDoc?: string;
    customerEmail?: string;
    customerPhone?: string;
    items: any[];
    total: number;
    subtotal: number;   // ← AHORA VIENE CALCULADO DESDE EL POS
    taxAmount: number;  // ← AHORA VIENE CALCULADO DESDE EL POS
    applyIva?: boolean;
  }): Promise<Sale> => {
    if (!companyId || !branchId) throw new Error('No company/branch');

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const invoiceNumber = `POS-${timestamp}${random}`;

    // CORRECCIÓN PRINCIPAL: usar los valores YA calculados en el POS
    // en vez de recalcular aquí con 1.19 fijo
    const subtotal = Math.round(saleData.subtotal);
    const taxAmount = Math.round(saleData.taxAmount);

    const { data: invoice, error: invErr } = await supabase
      .from('invoices').insert({
        company_id: companyId,
        branch_id: branchId,
        invoice_number: invoiceNumber,
        customer_id: null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: saleData.total,
        status: 'PENDING_ELECTRONIC',
        payment_method: { method: 'CASH', amount: saleData.total }
      }).select().single();

    if (invErr) throw invErr;

    // CORRECCIÓN: usar ?? en vez de || para que tax_rate 0 sea válido
    const invoiceItems = saleData.items.map((i: any) => ({
      invoice_id: invoice.id,
      product_id: i.product.id,
      quantity: i.quantity,
      price: i.product.price,
      tax_rate: i.product.tax_rate ?? 0,
    }));
    await supabase.from('invoice_items').insert(invoiceItems);

    // ── DESCONTAR STOCK ──
    for (const i of saleData.items) {
      if (i.product.type === 'SERVICE') continue;

      const { data: currentProduct, error: fetchErr } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', i.product.id)
        .single();

      if (fetchErr || !currentProduct) {
        console.warn(`No se pudo obtener stock del producto ${i.product.id}`);
        continue;
      }

      const currentStock = currentProduct.stock_quantity ?? 0;
      const newStock = Math.max(0, currentStock - i.quantity);

      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', i.product.id);

      if (updateErr) {
        console.error(`Error al descontar stock de ${i.product.name}:`, updateErr);
      }
    }

    // ── ACTUALIZAR TOTALES DE SESIÓN DE CAJA ──
    if (session?.id) {
      const newTotal = (session.total_sales_cash || 0) + saleData.total;
      await supabase
        .from('cash_register_sessions')
        .update({ total_sales_cash: newTotal })
        .eq('id', session.id);
    }

    await Promise.all([
      loadProducts(companyId),
      loadSales(companyId),
      loadSession(companyId),
    ]);

    toast.success('Venta guardada correctamente');

    // CORRECCIÓN: pasar subtotal y tax_amount reales al modal
    const saleWithItems = {
      ...invoice,
      subtotal,
      tax_amount: taxAmount,
      customer_name: saleData.customer,
      customer_document: saleData.customerDoc,
      customer_email: saleData.customerEmail,
      customer_phone: saleData.customerPhone,
      _cartItems: saleData.items.map((i: any) => ({
        product_name: i.product?.name || i.name || 'Producto',
        quantity: i.quantity,
        price: i.product?.price ?? i.price,
        tax_rate: i.product?.tax_rate ?? i.tax_rate ?? 0,
        serial_number: i.serial_number,
      })),
    };
    return saleWithItems as any;
  };

  // ── COMPANY ──────────────────────────────────────────────────────────────
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

  // ── SESSION ──────────────────────────────────────────────────────────────
  const openSession = async (amount: number) => {
    if (!companyId) return;

    let registerId: string | null = null;
    const { data: register } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .single();

    if (register) {
      registerId = register.id;
    } else {
      const { data: newReg, error: regErr } = await supabase
        .from('cash_registers')
        .insert({ company_id: companyId, branch_id: branchId, name: 'Caja Principal', status: 'CLOSED' })
        .select().single();
      if (regErr || !newReg) { toast.error('No se pudo crear la caja'); return; }
      registerId = newReg.id;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data, error } = await supabase.from('cash_register_sessions').insert({
      company_id: companyId,
      register_id: registerId,
      user_id: userId,
      start_cash: amount,
      start_time: new Date().toISOString(),
      total_sales_cash: 0,
      total_sales_card: 0,
      status: 'OPEN'
    }).select().single();

    if (error) { console.error('openSession error:', error); toast.error(error.message); return; }
    setSession(data as any);
    toast.success('Caja abierta');
  };

  const closeSession = async (endAmount: number) => {
    if (!session?.id || !companyId) return;

    const { data: currentSession } = await supabase
      .from('cash_register_sessions')
      .select('start_cash, total_sales_cash')
      .eq('id', session.id)
      .single();

    const startCash = currentSession?.start_cash ?? session.start_cash;
    const totalSales = currentSession?.total_sales_cash ?? session.total_sales_cash ?? 0;
    const expectedCash = startCash + totalSales;
    const diff = endAmount - expectedCash;

    const { error } = await supabase
      .from('cash_register_sessions')
      .update({
        status: 'CLOSED',
        end_time: new Date().toISOString(),
        end_cash: endAmount,
        difference: diff,
      })
      .eq('id', session.id)
      .eq('company_id', companyId);

    if (error) { console.error('closeSession error:', error); toast.error(error.message); return; }
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