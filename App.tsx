import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { DatabaseProvider } from './contexts/DatabaseContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Repairs from './pages/Repairs';
import CashControl from './pages/CashControl';
import AccountsReceivable from './pages/AccountsReceivable';
import InvoiceHistory from './pages/InvoiceHistory';
import Settings from './pages/Settings';
import MasterAdmin from './pages/MasterAdmin';
import { Toaster } from 'react-hot-toast';
import { ShieldCheck, Eye, EyeOff, LogOut } from 'lucide-react';

// ============================================================
//  CAMBIA ESTA CLAVE POR LA QUE QUIERAS — solo tu la sabes
// ============================================================
const MASTER_SECRET = 'Diego2024*';
// ============================================================

const checkIfMaster = async (userId: string) => {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'MASTER';
};

const fetchCompanies = async () => {
  const { data } = await supabase.from('companies').select('id, name, logo_url').order('name');
  return data || [];
};

// ── PANTALLA: Clave maestra ──────────────────────────────────────────────────
const MasterPinScreen: React.FC<{ onSuccess: () => void; onCancel: () => void }> = ({ onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === MASTER_SECRET) {
      onSuccess();
    } else {
      setError('Clave incorrecta');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className={`bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 transition-all ${shake ? 'animate-bounce' : ''}`}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Verificacion Maestra</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa la clave de acceso maestro</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pin}
              onChange={e => { setPin(e.target.value); setError(''); }}
              placeholder="Clave maestra"
              autoFocus
              className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-center text-lg tracking-widest font-mono transition-colors ${
                error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Verificar
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-slate-500 py-2 text-sm hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={14} /> Cancelar y cerrar sesion
          </button>
        </form>
      </div>
    </div>
  );
};

// ── PANTALLA: Selector de empresa ────────────────────────────────────────────
const CompanySelectorScreen: React.FC<{ onSelect: (id: string) => void; onSkip: () => void }> = ({ onSelect, onSkip }) => {
  const [companies, setCompanies] = useState<{ id: string; name: string; logo_url?: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies().then(c => { setCompanies(c); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Modo Maestro</h1>
          <p className="text-slate-500 text-sm mt-1">Selecciona la empresa a gestionar</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Cargando empresas...</div>
        ) : (
          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto pr-1">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  selected === c.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-slate-600 font-bold">{c.name[0]}</span>}
                </div>
                <span className="font-medium text-slate-800">{c.name}</span>
                {selected === c.id && <span className="ml-auto text-blue-600 text-lg">&#10003;</span>}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ingresar a empresa seleccionada
          </button>
          <button
            onClick={onSkip}
            className="w-full border border-slate-200 text-slate-500 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            Ir al Panel Maestro sin seleccionar empresa
          </button>
        </div>
      </div>
    </div>
  );
};

// ── LOGIN ────────────────────────────────────────────────────────────────────
type LoginStep = 'credentials' | 'master-pin' | 'master-company';

const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [step, setStep]         = useState<LoginStep>('credentials');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Email o contrasena incorrectos' : authError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) { setLoading(false); return; }

    const master = await checkIfMaster(userId);

    if (master) {
      // MASTER: pedir clave antes de mostrar empresas
      setStep('master-pin');
      setLoading(false);
      return;
    }

    // Usuario normal: entra directo
    setLoading(false);
  };

  const handlePinSuccess = () => {
    setStep('master-company');
  };

  const handlePinCancel = async () => {
    localStorage.removeItem('master_selected_company');
    await supabase.auth.signOut();
    setStep('credentials');
    setEmail('');
    setPassword('');
  };

  const handleCompanySelect = (companyId: string) => {
    localStorage.setItem('master_selected_company', companyId);
    window.location.reload();
  };

  const handleSkipCompany = () => {
    localStorage.removeItem('master_selected_company');
    window.location.reload();
  };

  if (step === 'master-pin') {
    return <MasterPinScreen onSuccess={handlePinSuccess} onCancel={handlePinCancel} />;
  }

  if (step === 'master-company') {
    return <CompanySelectorScreen onSelect={handleCompanySelect} onSkip={handleSkipCompany} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">IP</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">IPHONESHOP USA</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestion Empresarial</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contrasena</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── PROTEGER RUTA /master-admin ──────────────────────────────────────────────
const MasterRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAllowed(false); return; }
      setAllowed(await checkIfMaster(user.id));
    });
  }, []);

  if (allowed === null) return null;
  if (!allowed) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500">
      <div className="text-6xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold">Acceso Denegado</h1>
      <p className="text-sm mt-2">Esta seccion es exclusiva del usuario maestro.</p>
    </div>
  );
  return <>{children}</>;
};

// ── APP ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Router>
        {!session ? <Login /> : (
          <DatabaseProvider>
            <Routes>
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/"             element={<Dashboard />} />
                    <Route path="/pos"          element={<POS />} />
                    <Route path="/inventory"    element={<Inventory />} />
                    <Route path="/repairs"      element={<Repairs />} />
                    <Route path="/cash-control" element={<CashControl />} />
                    <Route path="/receivables"  element={<AccountsReceivable />} />
                    <Route path="/invoices"     element={<InvoiceHistory />} />
                    <Route path="/settings"     element={<Settings />} />
                    <Route path="/master-admin" element={
                      <MasterRoute><MasterAdmin /></MasterRoute>
                    } />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </DatabaseProvider>
        )}
      </Router>
    </>
  );
};

export default App;
