// --- ENUMS ---
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  TECHNICIAN = 'TECHNICIAN'
}

export enum ProductType {
  STANDARD = 'STANDARD',
  SERIALIZED = 'SERIALIZED',
  SERVICE = 'SERVICE'
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED', // Venta local completada
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
  CREDIT_PENDING = 'CREDIT_PENDING',
  // DIAN Statuses
  PENDING_ELECTRONIC = 'PENDING_ELECTRONIC', // Lista para enviar
  SENT_TO_DIAN = 'SENT_TO_DIAN', // Enviada, esperando respuesta
  ACCEPTED = 'ACCEPTED', // Aceptada por DIAN
  REJECTED = 'REJECTED', // Rechazada por DIAN
  ACCEPTED_WITH_ERRORS = 'ACCEPTED_WITH_ERRORS'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CREDIT = 'CREDIT'
}

export enum RepairStatus {
  RECEIVED = 'RECEIVED',
  DIAGNOSING = 'DIAGNOSING',
  WAITING_PARTS = 'WAITING_PARTS',
  READY = 'READY',
  DELIVERED = 'DELIVERED'
}

export enum DianEnvironment {
  TEST = 'TEST', // Habilitación
  PRODUCTION = 'PRODUCTION'
}

// --- INTERFACES ---

export interface Company {
  id: string;
  name: string;
  nit: string;
  email?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  subscription_plan?: 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscription_status?: 'ACTIVE' | 'INACTIVE' | 'PAST_DUE';
  config?: CompanyConfig;
  dian_settings?: DianSettings;
}

export interface CompanyConfig {
  tax_rate: number;
  currency_symbol: string;
  invoice_prefix: string;
  dian_resolution?: string;
  dian_date?: string;
  dian_range_from?: string;
  dian_range_to?: string;
}

export interface DianSettings {
  company_id: string;
  software_id: string;
  software_pin: string;
  certificate_url?: string; // .p12 file path in storage
  certificate_password?: string;
  resolution_number: string;
  prefix: string;
  current_number: number;
  range_from: number;
  range_to: number;
  technical_key: string; // Clave técnica DIAN
  environment: DianEnvironment;
  is_active: boolean;
}

export interface ElectronicDocument {
  id: string;
  company_id: string;
  sale_id: string;
  xml_content?: string;
  cufe: string;
  qr_data: string;
  status: SaleStatus;
  dian_response?: string; // JSON or XML response from DIAN
  track_id?: string; // ID de seguimiento DIAN
  sent_at?: string;
  validated_at?: string;
  errors?: string[];
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  description?: string;
  price: number;
  cost: number;
  tax_rate: number;
  type: ProductType;
  category?: string;
  brand?: string;
  stock_quantity: number; // Virtual field for UI
}

export interface Customer {
  id: string;
  name: string;
  document_number: string;
  email?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  serial_number?: string;
  price: number;
  tax_rate: number;
  discount: number;
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_name?: string;
  customer_document?: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount: number;
  status: SaleStatus;
  created_at: string;
  items: CartItem[];
  dian_cufe?: string; // Código Único de Facturación Electrónica
  dian_qr_data?: string;
  electronic_doc?: ElectronicDocument; // Link to electronic document details
}

export interface RepairOrder {
  id: string;
  customer_name: string;
  device_model: string;
  serial_number: string;
  issue_description: string;
  status: RepairStatus;
  estimated_cost: number;
  technician_notes?: string;
  created_at: string;
}

export interface CashRegisterSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  start_cash: number;
  start_time: string;
  end_time?: string;
  end_cash?: number;
  difference?: number;
  total_sales_cash: number;
  total_sales_card: number;
}