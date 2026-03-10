import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Wrench,
  Settings, LogOut, Menu, Building2, User,
  Landmark, FileText, Globe, Receipt, ShieldCheck, Users, Utensils, ChefHat,
  Scissors, Stethoscope, FlaskConical, PawPrint, Pill, UserRound, ChevronDown, ChevronRight
} from 'lucide-react';
import { useCurrency, CurrencyCode } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../supabaseClient';

interface LayoutProps { children: React.ReactNode; onAdminPanel?: () => void; }

const BUSINESS_ICONS: Record<string, string> = {
  general: '🏪', tienda_tecnologia: '📱', restaurante: '🍽️',
  ropa: '👗', zapateria: '👟', ferreteria: '🔧', farmacia: '💊',
  supermercado: '🛒', salon: '💇', odontologia: '🦷', veterinaria: '🐾', otro: '📦',
};

const BUSINESS_LABELS: Record<string, string> = {
  general: 'Tienda General', tienda_tecnologia: 'Tecnología / Celulares',
  restaurante: 'Restaurante / Cafetería', ropa: 'Ropa / Calzado',
  zapateria: 'Zapatería / Marroquinería', ferreteria: 'Ferretería / Construcción',
  farmacia: 'Farmacia / Droguería', supermercado: 'Supermercado / Abarrotes',
  salon: 'Salón de Belleza / Spa', odontologia: 'Consultorio Odontológico',
  veterinaria: 'Clínica Veterinaria', otro: 'Negocio',
};

function getNavItems(
  businessType: string,
  hasPermission: (k: string) => boolean,
  isAdmin: boolean,
  isPro: boolean,
) {
  const p = (key: string) => hasPermission(key) || isAdmin;
  const type = businessType || 'general';
  const isRest  = ['restaurante', 'restaurant', 'cocina', 'cafeteria'].includes(type);
  const invLabel =
    isRest                               ? 'Insumos Cocina'   :
    type === 'zapateria'                 ? 'Materiales'       :
    type === 'salon' || type === 'salón' ? 'Insumos Salón'    :
    type === 'farmacia'                  ? 'Insumos'          :
    type === 'veterinaria'               ? 'Insumos Vet'      :
    type === 'odontologia'               ? 'Insumos Dental'   :
    'Inventario';

  const items = [
    { label: 'Dashboard',          path: '/',             icon: LayoutDashboard, show: true },
    { label: 'Punto de Venta',     path: '/pos',          icon: ShoppingCart,    show: p('can_sell') },
    { label: 'Control de Caja',    path: '/cash-control', icon: Landmark,        show: p('can_open_cash') },
    { label: invLabel,             path: '/inventory',    icon: Package,         show: p('can_manage_inventory') },
    { label: 'Historial Facturas', path: '/invoices',     icon: Receipt,         show: p('can_view_reports') },
    { label: 'Clientes',           path: '/customers',    icon: UserRound,       show: p('can_view_reports') },
  ];

  // Módulos específicos por tipo
  if (type === 'restaurante') {
    items.push(
      { label: 'Mesas',          path: '/tables',  icon: Utensils, show: p('can_sell') },
      { label: 'Display Cocina', path: '/kitchen', icon: ChefHat,  show: isAdmin },
    );
  } else if (type === 'salon') {
    items.push({ label: 'Salón de Belleza', path: '/salon',      icon: Scissors,    show: p('can_sell') });
  } else if (type === 'odontologia') {
    items.push({ label: 'Odontología',      path: '/dentistry',  icon: Stethoscope, show: p('can_sell') });
  } else if (type === 'veterinaria') {
    items.push({ label: 'Veterinaria',      path: '/veterinaria',icon: PawPrint,    show: p('can_sell') });
  } else if (type === 'farmacia') {
    items.push({ label: 'Farmacia',         path: '/farmacia',   icon: Pill,        show: p('can_sell') });
  } else if (type === 'zapateria') {
    items.push({ label: 'Zapatería / Rep.', path: '/shoe-repair',icon: Wrench,      show: p('can_view_repairs') });
  } else {
    // tecnología, general, ropa, ferretería, supermercado → Servicio Técnico
    items.push({ label: 'Servicio Técnico', path: '/repairs',    icon: Wrench,      show: p('can_view_repairs') });
  }

  items.push(
    { label: 'Cartera / CxC', path: '/receivables', icon: FileText,    show: p('can_view_reports') },
    { label: 'Insumos',       path: '/supplies',    icon: FlaskConical, show: isAdmin },
    { label: 'Equipo',        path: '/team',        icon: Users,        show: isPro && p('can_manage_team') },
  );

  return items.filter(i => i.show);
}

