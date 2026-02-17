-- ==============================================================================
-- 1. CONFIGURACIÓN INICIAL Y EXTENSIONES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLAS NÚCLEO (SaaS Multi-tenancy)
-- ==============================================================================

-- Tabla de Empresas (Tenants)
CREATE TABLE companies (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  nit text NOT NULL, -- Identificación Tributaria
  email text,
  phone text,
  address text,
  logo_url text,
  subscription_plan text DEFAULT 'BASIC' CHECK (subscription_plan IN ('BASIC', 'PRO', 'ENTERPRISE')),
  subscription_status text DEFAULT 'ACTIVE',
  config jsonb DEFAULT '{"tax_rate": 19, "currency_symbol": "$", "invoice_prefix": "POS"}', 
  created_at timestamp with time zone DEFAULT now()
);

-- Configuración Específica Facturación Electrónica DIAN
CREATE TABLE company_dian_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  software_id text,
  software_pin text,
  certificate_path text, -- Ruta en Supabase Storage
  certificate_password text,
  resolution_number text,
  prefix text,
  current_number integer DEFAULT 1,
  range_from integer,
  range_to integer,
  technical_key text,
  environment text DEFAULT 'TEST' CHECK (environment IN ('TEST', 'PRODUCTION')),
  is_active boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

-- Sucursales
CREATE TABLE branches (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  name text NOT NULL,
  code text, -- Código establecimiento DIAN
  address text,
  city text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- 3. USUARIOS Y PERMISOS (Vinculado a Supabase Auth)
-- ==============================================================================

CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  branch_id uuid REFERENCES branches(id),
  role text CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'WAREHOUSE')),
  full_name text,
  email text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- 4. INVENTARIO Y PRODUCTOS
-- ==============================================================================

CREATE TABLE products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  name text NOT NULL,
  sku text NOT NULL,
  barcode text,
  description text,
  category text,
  brand text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  cost numeric(12, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) DEFAULT 19.00,
  stock_min integer DEFAULT 5,
  -- Cantidad virtual (cache) para items estándar. 
  -- Para items serializados se calcula contando la tabla inventory_items.
  stock_quantity integer DEFAULT 0, 
  type text CHECK (type IN ('STANDARD', 'SERIALIZED', 'SERVICE')),
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, sku)
);

-- Items Serializados (IMEI / Seriales únicos)
CREATE TABLE inventory_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  serial_number text NOT NULL,
  status text CHECK (status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'DEFECTIVE', 'TRANSIT')) DEFAULT 'AVAILABLE',
  location text,
  cost numeric(12, 2),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, serial_number)
);

-- ==============================================================================
-- 5. CRM (Clientes y Proveedores)
-- ==============================================================================

CREATE TABLE customers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  name text NOT NULL,
  document_type text DEFAULT 'CC',
  document_number text,
  email text,
  phone text,
  address text,
  credit_limit numeric(12,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- 6. POS Y VENTAS
-- ==============================================================================

CREATE TABLE cash_registers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  company_id uuid REFERENCES companies(id) NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'CLOSED',
  current_session_id uuid -- Referencia circular se maneja con cuidado o se actualiza luego
);

CREATE TABLE cash_register_sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  register_id uuid REFERENCES cash_registers(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  start_cash numeric(12, 2) DEFAULT 0,
  end_cash numeric(12, 2),
  total_sales_cash numeric(12, 2) DEFAULT 0,
  total_sales_card numeric(12, 2) DEFAULT 0,
  difference numeric(12, 2),
  status text DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  notes text
);

CREATE TABLE invoices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  user_id uuid REFERENCES auth.users(id),
  session_id uuid REFERENCES cash_register_sessions(id),
  
  subtotal numeric(12, 2) NOT NULL,
  tax_amount numeric(12, 2) NOT NULL,
  discount_amount numeric(12, 2) DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL,
  
  status text DEFAULT 'PENDING_ELECTRONIC', 
  payment_method jsonb, -- Guardar array de métodos de pago [{method: 'CASH', amount: 100}]
  notes text,
  
  -- Campos DIAN
  dian_cufe text,
  dian_qr_data text,
  
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE invoice_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL,
  price numeric(12, 2) NOT NULL,
  tax_rate numeric(5, 2) NOT NULL,
  discount numeric(12, 2) DEFAULT 0,
  serial_number text, -- Si es serializado, guardamos el IMEI aquí para referencia histórica
  total numeric(12, 2) GENERATED ALWAYS AS (quantity * price) STORED
);

-- ==============================================================================
-- 7. FACTURACIÓN ELECTRÓNICA (Historial y Logs)
-- ==============================================================================

CREATE TABLE electronic_documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  sale_id uuid REFERENCES invoices(id) NOT NULL,
  document_type text DEFAULT 'INVOICE',
  xml_content text,
  cufe text,
  qr_data text,
  status text, -- PENDING, SENT, ACCEPTED, REJECTED
  dian_response jsonb,
  track_id text,
  sent_at timestamp with time zone,
  validated_at timestamp with time zone,
  error_logs text[]
);

-- ==============================================================================
-- 8. SERVICIO TÉCNICO / REPARACIONES
-- ==============================================================================

CREATE TABLE repair_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) NOT NULL,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  customer_id uuid REFERENCES customers(id),
  device_type text,
  brand text,
  model text,
  serial_number text,
  issue_description text,
  diagnosis text,
  status text DEFAULT 'RECEIVED',
  estimated_cost numeric(12, 2),
  technician_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

-- ==============================================================================
-- 9. SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Habilitar RLS en todas las tablas sensibles
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_dian_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;

-- Función Helper para obtener el company_id del usuario actual
CREATE OR REPLACE FUNCTION get_auth_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Políticas Genéricas (Lectura/Escritura solo para la misma compañía)

-- Products
CREATE POLICY "Users can view their company products" ON products
FOR ALL USING (company_id = get_auth_company_id());

-- Inventory
CREATE POLICY "Users can view their company inventory" ON inventory_items
FOR ALL USING (company_id = get_auth_company_id());

-- Customers
CREATE POLICY "Users can view their company customers" ON customers
FOR ALL USING (company_id = get_auth_company_id());

-- Invoices
CREATE POLICY "Users can view their company invoices" ON invoices
FOR ALL USING (company_id = get_auth_company_id());

-- Branches
CREATE POLICY "Users can view their company branches" ON branches
FOR ALL USING (company_id = get_auth_company_id());

-- Profiles (Usuario puede ver su propio perfil)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- ==============================================================================
-- 10. TRIGGERS (Automatización Básica)
-- ==============================================================================

-- Trigger: Crear perfil público cuando se registra un usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Descomentar si se usa Supabase Auth en producción
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: Actualizar stock al vender (Simplificado)
-- Nota: En un sistema real serializado, esto cambiaría el estado en inventory_items
CREATE OR REPLACE FUNCTION update_stock_after_sale()
RETURNS trigger AS $$
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id AND type = 'STANDARD';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock
AFTER INSERT ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sale();
