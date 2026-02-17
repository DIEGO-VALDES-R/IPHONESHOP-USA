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
    items: any[], total: number, applyIva?: boolean }): Promise<Sale> => {
    if (!companyId || !branchId) throw new Error('No company/branch');

    // Get next invoice number
    const { count } = await supabase
      .from('invoices').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);
    const invoiceNumber = `POS-${String((count || 0) + 1).padStart(6, '0')}`;

    const useIva = saleData.applyIva !== false;
    const subtotal = useIva ? saleData.total / 1.19 : saleData.total;
    const taxAmount = useIva ? saleData.total - subtotal : 0;

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
    // Adjuntar items del carrito al objeto retornado para el InvoiceModal
    const saleWithItems = {
      ...invoice,
      customer_name: saleData.customer,
      customer_document: saleData.customerDoc,
      customer_email: saleData.customerEmail,
      customer_phone: saleData.customerPhone,
      _cartItems: saleData.items.map((i: any) => ({
        product_name: i.product?.name || i.name || 'Producto',
        quantity: i.quantity,
        price: i.product?.price ?? i.price,
        tax_rate: i.product?.tax_rate ?? i.tax_rate ?? 19,
        serial_number: i.serial_number,
      })),
    };
    return saleWithItems as any;
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


