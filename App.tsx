import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Repairs from './pages/Repairs';
import CashControl from './pages/CashControl';
import AccountsReceivable from './pages/AccountsReceivable';
import Settings from './pages/Settings';

// Placeholder for Login (simplified for this demo)
const Login = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">IPHONESHOP USA</h1>
        <p className="text-slate-500">Sistema de Gestión Empresarial</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onLogin(); }} className="space-y-4">
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" defaultValue="admin@iphoneshop.usa" required />
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input type="password" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" defaultValue="123456" required />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
            Ingresar
        </button>
        <p className="text-xs text-center text-slate-400 mt-4">
          Demo Mode: Credenciales pre-cargadas
        </p>
      </form>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Simple auth simulation
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} 
        />
        
        {/* Protected Routes */}
        <Route 
          path="/*" 
          element={
            isAuthenticated ? (
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
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;