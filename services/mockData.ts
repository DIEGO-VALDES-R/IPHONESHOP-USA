import { Product, ProductType, Sale, SaleStatus, RepairOrder, RepairStatus, CashRegisterSession } from '../types';

// Precios actualizados a COP (Base 1 USD = 4000 COP aprox para el ejemplo)
export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    company_id: 'c1',
    name: 'iPhone 15 Pro Max',
    sku: 'IP15PM-256-BLK',
    category: 'Smartphones',
    price: 5800000,
    cost: 4500000,
    tax_rate: 19,
    type: ProductType.SERIALIZED,
    description: '256GB Black Titanium',
    stock_quantity: 5
  },
  {
    id: '2',
    company_id: 'c1',
    name: 'MacBook Air M2',
    sku: 'MBA-M2-13',
    category: 'Laptops',
    price: 4500000,
    cost: 3800000,
    tax_rate: 19,
    type: ProductType.SERIALIZED,
    description: '13-inch, 8GB RAM, 256GB SSD',
    stock_quantity: 3
  },
  {
    id: '3',
    company_id: 'c1',
    name: 'Cable USB-C (2m)',
    sku: 'USBC-2M',
    category: 'Accesorios',
    price: 85000,
    cost: 25000,
    tax_rate: 19,
    type: ProductType.STANDARD,
    stock_quantity: 100
  },
  {
    id: '4',
    company_id: 'c1',
    name: 'Protector Pantalla iPhone 15',
    sku: 'SP-IP15',
    category: 'Accesorios',
    price: 60000,
    cost: 8000,
    tax_rate: 19,
    type: ProductType.STANDARD,
    stock_quantity: 50
  },
  {
    id: '5',
    company_id: 'c1',
    name: 'AirPods Pro 2',
    sku: 'APP2',
    category: 'Audio',
    price: 1100000,
    cost: 850000,
    tax_rate: 19,
    type: ProductType.SERIALIZED,
    stock_quantity: 10
  },
  {
    id: '6',
    company_id: 'c1',
    name: 'Servicio Técnico (Hora)',
    sku: 'SERV-H',
    category: 'Servicios',
    price: 150000,
    cost: 50000,
    tax_rate: 19,
    type: ProductType.SERVICE,
    stock_quantity: 0
  }
];

export const MOCK_SALES_HISTORY: any[] = [
  { name: 'Lun', sales: 12000000 },
  { name: 'Mar', sales: 8500000 },
  { name: 'Mie', sales: 15400000 },
  { name: 'Jue', sales: 9800000 },
  { name: 'Vie', sales: 22500000 },
  { name: 'Sab', sales: 28900000 },
  { name: 'Dom', sales: 11200000 },
];

export const MOCK_REPAIRS: RepairOrder[] = [
  {
    id: 'r1',
    customer_name: 'Juan Perez',
    device_model: 'iPhone 13',
    serial_number: '3587490234823',
    issue_description: 'Pantalla rota, touch no responde',
    status: RepairStatus.DIAGNOSING,
    estimated_cost: 450000,
    created_at: new Date().toISOString()
  },
  {
    id: 'r2',
    customer_name: 'Maria Rodriguez',
    device_model: 'MacBook Pro 2019',
    serial_number: 'C02XY82',
    issue_description: 'Batería no carga',
    status: RepairStatus.WAITING_PARTS,
    estimated_cost: 600000,
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

export const MOCK_SESSION: CashRegisterSession | null = {
    id: 'sess_1',
    start_time: new Date().toISOString(),
    start_cash: 500000, // Base de caja en COP
    total_sales_cash: 0,
    total_sales_card: 0,
    status: 'OPEN'
};

export const MOCK_RECEIVABLES: any[] = [
  {
    id: 'rec_1',
    customer_name: 'Empresa XYZ Ltda',
    total_amount: 15000000,
    paid_amount: 5000000,
    balance: 10000000,
    due_date: new Date(Date.now() + 86400000 * 10).toISOString(),
    status: 'PENDING'
  },
  {
    id: 'rec_2',
    customer_name: 'Carlos Cliente',
    total_amount: 4500000,
    paid_amount: 0,
    balance: 4500000,
    due_date: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'OVERDUE'
  }
];
