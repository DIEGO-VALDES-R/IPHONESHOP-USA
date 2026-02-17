import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { DatabaseProvider } from './contexts/DatabaseContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Repairs from './pages/Repairs';
import CashControl from './pages/CashControl';
import AccountsReceivable from './pages/AccountsReceivable';
import Settings from './pages/Settings';
import { Toaster } from 'react-hot-toast';

// ── LOGIN REAL CON SUPABASE ──────────────────────────
const Login: React.FC = () => {
  const [email, setEmail] = useState('diegoferrangel@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">IP</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">IPHONESHOP USA</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestión Empresarial</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña de Supabase"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos'
                : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── APP PRINCIPAL ────────────────────────────────────
const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Verificar sesión existente al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });

    // Escuchar cambios de auth (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mientras verifica la sesión
  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Router>
        {!session ? (
          <Login />
        ) : (
          <DatabaseProvider>
            <Routes>
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/repairs" element={<Repairs />} />
                    <Route path="/cash-control" element={<CashControl />} />
                    <Route path="/receivables" element={<AccountsReceivable />} />
                    <Route path="/settings" element={<Settings />} />
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
