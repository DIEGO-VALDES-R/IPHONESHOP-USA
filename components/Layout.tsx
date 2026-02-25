import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Wrench,
  Settings, LogOut, Menu, Building2, User,
  Landmark, FileText, Globe, Receipt, ShieldCheck
} from 'lucide-react';
import { useCurrency, CurrencyCode } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../supabaseClient';

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { currency, setCurrency } = useCurrency();
  const { company, isLoading, userRole, companyId } = useDatabase();

  const handleLogout = async () => {
    // Limpiar empresa seleccionada al cerrar sesion
    localStorage.removeItem('master_selected_company');
    await supabase.auth.signOut();
  };

  const navItems = [
    { label: 'Dashboard',          path: '/',             icon: LayoutDashboard },
    { label: 'Punto de Venta',     path: '/pos',          icon: ShoppingCart },
    { label: 'Control de Caja',    path: '/cash-control', icon: Landmark },
    { label: 'Inventario',         path: '/inventory',    icon: Package },
    { label: 'Historial Facturas', path: '/invoices',     icon: Receipt },
    { label: 'Servicio Tecnico',   path: '/repairs',      icon: Wrench },
    { label: 'Cartera / CxC',      path: '/receivables',  icon: FileText },
    { label: 'Configuracion',      path: '/settings',     icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;
  const companyName = company?.name ?? 'IPHONESHOP USA';
  const logoUrl = company?.logo_url ?? null;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg flex items-center justify-center overflow-hidden w-12 h-12 flex-shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                : <Building2 size={24} className="text-white" />}
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-tight line-clamp-1" title={companyName}>
                {companyName}
              </h1>
              <p className="text-xs text-slate-400">ERP System</p>
            </div>
          </div>

          {/* Badge MASTER — solo visual, sin selector */}
          {userRole === 'MASTER' && (
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 border border-blue-700/50 rounded-lg text-blue-300">
              <ShieldCheck size={13} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Modo Maestro</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
            Menu Principal
          </label>

          {navItems.map((item) => (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}>
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}

          {/* Panel Maestro — solo visible para MASTER */}
          {userRole === 'MASTER' && (
            <Link to="/master-admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mt-2 border ${
                isActive('/master-admin')
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                  : 'text-blue-400 border-blue-800/40 hover:bg-blue-900/30 hover:text-blue-200'
              }`}>
              <ShieldCheck size={20} />
              <span className="font-medium">Panel Maestro</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-800/50 rounded-lg">
            <Globe size={18} className="text-slate-400" />
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="bg-transparent text-sm font-medium text-white focus:outline-none w-full cursor-pointer">
              <option value="COP" className="text-slate-900">COP (Peso)</option>
              <option value="USD" className="text-slate-900">USD (Dolar)</option>
              <option value="EUR" className="text-slate-900">EUR (Euro)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{companyName}</p>
              <p className="text-xs text-slate-400 truncate">
                {userRole === 'MASTER' ? 'Usuario Maestro' : 'Administrador'}
              </p>
            </div>
          </div>

          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 md:hidden flex flex-col p-4">
          <div className="flex justify-end mb-8">
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-white text-2xl font-bold">✕</button>
          </div>

          {userRole === 'MASTER' && (
            <div className="mb-4 px-2 py-2 bg-blue-900/30 border border-blue-700/40 rounded-lg text-blue-300 flex items-center gap-2">
              <ShieldCheck size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Modo Maestro</span>
            </div>
          )}

          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-4 text-white text-xl py-4 border-b border-slate-700">
              <item.icon size={24} />
              <span>{item.label}</span>
            </Link>
          ))}

          {userRole === 'MASTER' && (
            <Link to="/master-admin" onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-4 text-blue-400 text-xl py-4 border-b border-slate-700">
              <ShieldCheck size={24} />
              <span>Panel Maestro</span>
            </Link>
          )}

          <div className="mt-4">
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full bg-slate-800 text-white p-3 rounded-lg">
              <option value="COP">COP (Colombia)</option>
              <option value="USD">USD (Dolar)</option>
            </select>
          </div>

          <button onClick={handleLogout} className="mt-4 flex items-center gap-3 text-red-400 py-3">
            <LogOut size={20} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} className="w-8 h-8 rounded object-cover" alt="logo" />}
            <h1 className="font-bold text-slate-800">{companyName}</h1>
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
