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
  userRole: string | null;
  availableCompanies: Company[];
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
  switchCompany: (cid: string) => Promise<void>;
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, branch_id, role')
        .eq('id', user.id)
        .single();

      if (!profile) { setIsLoading(false); return; }

      setUserRole(profile.role);

      if (profile.role === 'MASTER') {
        // Cargar lista de empresas para el selector del sidebar
        const { data: companies } = await supabase
          .from('companies').select('id, name, logo_url, nit, subscription_plan, subscription_status').order('name');
        setAvailableCompanies(companies || []);

        // Si el MASTER seleccionó empresa en el login, cargar sus datos
        const savedCompany = localStorage.getItem('master_selected_company');
        if (savedCompany) {
          setCompanyId(savedCompany);
          const { data: branches } = await supabase
            .from('branches').select('id').eq('company_id', savedCompany).limit(1);
          setBranchId(branches && branches.length > 0 ? branches[0].id : null);
          await loadAllData(savedCompany);
        } else {
          setIsLoading(false);
        }
        return;
      }

      // Usuario normal
      if (profile.company_id) {
        setCompanyId(profile.company_id);
        setBranchId(profile.branch_id);
        await loadAllData(profile.company_id);
      }

      setIsLoading(false);
    };
    init();
  }, []);

  const loadAllData = async (cid: string) => {
    setIsLoading(true);
    await loadCompany(cid);
    await Promise.all([
      loadProducts(cid),
      loadSales(cid),
      loadSession(cid),
      loadRepairs(cid),
      loadCustomers(cid),
    ]);
    setIsLoading(false);
  };

  const switchCompany = async (cid: string) => {
    if (userRole !== 'MASTER') return;
    setIsLoading(true);
    setCompanyId(cid);
    setProducts([]); setSales([]); setRepairs([]); setCustomers([]); setSession(null);
    localStorage.setItem('master_selected_company', cid);
    const { data: branches } = await supabase
      .from('branches').select('id').eq('company_id', cid).limit(1);
    setBranchId(branches && branches.length > 0 ? branches[0].id : null);
    await loadAllData(cid);
    toast.success('Empresa seleccionada');
  };

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
      .eq('company_id', cid).order('created_at', { ascending: false }).limit(50);
    setRepairs((data || []) as any);
  };

  const loadSales = async (cid: string) => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, subtotal, tax_amount, status, payment_method, created_at, customer_id')
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
      supabase.from('cash_register_sessions').select('*')
        .eq('company_id', cid).eq('status', 'OPEN').maybeSingle(),
      supabase.from('cash_register_sessions').select('*')
        .eq('company_id', cid).eq('status', 'CLOSED')
        .order('created_at', { ascending: false }).limit(20),
    ]);
    setSession(openSession as any || null);
    setSessionsHistory((history || []) as any);
  };

  const refreshProducts = useCallback(async () => {
    if (companyId) await loadProducts(companyId);
  }, [companyId]);

  const addProduct = async (data: Omit<Product, 'id' | 'company_id'>) => {
    if (!companyId) return;
    const { error } = await supabase.from('products').insert({ ...data, company_id: companyId, is_active: true });
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

  const addRepair = async (data: Omit<RepairOrder, 'id'>) => {
    if (!companyId) return;
    const { error } = await supabase.from('repair_orders').insert({
      ...data, company_id: companyId, branch_id: branchId, updated_at: new Date().toISOString()
    });
    if (error) { toast.error(error.message); return; }
    await loadRepairs(companyId);
    toast.success('Orden de reparacion creada');
  };

  const updateRepairStatus = async (id: string, status: RepairStatus) => {
    const { error } = await supabase.from('repair_orders')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (companyId) await loadRepairs(companyId);
    toast.success(`Estado actualizado a ${status}`);
  };

  const processSale = async (saleData: {
    customer: string;
    customerDoc?: string;
    customerEmail?: string;
    customerPhone?: string;
    items: any[];
    total: number;
    subtotal: number;
    taxAmount: number;
    applyIva?: boolean;
  }): Promise<Sale> => {
    if (!companyId || !branchId) throw new Error('No company/branch');

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const invoiceNumber = `POS-${timestamp}${random}`;
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
        payment_method: {
          method: 'CASH',
          amount: saleData.total,
          customer_name:     saleData.customer     || null,
          customer_document: saleData.customerDoc  || null,
          customer_email:    saleData.customerEmail || null,
          customer_phone:    saleData.customerPhone || null,
        }
      }).select().single();

    if (invErr) throw invErr;

    const invoiceItems = saleData.items.map((i: any) => ({
      invoice_id: invoice.id,
      product_id: i.product.id,
      quantity: i.quantity,
      price: i.product.price,
      tax_rate: i.product.tax_rate ?? 0,
    }));
    await supabase.from('invoice_items').insert(invoiceItems);

    await Promise.all(saleData.items
      .filter((i: any) => i.product.type !== 'SERVICE')
      .map(async (i: any) => {
        const { data: cur } = await supabase
          .from('products').select('stock_quantity').eq('id', i.product.id).single();
        if (!cur) return;
        await supabase.from('products')
          .update({ stock_quantity: Math.max(0, (cur.stock_quantity ?? 0) - i.quantity) })
          .eq('id', i.product.id);
      })
    );

    if (session?.id) {
      await supabase.from('cash_register_sessions')
        .update({ total_sales_cash: (session.total_sales_cash || 0) + saleData.total })
        .eq('id', session.id);
    }

    await Promise.all([loadProducts(companyId), loadSales(companyId), loadSession(companyId)]);
    toast.success('Venta guardada correctamente');
    return invoice as any;
  };

  const updateCompanyConfig = async (data: Partial<Company>) => {
    if (!companyId) return;
    const { error } = await supabase.from('companies').update(data).eq('id', companyId);
    if (error) { toast.error(error.message); return; }
    await loadCompany(companyId);
    toast.success('Configuracion actualizada');
  };

  const saveDianSettings = (settings: DianSettings) => {
    toast.success('Ajustes DIAN guardados (simulado)');
  };

  const openSession = async (amount: number) => {
    if (!companyId || !branchId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('cash_register_sessions').insert({
      company_id: companyId,
      register_id: '00000000-0000-0000-0000-000000000000',
      user_id: user.id,
      start_cash: amount,
      status: 'OPEN'
    });
    if (error) { toast.error(error.message); return; }
    await loadSession(companyId);
    toast.success('Caja abierta');
  };

  const closeSession = async (endAmount: number) => {
    if (!session) return;
    const { error } = await supabase.from('cash_register_sessions').update({
      end_cash: endAmount,
      end_time: new Date().toISOString(),
      status: 'CLOSED'
    }).eq('id', session.id);
    if (error) { toast.error(error.message); return; }
    await loadSession(companyId);
    toast.success('Caja cerrada');
  };

  return (
    <DatabaseContext.Provider value={{
      company, companyId, branchId, products, repairs, sales, customers, session, sessionsHistory, isLoading,
      userRole, availableCompanies,
      addProduct, updateProduct, deleteProduct, addRepair, updateRepairStatus, processSale,
      updateCompanyConfig, saveDianSettings, openSession, closeSession, refreshProducts, switchCompany
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) throw new Error('useDatabase must be used within a DatabaseProvider');
  return context;
};