// ── NavLink ───────────────────────────────────────────────────────────────────
const NavLink: React.FC<{
  item: { label: string; path: string; icon: React.ElementType };
  isActive: boolean; fontColor: string; onClick?: () => void;
}> = ({ item, isActive, fontColor, onClick }) => (
  <Link to={item.path} onClick={onClick}
    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm"
    style={{
      background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
      color: fontColor, fontWeight: isActive ? 700 : 400, opacity: isActive ? 1 : 0.85,
    }}>
    <item.icon size={16} />
    <span>{item.label}</span>
  </Link>
);

// ── Acordeón por sucursal ─────────────────────────────────────────────────────
const BranchSection: React.FC<{
  name: string; businessType: string;
  items: { label: string; path: string; icon: React.ElementType }[];
  isActive: (path: string) => boolean; fontColor: string;
  defaultOpen?: boolean; onNav?: () => void;
}> = ({ name, businessType, items, isActive, fontColor, defaultOpen = false, onNav }) => {
  const [open, setOpen] = useState(defaultOpen);
  const icon  = BUSINESS_ICONS[businessType]  || '🏪';
  const label = BUSINESS_LABELS[businessType] || 'Negocio';

  return (
    <div className="mb-1">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
        style={{ background: open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)', color: fontColor }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{icon}</span>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold truncate leading-tight">{name}</p>
            <p className="text-[10px] truncate leading-tight" style={{ opacity: 0.55 }}>{label}</p>
          </div>
        </div>
        {open
          ? <ChevronDown  size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ opacity: 0.6, flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="ml-3 mt-0.5 pl-2 space-y-0.5"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
          {items.map(item => (
            <NavLink key={item.path + name} item={item}
              isActive={isActive(item.path)} fontColor={fontColor} onClick={onNav} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children, onAdminPanel }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();
  const { company, isLoading, userRole, hasPermission } = useDatabase();
  const [childBranches, setChildBranches] = useState<any[]>([]);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const plan       = company?.subscription_plan || 'BASIC';
  const isPro      = ['PRO', 'ENTERPRISE', 'MASTER'].includes(plan);
  const isAdmin    = userRole === 'MASTER' || userRole === 'ADMIN';
  const brandColor = (company?.config as any)?.primary_color || '#1e293b';
  const fontColor  = (company?.config as any)?.font_color    || '#ffffff';
  const companyName = company?.name ?? 'POSmaster';
  const logoUrl     = company?.logo_url ?? null;

  const cfg = (company?.config as any) || {};
  const mainBusinessTypes: string[] = Array.isArray(cfg.business_types)
    ? cfg.business_types
    : cfg.business_type ? [cfg.business_type] : ['general'];

  useEffect(() => {
    if (!company?.id || !isPro) { setChildBranches([]); return; }
    supabase
      .from('companies')
      .select('id, name, config, subscription_status')
      .eq('negocio_padre_id', company.id)
      .eq('subscription_status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .then(({ data }) => setChildBranches(data || []));
  }, [company?.id, isPro]);

  const isActive = (path: string) => location.pathname === path;

  const hexToRgb = (hex: string) => {
    if (!hex || hex.length < 7) return '30,41,59';
    return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
  };
  const brandRgb = brandColor.startsWith('#') ? hexToRgb(brandColor) : '30,41,59';

  const roleDisplay =
    userRole === 'MASTER' ? 'Propietario' :
    userRole === 'ADMIN'  ? 'Administrador' : userRole || 'Usuario';

  // Secciones: tipos del negocio principal + sucursales hijas
  const sections = [
    ...mainBusinessTypes.map((bt, idx) => ({
      id: `main-${bt}`, name: companyName, businessType: bt, defaultOpen: idx === 0,
    })),
    ...childBranches.map(b => ({
      id: b.id, name: b.name,
      businessType: b.config?.business_type || b.config?.business_types?.[0] || 'general',
      defaultOpen: false,
    })),
  ];

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Header */}
      <div className="p-4 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: logoUrl ? '#fff' : 'rgba(0,0,0,0.3)' }}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain mix-blend-multiply" />
            : <Building2 size={20} className="text-white" />}
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm leading-tight truncate" style={{ color: fontColor }} title={companyName}>
            {companyName}
          </h1>
          <p className="text-[10px]" style={{ color: fontColor, opacity: 0.5 }}>POSmaster</p>
        </div>
      </div>

      {/* Menú acordeón */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {sections.map(sec => (
          <BranchSection
            key={sec.id}
            name={sec.name}
            businessType={sec.businessType}
            items={getNavItems(sec.businessType, hasPermission, isAdmin, isPro)}
            isActive={isActive}
            fontColor={fontColor}
            defaultOpen={sec.defaultOpen}
            onNav={onNav}
          />
        ))}
      </nav>

      {/* Accesos fijos: Sucursales y Configuración */}
      <div className="px-3 pb-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 10 }}>
        {isPro && isAdmin && (
          <Link to="/branches" onClick={onNav}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm w-full"
            style={{ background: isActive('/branches') ? 'rgba(255,255,255,0.18)' : 'transparent', color: fontColor, fontWeight: isActive('/branches') ? 700 : 400, opacity: isActive('/branches') ? 1 : 0.8 }}>
            <Building2 size={16} /> Sucursales
          </Link>
        )}
        {isAdmin && (
          <Link to="/settings" onClick={onNav}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm w-full"
            style={{ background: isActive('/settings') ? 'rgba(255,255,255,0.18)' : 'transparent', color: fontColor, fontWeight: isActive('/settings') ? 700 : 400, opacity: isActive('/settings') ? 1 : 0.8 }}>
            <Settings size={16} /> Configuración
          </Link>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 space-y-1.5 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <Globe size={14} style={{ color: fontColor, opacity: 0.7 }} />
          <select value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode)}
            className="bg-transparent text-xs font-medium focus:outline-none w-full cursor-pointer"
            style={{ color: fontColor }}>
            <option value="COP" className="text-slate-900">COP (Peso)</option>
            <option value="USD" className="text-slate-900">USD (Dólar)</option>
            <option value="EUR" className="text-slate-900">EUR (Euro)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
            <User size={13} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: fontColor }}>{companyName}</p>
            <p className="text-[10px]" style={{ color: fontColor, opacity: 0.6 }}>{roleDisplay}</p>
          </div>
        </div>

        {onAdminPanel && (
          <button onClick={onAdminPanel}
            className="flex w-full items-center gap-2 px-3 py-2 text-purple-300 hover:bg-purple-900/20 rounded-lg transition-colors text-xs font-medium">
            <ShieldCheck size={14} /> Panel POSmaster
          </button>
        )}
        <button onClick={handleLogout}
          className="flex w-full items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-xs font-medium">
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-60 text-white shadow-xl flex-shrink-0"
        style={{ background: brandColor, transition: 'background 0.4s ease' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col"
          style={{ background: `rgba(${brandRgb},0.97)` }}>
          <div className="flex justify-end p-4 flex-shrink-0">
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-white text-2xl font-bold">✕</button>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <SidebarContent onNav={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} className="w-8 h-8 rounded object-cover" alt="logo" />}
            <h1 className="font-bold text-slate-800 text-sm">{companyName}</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {isLoading
              ? <div className="flex items-center justify-center h-full">
                  <div className="text-slate-400 text-lg animate-pulse">Cargando datos...</div>
                </div>
              : children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;