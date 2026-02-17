import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, ProductType, Sale, RepairOrder, Customer, SaleStatus, RepairStatus, CashRegisterSession, Company, DianSettings, DianEnvironment } from '../types';
import { MOCK_PRODUCTS, MOCK_REPAIRS, MOCK_SESSION, MOCK_SALES_HISTORY } from '../services/mockData';
import { toast } from 'react-hot-toast';

// Initial state for the "Database"
interface DatabaseState {
  company: Company;
  products: Product[];
  repairs: RepairOrder[];
  sales: Sale[];
  customers: Customer[];
  session: CashRegisterSession | null;
  sessionsHistory: CashRegisterSession[];
}

interface DatabaseContextType extends DatabaseState {
  // Actions
  addProduct: (product: Omit<Product, 'id' | 'company_id'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  addRepair: (repair: Omit<RepairOrder, 'id'>) => void;
  updateRepairStatus: (id: string, status: RepairStatus) => void;
  
  processSale: (saleData: { customer: string, customerDoc?: string, customerEmail?: string, customerPhone?: string, items: any[], total: number }) => Promise<Sale>;
  
  updateCompanyConfig: (data: Partial<Company>) => void;
  saveDianSettings: (settings: DianSettings) => void;
  
  openSession: (amount: number) => void;
  closeSession: (endAmount: number) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- STATE INITIALIZATION ---
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [repairs, setRepairs] = useState<RepairOrder[]>(MOCK_REPAIRS as RepairOrder[]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [session, setSession] = useState<CashRegisterSession | null>(MOCK_SESSION);
  
  // Initialize with some dummy history for the demo
  const [sessionsHistory, setSessionsHistory] = useState<CashRegisterSession[]>([
    {
        id: 'sess_old_1',
        status: 'CLOSED',
        start_time: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        end_time: new Date(Date.now() - 86400000 + 28800000).toISOString(),
        start_cash: 500000,
        end_cash: 1240000,
        total_sales_cash: 740000,
        total_sales_card: 500000,
        difference: 0
    }
  ]);
  
  const [company, setCompany] = useState<Company>({
    id: 'comp_1',
    name: 'IPHONESHOP USA S.A.S.',
    nit: '900.123.456-7',
    address: 'Calle 123 # 45-67, Bogotá D.C.',
    phone: '+57 300 123 4567',
    email: 'facturacion@iphoneshop.com',
    subscription_plan: 'PRO',
    subscription_status: 'ACTIVE',
    logo_url: undefined, 
    config: {
      tax_rate: 19,
      currency_symbol: '$',
      invoice_prefix: 'SETT',
      dian_resolution: '18760000001234',
      dian_date: '2024-01-01',
      dian_range_from: '1000',
      dian_range_to: '50000'
    },
    dian_settings: {
        company_id: 'comp_1',
        software_id: '',
        software_pin: '',
        resolution_number: '',
        prefix: 'SETT',
        current_number: 1000,
        range_from: 1000,
        range_to: 50000,
        technical_key: '',
        environment: DianEnvironment.TEST,
        is_active: false
    }
  });

  const [customers, setCustomers] = useState<Customer[]>([
    { id: 'c1', name: 'Consumidor Final', document_number: '222222222222' },
    { id: 'c2', name: 'Juan Perez', document_number: '10101010', email: 'juan@gmail.com' }
  ]);

  // --- ACTIONS ---

  // Products
  const addProduct = (data: Omit<Product, 'id' | 'company_id'>) => {
    const newProduct: Product = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      company_id: company.id
    };
    setProducts(prev => [newProduct, ...prev]);
    toast.success("Producto creado correctamente");
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    toast.success("Producto actualizado");
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success("Producto eliminado");
  };

  // Repairs
  const addRepair = (data: Omit<RepairOrder, 'id'>) => {
    const newRepair: RepairOrder = {
      ...data,
      id: 'REP-' + Math.floor(Math.random() * 10000),
      created_at: new Date().toISOString()
    };
    setRepairs(prev => [newRepair, ...prev]);
    toast.success("Orden de reparación creada");
  };

  const updateRepairStatus = (id: string, status: RepairStatus) => {
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    toast.success(`Estado actualizado a ${status}`);
  };

  // Sales & DIAN Logic
  const processSale = async (saleData: { customer: string, customerDoc?: string, customerEmail?: string, customerPhone?: string, items: any[], total: number }): Promise<Sale> => {
    
    // 1. Initial State: PENDING_ELECTRONIC (Local sale completed)
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      invoice_number: `${company.config?.invoice_prefix}-${sales.length + 1001}`,
      customer_name: saleData.customer,
      customer_document: saleData.customerDoc || '222222222222',
      customer_email: saleData.customerEmail,
      customer_phone: saleData.customerPhone,
      total_amount: saleData.total,
      status: SaleStatus.PENDING_ELECTRONIC, 
      created_at: new Date().toISOString(),
      items: saleData.items,
    };

    setSales(prev => [newSale, ...prev]);

    // 2. Update Inventory
    setProducts(prev => prev.map(p => {
      const soldItem = saleData.items.find((i: any) => i.product.id === p.id);
      if (soldItem) {
        return { ...p, stock_quantity: Math.max(0, p.stock_quantity - soldItem.quantity) };
      }
      return p;
    }));

    // 3. Update Session
    if (session) {
        setSession({
            ...session,
            total_sales_cash: session.total_sales_cash + saleData.total
        });
    }
    
    // 4. Async DIAN Process Simulation (Queue)
    if (company.dian_settings?.is_active) {
        setTimeout(() => {
            simulateDianSubmission(newSale.id);
        }, 3000); // 3 seconds delay to simulate network/queue
        toast.loading("Enviando a DIAN...", { duration: 2000 });
    } else {
        toast.success("Venta Local Guardada");
    }

    return newSale;
  };

