import React, { useState, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../supabaseClient';
import { Building2, Plus, Users, Shield, CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MasterAdmin: React.FC = () => {
  const { userRole, availableCompanies } = useDatabase();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    nit: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (userRole === 'MASTER') {
      fetchCompanies();
    }
  }, [userRole]);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*, profiles(count)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar empresas');
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('companies')
      .insert([{
        ...newCompany,
        subscription_plan: 'BASIC',
        subscription_status: 'ACTIVE',
      }])
      .select();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Empresa creada correctamente');
      setShowNewCompanyModal(false);
      setNewCompany({ name: '', nit: '', email: '', phone: '', address: '' });
      fetchCompanies();
    }
  };

  if (userRole !== 'MASTER') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Shield size={48} className="mb-4 text-red-400" />
        <h1 className="text-2xl font-bold">Acceso Denegado</h1>
        <p>Esta pagina es solo para usuarios maestros.</p>
      </div>
    );
  }

  const filteredCompanies = companies.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.nit  || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Administracion Maestro</h1>
          <p className="text-slate-500">Gestiona todos tus clientes y empresas desde un solo lugar.</p>
        </div>
        <button
          onClick={() => setShowNewCompanyModal(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          Nueva Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Building2 size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Empresas</p>
              <p className="text-2xl font-bold text-slate-800">{companies.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle2 size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Empresas Activas</p>
              <p className="text-2xl font-bold text-slate-800">
                {companies.filter(c => c.subscription_status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Users size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Usuarios</p>
              <p className="text-2xl font-bold text-slate-800">
                {companies.reduce((acc, curr) => acc + (curr.profiles?.[0]?.count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="font-bold text-slate-800">Listado de Clientes / Empresas</h2>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o NIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">NIT / ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Creada</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Cargando empresas...</td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No se encontraron empresas.</td>
                </tr>
              ) : (
                filteredCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 overflow-hidden">
                          {c.logo_url
                            ? <img src={c.logo_url} className="w-full h-full object-cover rounded-lg" alt="" />
                            : <Building2 size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.email || 'Sin email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{c.nit || '--'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        c.subscription_plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' :
                        c.subscription_plan === 'PRO'        ? 'bg-blue-100 text-blue-700'   :
                                                               'bg-slate-100 text-slate-700'
                      }`}>
                        {c.subscription_plan || 'BASIC'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {c.subscription_status === 'ACTIVE' ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="text-sm text-green-600 font-medium">Activa</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle size={14} className="text-red-500" />
                          <span className="text-sm text-red-600 font-medium">Inactiva</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-bold text-sm">
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewCompanyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Registrar Nueva Empresa</h3>
              <button onClick={() => setShowNewCompanyModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Empresa *</label>
                  <input
                    type="text" required
                    value={newCompany.name}
                    onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIT / Identificacion *</label>
                  <input
                    type="text" required
                    value={newCompany.nit}
                    onChange={e => setNewCompany({...newCompany, nit: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                  <input
                    type="text"
                    value={newCompany.phone}
                    onChange={e => setNewCompany({...newCompany, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    value={newCompany.email}
                    onChange={e => setNewCompany({...newCompany, email: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                  <input
                    type="text"
                    value={newCompany.address}
                    onChange={e => setNewCompany({...newCompany, address: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Crear Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAdmin;
