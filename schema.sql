-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- 1. SAAS KERNEL (Multi-tenancy)
create table companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  nit text not null, -- Tax ID
  email text,
  phone text,
  address text,
  logo_url text,
  subscription_plan text default 'BASIC', -- BASIC, PRO, ENTERPRISE
  subscription_status text default 'ACTIVE',
  config jsonb default '{}', -- DIAN settings (basic), printers, taxes
  created_at timestamp with time zone default now()
);

-- CONFIGURACIÓN AVANZADA DIAN (Separada por seguridad)
create table company_dian_settings (
  company_id uuid primary key references companies(id),
  software_id text,
  software_pin text,
  certificate_path text, -- Ruta en Supabase Storage
  certificate_password text, -- Debería estar encriptada
  resolution_number text,
  prefix text,
  current_number integer default 1,
  range_from integer,
  range_to integer,
  technical_key text,
  environment text default 'TEST', -- TEST, PRODUCTION
  is_active boolean default false,
  updated_at timestamp with time zone default now()
);

create table branches (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  code text, -- DIAN establishment code
  address text,
  city text,
  manager_id uuid, -- Link to user
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 2. ACCESS CONTROL
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  company_id uuid references companies(id),
  branch_id uuid references branches(id),
  role text check (role in ('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'WAREHOUSE')),
  full_name text,
  email text,
  avatar_url text,
  permissions jsonb, -- Granular permissions
  is_active boolean default true,
  last_login timestamp with time zone
);

-- 3. CRM & STAKEHOLDERS
create table customers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  document_type text, -- CC, NIT, PASSPORT
  document_number text,
  email text,
  phone text,
  address text,
  city text,
  type text default 'PERSON', -- PERSON, COMPANY
  credit_limit numeric(12,2) default 0,
  created_at timestamp with time zone default now()
);

create table suppliers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  nit text,
  contact_name text,
  phone text,
  email text,
  created_at timestamp with time zone default now()
);

-- 4. INVENTORY CORE
create table products (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  name text not null,
  sku text not null,
  barcode text,
  description text,
  category text,
  brand text,
  price numeric(12, 2) not null default 0,
  cost numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) default 19.00,
  stock_min integer default 5,
  type text check (type in ('STANDARD', 'SERIALIZED', 'SERVICE')),
  image_url text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  unique(company_id, sku)
);

create table inventory_items (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  branch_id uuid references branches(id) not null,
  product_id uuid references products(id) not null,
  serial_number text, -- IMEI / Serial
  status text check (status in ('AVAILABLE', 'SOLD', 'RESERVED', 'DEFECTIVE', 'TRANSIT')) default 'AVAILABLE',
  location text, -- Shelf/Bin
  purchase_id uuid, -- Link to purchase
  cost numeric(12, 2),
  created_at timestamp with time zone default now()
);

-- 5. SALES & POS
create table cash_registers (
  id uuid default uuid_generate_v4() primary key,
  branch_id uuid references branches(id) not null,
  name text not null,
  status text default 'CLOSED',
  current_session_id uuid
);

create table cash_register_sessions (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  register_id uuid references cash_registers(id) not null,
  user_id uuid references auth.users(id) not null,
  start_time timestamp with time zone default now(),
  end_time timestamp with time zone,
  start_cash numeric(12, 2) default 0,
  end_cash numeric(12, 2),
  total_sales numeric(12, 2) default 0,
  difference numeric(12, 2),
  status text default 'OPEN',
  notes text
);

create table invoices (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  branch_id uuid references branches(id) not null,
  invoice_number text not null, -- DIAN sequence (e.g., SETT-1001)
  customer_id uuid references customers(id),
  user_id uuid references auth.users(id),
  session_id uuid references cash_register_sessions(id),
  subtotal numeric(12, 2) not null,
  tax_amount numeric(12, 2) not null,
  discount_amount numeric(12, 2) default 0,
  total_amount numeric(12, 2) not null,
  -- Estado extendido para DIAN
  status text default 'PENDING_ELECTRONIC', -- PENDING_ELECTRONIC, SENT_TO_DIAN, ACCEPTED, REJECTED
  payment_method text, -- JSON array of methods
  notes text,
  created_at timestamp with time zone default now()
);

-- DOCUMENTOS ELECTRÓNICOS (Historial de transacciones XML)
create table electronic_documents (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  invoice_id uuid references invoices(id) not null,
  document_type text default 'INVOICE', -- INVOICE, CREDIT_NOTE, DEBIT_NOTE
  xml_content text, -- UBL XML
  cufe text,
  qr_data text,
  status text, -- PENDING, SENT, ACCEPTED, REJECTED
  dian_response jsonb, -- Respuesta completa de la DIAN
  track_id text, -- ID de seguimiento (TrackId)
  sent_at timestamp with time zone,
  validated_at timestamp with time zone,
  error_logs text[] -- Array de errores
);

create table invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) not null,
  product_id uuid references products(id) not null,
  quantity integer not null,
  price numeric(12, 2) not null,
  tax_rate numeric(5, 2) not null,
  discount numeric(12, 2) default 0,
  serial_number text,
  total numeric(12, 2) generated always as (quantity * price) stored
);

-- 6. SERVICE & REPAIRS
create table repair_orders (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  branch_id uuid references branches(id) not null,
  customer_id uuid references customers(id),
  device_type text,
  brand text,
  model text,
  serial_number text,
  issue_description text,
  diagnosis text,
  status text default 'RECEIVED',
  estimated_cost numeric(12, 2),
  technician_id uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone
);

-- 7. ACCOUNTING & FINANCE
create table accounting_entries (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) not null,
  date timestamp with time zone default now(),
  description text,
  reference_type text, -- INVOICE, PURCHASE, EXPENSE
  reference_id uuid,
  amount numeric(12, 2),
  type text check (type in ('DEBIT', 'CREDIT')),
  account_code text
);

-- 8. SYSTEM
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id),
  user_id uuid references auth.users(id),
  action text not null,
  module text,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone default now()
);

-- RLS (Example)
alter table products enable row level security;
create policy "Tenants view their own data" on products
using (company_id = (select company_id from profiles where id = auth.uid()));