  const simulateDianSubmission = (saleId: string) => {
      // Logic to simulate NestJS Background Job
      setSales(prevSales => prevSales.map(sale => {
          if (sale.id === saleId) {
              const fakeCUFE = "0f5c" + Math.random().toString(16).substr(2, 36) + "a1b2";
              return {
                  ...sale,
                  status: SaleStatus.ACCEPTED,
                  dian_cufe: fakeCUFE,
                  dian_qr_data: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${fakeCUFE}`,
                  electronic_doc: {
                      id: 'edoc_' + Math.random().toString(36),
                      company_id: company.id,
                      sale_id: sale.id,
                      cufe: fakeCUFE,
                      qr_data: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${fakeCUFE}`,
                      status: SaleStatus.ACCEPTED,
                      dian_response: '{"Response": "Processed Successfully", "Code": "00"}',
                      sent_at: new Date().toISOString(),
                      validated_at: new Date().toISOString()
                  }
              };
          }
          return sale;
      }));
      toast.success("Factura Aceptada por DIAN", { duration: 4000, icon: '🏛️' });
  };

  // Company & DIAN Settings
  const updateCompanyConfig = (data: Partial<Company>) => {
    setCompany(prev => ({ ...prev, ...data }));
    toast.success("Configuración guardada");
  };

  const saveDianSettings = (settings: DianSettings) => {
      setCompany(prev => ({
          ...prev,
          dian_settings: settings
      }));
      toast.success("Configuración de Facturación Electrónica guardada");
  };

  // Session
  const openSession = (amount: number) => {
    setSession({
      id: Math.random().toString(),
      status: 'OPEN',
      start_cash: amount,
      start_time: new Date().toISOString(),
      total_sales_cash: 0,
      total_sales_card: 0
    });
    toast.success("Caja abierta");
  };

  const closeSession = (endAmount: number) => {
    if (session) {
      // Calculate Difference
      const expectedCash = session.start_cash + session.total_sales_cash;
      const difference = endAmount - expectedCash;
      
      const closedSession: CashRegisterSession = { 
        ...session, 
        status: 'CLOSED',
        end_time: new Date().toISOString(),
        end_cash: endAmount,
        difference: difference
      };

      setSession(closedSession);
      // Add to history (newest first)
      setSessionsHistory(prev => [closedSession, ...prev]);
      
      toast.success("Turno cerrado correctamente");
    }
  };

  return (
    <DatabaseContext.Provider value={{
      products, repairs, sales, session, company, customers, sessionsHistory,
      addProduct, updateProduct, deleteProduct,
      addRepair, updateRepairStatus,
      processSale,
      updateCompanyConfig,
      saveDianSettings,
      openSession, closeSession
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error("useDatabase must be used within DatabaseProvider");
  return context;
};