# 📱 IPHONESHOP USA - ERP & POS System

**Sistema de Gestión Empresarial especializado en Retail Tecnológico (Apple, Android, Accesorios).**

Este proyecto es un **ERP + POS (Punto de Venta)** moderno, multi-sucursal y multi-empresa, diseñado específicamente para negocios que requieren control de inventario serializado (IMEI/Seriales), gestión de servicio técnico y facturación electrónica (adaptado a normativa DIAN Colombia).

Desarrollado con **React (TypeScript)**, **Tailwind CSS** y **Supabase** (PostgreSQL + Auth).

---

## 🚀 Características Principales

### 🏪 Punto de Venta (POS)
*   **Interfaz ágil:** Optimizada para pantallas táctiles y uso con mouse/teclado.
*   **Búsqueda inteligente:** Escaneo de código de barras, búsqueda por SKU, Nombre o IMEI.
*   **Carro de compras:** Manejo de impuestos (IVA), descuentos y múltiples métodos de pago (Efectivo, Tarjeta, Transferencia, Crédito).
*   **Facturación:** Generación de tirilla de venta y pre-visualización de factura electrónica.

### 📦 Inventario Avanzado
*   **Control Serializado:** Gestión única de IMEIs y Seriales para teléfonos y computadores.
*   **Tipos de Producto:** Soporte para productos Estándar, Serializados y Servicios.
*   **Alertas de Stock:** Indicadores visuales de stock bajo.

### 🛠️ Servicio Técnico (RMA)
*   **Gestión de Órdenes:** Recepción de equipos, diagnóstico, espera de repuestos y entrega.
*   **Estados:** Flujo de trabajo personalizable (Recibido -> Diagnosticando -> Listo).
*   **Trazabilidad:** Registro del problema, serial del equipo y costo estimado.

### 💰 Finanzas y Caja
*   **Control de Turnos:** Apertura y Cierre de caja con control de efectivo y arqueo (diferencias sobrantes/faltantes).
*   **Cuentas por Cobrar:** Gestión de cartera de clientes y créditos.
*   **Dashboard:** Gráficos en tiempo real de ventas, utilidad y productos top.

### 🏛️ Facturación Electrónica (DIAN)
*   **Módulo de Configuración:** Gestión de resolución, prefijos y certificado digital (.p12).
*   **Estados:** Visualización de estados (Pendiente, Enviado, Aceptado, Rechazado).
*   **Simulación:** Lógica simulada de envío asíncrono y generación de CUFE/QR.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** React 19, TypeScript, Vite (o CRA según configuración).
*   **Estilos:** Tailwind CSS, Lucide React (Iconos).
*   **Gráficos:** Recharts.
*   **Backend / Base de Datos:** Supabase (PostgreSQL).
*   **Seguridad:** Row Level Security (RLS) de Postgres.
*   **Autenticación:** Supabase Auth.

---

## ⚙️ Instalación y Configuración

### 1. Prerrequisitos
*   Node.js (v18 o superior).
*   Una cuenta en [Supabase](https://supabase.com).

### 2. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/iphoneshop-erp.git
cd iphoneshop-erp
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (o `.env.local`) y agrega tus credenciales de Supabase:

```env
REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=tu-clave-anonima-publica
```

### 5. Configurar Base de Datos (Supabase)
1.  Ve al **SQL Editor** en tu dashboard de Supabase.
2.  Copia el contenido del archivo `schema.sql` incluido en este proyecto.
3.  Ejecuta el script completo. Esto creará:
    *   Todas las tablas (`companies`, `products`, `invoices`, etc.).
    *   Las relaciones (Foreign Keys).
    *   Las políticas de seguridad (RLS).
    *   Triggers automáticos.

### 6. Ejecutar el proyecto
```bash
npm start
# o si usas vite:
npm run dev
```

---

## 🔑 Credenciales y Accesos Demo

El sistema cuenta con un **Modo Demo** preconfigurado para facilitar las pruebas.

### Login (Simulado)
*   **Email:** `admin@iphoneshop.usa`
*   **Contraseña:** `123456`

### Clave Maestra (Suscripciones & Configuración)
Para acceder a zonas sensibles como la gestión de planes o subir certificados digitales:
*   **Master Key:** `admin123`

---

## 📂 Estructura del Proyecto

```text
/
├── components/        # Componentes UI reutilizables (Layout, Modales)
├── contexts/          # Estado global (DatabaseContext, CurrencyContext)
├── pages/             # Vistas principales (Dashboard, POS, Inventory, etc.)
├── services/          # Lógica de datos simulada y utilidades
├── types.ts           # Definiciones de tipos TypeScript e Interfaces
├── supabaseClient.ts  # Cliente de conexión a Supabase
├── schema.sql         # Script de creación de Base de Datos
└── backend_dian_module.ts # Referencia de arquitectura para el backend real DIAN
```

---

## 🏛️ Módulo Backend DIAN (Referencia)

El archivo `backend_dian_module.ts` en la raíz **NO** se ejecuta en el navegador. Es una guía de arquitectura para implementar el microservicio de facturación electrónica usando **NestJS**.

Incluye:
1.  Estructura de DTOs.
2.  Lógica de generación de XML (UBL 2.1).
3.  Servicio de Firma Digital (XAdES-BES).
4.  Cálculo del CUFE (Código Único de Facturación Electrónica).

---

## 🛡️ Seguridad (Row Level Security)

El sistema utiliza RLS de PostgreSQL. Esto significa que, aunque es una aplicación SaaS (Software as a Service) donde múltiples empresas comparten la misma base de datos, **una empresa NUNCA puede ver los datos de otra empresa**.

La política se aplica a nivel de base de datos:
```sql
CREATE POLICY "Users can view their company products" ON products
FOR ALL USING (company_id = get_auth_company_id());
```

---

## 🔜 Próximos Pasos (Roadmap)

1.  **Integración Real DIAN:** Conectar el frontend con el microservicio NestJS descrito.
2.  **Impresión Térmica:** Integración con la API WebUSB para impresión directa sin diálogo del navegador.
3.  **App Móvil:** Adaptación a React Native para vendedores en piso.
4.  **E-commerce:** Sincronización de inventario con Shopify/WooCommerce.

---

**Desarrollado por:** Tu Nombre / Empresa
**Licencia:** MIT
