import React, { useState, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../supabaseClient';
import { Building2, Plus, Users, Shield, CheckCircle2, XCircle, Search, Edit3, ToggleLeft, ToggleRight, X, Calendar, Crown } from 'lucide-react';
import { toast } from 'react-hot-toast';

const PLAN_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  TRIAL:      { label: '7 días gratis', color: 'text-green-700',  bg: 'bg-green-100',  icon: '🎁' },
  BASIC:      { label: 'Basic',         color: 'text-slate-700',  bg: 'bg-slate-100',  icon: '📦' },
  PRO:        { label: 'Pro',           color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '⭐' },
  ENTERPRISE: { label: 'Enterprise',   color: 'text-purple-700', bg: 'bg-purple-100', icon: '🏢' },
};

const EMPTY_COMPANY = {
  name: '', nit: '', email: '', phone: '', address: '',
  subscription_plan: 'BASIC', subscription_status: 'ACTIVE',
  subscription_start_date: new Date().toISOString().split('T')[0],
  subscription_end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
};

const MasterAdmin: React.FC = () => {
  const { userRole } = useDatabase();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');

  // Modals
  const [showNewModal, setShowNewModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCompany, setNewCompany]       = useState({ ...EMPTY_COMPANY });
  const [editCompany, setEditCompany]     = useState<any>(null);
  const [saving, setSaving]               = useState(false);

  useEffect(() => { if (userRole === 'MASTER') fetchCompanies(); }, [userRole]);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*, profiles(count)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Error al cargar empresas');
    else setCompanies(data || []);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('companies').insert([{
      name: newCompany.name,
      nit: newCompany.nit,
      email: newCompany.email,
      phone: newCompany.phone,
      address: newCompany.address,
      subscription_plan: newCompany.subscription_plan,
      subscription_status: newCompany.subscription_status,
      subscription_start_date: newCompany.subscription_start_date || null,
      subscription_end_date: newCompany.subscription_end_date || null,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Empresa creada');
    setShowNewModal(false);
    setNewCompany({ ...EMPTY_COMPANY });
    fetchCompanies();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany) return;
    setSaving(true);
    const { error } = await supabase.from('companies').update({
      name: editCompany.name,
      nit: editCompany.nit,
      email: editCompany.email,
      phone: editCompany.phone,
      address: editCompany.address,
      subscription_plan: editCompany.subscription_plan,
      subscription_status: editCompany.subscription_status,
      subscription_start_date: editCompany.subscription_start_date || null,
      subscription_end_date: editCompany.subscription_end_date || null,
    }).eq('id', editCompany.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Empresa actualizada');
    setShowEditModal(false);
    setEditCompany(null);
    fetchCompanies();
  };

  const toggleStatus = async (c: any) => {
    const next = c.subscription_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase.from('companies').update({ subscription_status: next }).eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Empresa ${next === 'ACTIVE' ? 'activada' : 'desactivada'}`);
    fetchCompanies();
  };

  const openEdit = (c: any) => {
    setEditCompany({
      ...c,
      subscription_start_date: c.subscription_start_date?.split('T')[0] || '',
      subscription_end_date:   c.subscription_end_date?.split('T')[0]   || '',
    });
    setShowEditModal(true);
  };

  if (userRole !== 'MASTER') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Shield size={48} className="mb-4 text-red-400" />
        <h1 className="text-2xl font-bold">Acceso Denegado</h1>
        <p>Esta página es solo para usuarios maestros.</p>
      </div>
    );
  }

  const filtered = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.nit || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlan = filterPlan === 'ALL' || c.subscription_plan === filterPlan;
    return matchSearch && matchPlan;
  });

  const stats = {
    total:      companies.length,
    active:     companies.filter(c => c.subscription_status === 'ACTIVE').length,
    enterprise: companies.filter(c => c.subscription_plan === 'ENTERPRISE').length,
    users:      companies.reduce((acc, c) => acc + (c.profiles?.[0]?.count || 0), 0),
  };

  const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white";
  const labelCls = "block text-sm font-semibold text-slate-600 mb-1";

  const PlanForm = ({ data, setData }: { data: any; setData: (v: any) => void }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Nombre de la Empresa *</label>
          <input required type="text" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>NIT / Identificación *</label>
          <input required type="text" value={data.nit} onChange={e => setData({ ...data, nit: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input type="text" value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Email</label>
          <input type="email" value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Dirección</label>
          <input type="text" value={data.address || ''} onChange={e => setData({ ...data, address: e.target.value })} className={inputCls} />
        </div>
      </div>

      {/* PLAN */}
      <div>
        <label className={labelCls}>Plan de suscripción</label>
        <div className="grid grid-cols-2 gap-2">
          {(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'] as const).map(p => {
            const meta = PLAN_META[p];
            const active = data.subscription_plan === p;
            return (
              <button key={p} type="button" onClick={() => setData({ ...data, subscription_plan: p })}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  active
                    ? p === 'ENTERPRISE' ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : p === 'PRO'      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : p === 'TRIAL'    ? 'border-green-500 bg-green-50 text-green-700'
                      :                   'border-slate-400 bg-slate-100 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}>
                <span>{meta.icon}</span> {meta.label}
                {active && <CheckCircle2 size={14} className="ml-auto" />}
              </button>
            );
          })}
        </div>
        {data.subscription_plan === 'ENTERPRISE' && (
          <div className="mt-2 p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 flex items-center gap-2">
            <Crown size={14} /> Sucursales ilimitadas · Usuarios ilimitados · DIAN · API · Soporte dedicado
          </div>
        )}
      </div>

      {/* ESTADO */}
      <div>
        <label className={labelCls}>Estado</label>
        <select value={data.subscription_status} onChange={e => setData({ ...data, subscription_status: e.target.value })}
          className={inputCls}>
          <option value="ACTIVE">Activa</option>
          <option value="INACTIVE">Inactiva</option>
          <option value="PAST_DUE">Vencida</option>
          <option value="TRIAL">Prueba</option>
        </select>
      </div>

      {/* FECHAS */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Inicio suscripción</label>
          <input type="date" value={data.subscription_start_date || ''} onChange={e => setData({ ...data, subscription_start_date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Vencimiento</label>
          <input type="date" value={data.subscription_end_date || ''} onChange={e => setData({ ...data, subscription_end_date: e.target.value })} className={inputCls} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Administración Maestro</h1>
          <p className="text-slate-500">Gestiona todos tus clientes y empresas desde un solo lugar.</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          <Plus size={20} /> Nueva Empresa
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Empresas',  value: stats.total,      icon: <Building2 size={22} />, color: 'blue'   },
          { label: 'Activas',         value: stats.active,     icon: <CheckCircle2 size={22}/>, color: 'green' },
          { label: 'Enterprise',      value: stats.enterprise, icon: <Crown size={22} />,    color: 'purple' },
          { label: 'Total Usuarios',  value: stats.users,      icon: <Users size={22} />,    color: 'slate'  },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl bg-${s.color}-50 text-${s.color}-600`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <h2 className="font-bold text-slate-800 flex-1">Clientes / Empresas</h2>
          {/* Filtro plan */}
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'].map(p => (
              <button key={p} onClick={() => setFilterPlan(p)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterPlan === p
                  ? p === 'ENTERPRISE' ? 'bg-purple-600 text-white'
                    : p === 'PRO'      ? 'bg-blue-600 text-white'
                    : p === 'TRIAL'    ? 'bg-green-600 text-white'
                    : p === 'BASIC'    ? 'bg-slate-600 text-white'
                    :                   'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {p === 'ALL' ? 'Todos' : PLAN_META[p]?.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar empresa o NIT..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">NIT</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Vencimiento</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No se encontraron empresas.</td></tr>
              ) : filtered.map(c => {
                const meta = PLAN_META[c.subscription_plan] || PLAN_META['BASIC'];
                const expired = c.subscription_end_date && c.subscription_end_date < new Date().toISOString();
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0">
                          {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover rounded-lg" alt="" /> : <Building2 size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-mono">{c.nit}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.bg} ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {c.subscription_status === 'ACTIVE'
                        ? <span className="flex items-center gap-1 text-sm text-green-600 font-medium"><CheckCircle2 size={13} /> Activa</span>
                        : c.subscription_status === 'PAST_DUE'
                        ? <span className="flex items-center gap-1 text-sm text-orange-500 font-medium"><XCircle size={13} /> Vencida</span>
                        : <span className="flex items-center gap-1 text-sm text-red-500 font-medium"><XCircle size={13} /> Inactiva</span>
                      }
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {c.subscription_end_date
                        ? <span className={expired ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                            <Calendar size={12} className="inline mr-1" />
                            {new Date(c.subscription_end_date).toLocaleDateString('es-CO')}
                          </span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} title="Editar"
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => toggleStatus(c)} title={c.subscription_status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                          className={`p-2 rounded-lg transition-colors ${c.subscription_status === 'ACTIVE' ? 'hover:bg-red-50 text-red-400' : 'hover:bg-green-50 text-green-500'}`}>
                          {c.subscription_status === 'ACTIVE' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVA EMPRESA */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Nueva Empresa</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-1">
              <PlanForm data={newCompany} setData={setNewCompany} />
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EMPRESA */}
      {showEditModal && editCompany && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Editar Empresa</h3>
                <p className="text-xs text-slate-400">{editCompany.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 overflow-y-auto space-y-1">
              <PlanForm data={editCompany} setData={setEditCompany} />
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-bold disabled:opacity-60 ${
                    editCompany.subscription_plan === 'ENTERPRISE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
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