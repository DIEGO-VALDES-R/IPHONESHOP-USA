import React, { useState, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { supabase } from '../supabaseClient';
import {
  Building2, Plus, Users, Shield, CheckCircle2, XCircle, Search,
  Edit3, ToggleLeft, ToggleRight, X, Calendar, Crown, Wrench,
  ChevronDown, ChevronUp, Tag, CreditCard, Settings2, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const PLAN_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  TRIAL:      { label: '7 días gratis', color: 'text-green-700',  bg: 'bg-green-100',  icon: '🎁' },
  BASIC:      { label: 'Basic',         color: 'text-slate-700',  bg: 'bg-slate-100',  icon: '📦' },
  PRO:        { label: 'Pro',           color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '⭐' },
  ENTERPRISE: { label: 'Enterprise',   color: 'text-purple-700', bg: 'bg-purple-100', icon: '🏢' },
};

const BUSINESS_TYPES = [
  { id: 'general',           label: '🏪 Tienda General' },
  { id: 'tienda_tecnologia', label: '📱 Tecnología / Celulares' },
  { id: 'restaurante',       label: '🍽️ Restaurante / Cafetería' },
  { id: 'ropa',              label: '👗 Ropa / Calzado' },
  { id: 'zapateria',         label: '👟 Zapatería / Marroquinería' },
  { id: 'ferreteria',        label: '🔧 Ferretería / Construcción' },
  { id: 'farmacia',          label: '💊 Farmacia / Droguería' },
  { id: 'supermercado',      label: '🛒 Supermercado / Abarrotes' },
  { id: 'salon',             label: '💇 Salón de Belleza / Spa' },
  { id: 'odontologia',       label: '🦷 Consultorio Odontológico' },
  { id: 'otro',              label: '📦 Otro' },
];

const PAYMENT_METHODS = [
  { id: 'cash',      label: 'Efectivo',            icon: '💵', plans: ['BASIC','PRO','ENTERPRISE','TRIAL'] },
  { id: 'transfer',  label: 'Transferencia / PSE',  icon: '🏛️', plans: ['BASIC','PRO','ENTERPRISE','TRIAL'] },
  { id: 'wompi',     label: 'Wompi',               icon: '🏦', plans: ['PRO','ENTERPRISE'] },
  { id: 'bold',      label: 'Bold',                icon: '⚡', plans: ['ENTERPRISE'] },
  { id: 'payu',      label: 'PayU',                icon: '💳', plans: ['ENTERPRISE'] },
  { id: 'dataphone', label: 'Datáfono físico',      icon: '📟', plans: ['ENTERPRISE'] },
];

const EMPTY_COMPANY = {
  name: '', nit: '', email: '', phone: '', address: '',
  subscription_plan: 'BASIC', subscription_status: 'ACTIVE',
  subscription_start_date: new Date().toISOString().split('T')[0],
  subscription_end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
};

// ── SUPPORT PANEL ─────────────────────────────────────────────────────────────
const SupportPanel: React.FC<{ company: any; onClose: () => void; onSaved: () => void }> = ({ company, onClose, onSaved }) => {
  const plan = company.subscription_plan || 'BASIC';
  const cfg  = company.config || {};

  const maxTypes = plan === 'ENTERPRISE' ? 99 : plan === 'PRO' ? 3 : 1;

  // Business types
  const parseTypes = (c: any): string[] => {
    if (Array.isArray(c?.business_types)) return c.business_types;
    if (c?.business_type) return [c.business_type];
    return ['general'];
  };
  const [businessTypes, setBusinessTypes] = useState<string[]>(parseTypes(cfg));

  // Payment providers
  const defaultProviders: Record<string, any> = {
    cash:      { enabled: true,  label: 'Efectivo',            icon: '💵' },
    transfer:  { enabled: false, label: 'Transferencia / PSE', icon: '🏛️', bank_name: '', account_number: '', account_type: 'ahorros' },
    wompi:     { enabled: false, label: 'Wompi',               icon: '🏦', pub_key: '', env: 'prod' },
    bold:      { enabled: false, label: 'Bold',                icon: '⚡', api_key: '' },
    payu:      { enabled: false, label: 'PayU',                icon: '💳', merchant_id: '', api_key: '', api_login: '' },
    dataphone: { enabled: false, label: 'Datáfono físico',     icon: '📟', acquirer: 'redeban', note: '' },
  };
  const [providers, setProviders] = useState<Record<string, any>>(
    cfg.payment_providers ? { ...defaultProviders, ...cfg.payment_providers } : defaultProviders
  );
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'tipos' | 'pagos'>('tipos');

  const toggleType = (id: string) => {
    setBusinessTypes(prev => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter(t => t !== id);
      if (plan === 'BASIC') return [id]; // swap
      if (prev.length >= maxTypes) {
        toast.error(`El plan ${plan} permite hasta ${maxTypes} tipos`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const newConfig = {
      ...cfg,
      business_type:  businessTypes[0] || 'general',
      business_types: businessTypes,
      payment_providers: providers,
    };
    const { error } = await supabase.from('companies')
      .update({ config: newConfig })
      .eq('id', company.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ Configuración de "${company.name}" actualizada`);
    onSaved();
    onClose();
  };

  const Section: React.FC<{ id: 'tipos' | 'pagos'; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => (
    <button onClick={() => setActiveSection(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeSection === id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg,#1e293b,#334155)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wrench size={18} className="text-blue-400" />
              <span className="text-blue-300 text-xs font-bold uppercase tracking-wider">Soporte al cliente</span>
            </div>
            <h3 className="text-lg font-bold text-white">{company.name}</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {PLAN_META[plan]?.icon} Plan {PLAN_META[plan]?.label} · NIT {company.nit}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-100 bg-slate-50">
          <Section id="tipos" label="Tipo de negocio" icon={<Tag size={15} />} />
          <Section id="pagos" label="Métodos de pago"  icon={<CreditCard size={15} />} />
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ── TIPOS DE NEGOCIO ── */}
          {activeSection === 'tipos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-700">Tipo(s) de negocio activos</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {plan === 'BASIC' ? 'Plan BASIC: 1 tipo (swap automático al cambiar)' :
                     plan === 'PRO'   ? `Plan PRO: hasta 3 tipos · ${businessTypes.length}/3 seleccionados` :
                                        'Plan ENTERPRISE: sin límite'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${PLAN_META[plan].bg} ${PLAN_META[plan].color}`}>
                  {PLAN_META[plan].icon} {PLAN_META[plan].label}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {BUSINESS_TYPES.map(bt => {
                  const isSelected = businessTypes.includes(bt.id);
                  const isLocked   = plan === 'PRO' && !isSelected && businessTypes.length >= 3;
                  return (
                    <button key={bt.id} onClick={() => toggleType(bt.id)} disabled={isLocked}
                      className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all relative ${
                        isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' :
                        isLocked   ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' :
                                     'border-slate-200 hover:border-blue-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {bt.label}
                      {isSelected && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</span>}
                      {isLocked   && <span className="absolute top-1.5 right-1.5 text-[11px]">🔒</span>}
                    </button>
                  );
                })}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <strong>⚙️ Efecto inmediato:</strong> Al guardar, el menú lateral del cliente cambiará automáticamente para mostrar solo los módulos del tipo de negocio seleccionado.
              </div>
            </div>
          )}

          {/* ── MÉTODOS DE PAGO ── */}
          {activeSection === 'pagos' && (
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-slate-700">Métodos de pago habilitados</p>
                <p className="text-xs text-slate-400 mt-0.5">Los métodos marcados con 🔒 requieren un plan superior</p>
              </div>

              {PAYMENT_METHODS.map(pm => {
                const allowed   = pm.plans.includes(plan);
                const provData  = providers[pm.id] || {};
                const isEnabled = allowed && !!provData.enabled;

                return (
                  <div key={pm.id} className={`rounded-xl border p-4 transition-all ${isEnabled ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'} ${!allowed ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{pm.icon}</span>
                        <div>
                          <p className="font-semibold text-slate-700 text-sm">{pm.label}</p>
                          {!allowed && <p className="text-xs text-slate-400">🔒 Requiere plan {pm.plans[pm.plans.length - 1]}</p>}
                        </div>
                      </div>
                      <button disabled={!allowed}
                        onClick={() => setProviders(prev => ({ ...prev, [pm.id]: { ...prev[pm.id], enabled: !prev[pm.id]?.enabled } }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-slate-200'} ${!allowed ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {/* Campos específicos */}
                    {isEnabled && pm.id === 'transfer' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input placeholder="Banco" value={provData.bank_name || ''} onChange={e => setProviders(p => ({ ...p, transfer: { ...p.transfer, bank_name: e.target.value } }))}
                          className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                        <input placeholder="Número de cuenta" value={provData.account_number || ''} onChange={e => setProviders(p => ({ ...p, transfer: { ...p.transfer, account_number: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                        <select value={provData.account_type || 'ahorros'} onChange={e => setProviders(p => ({ ...p, transfer: { ...p.transfer, account_type: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300 bg-white">
                          <option value="ahorros">Ahorros</option>
                          <option value="corriente">Corriente</option>
                        </select>
                      </div>
                    )}
                    {isEnabled && pm.id === 'wompi' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input placeholder="Public key" value={provData.pub_key || ''} onChange={e => setProviders(p => ({ ...p, wompi: { ...p.wompi, pub_key: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                        <select value={provData.env || 'prod'} onChange={e => setProviders(p => ({ ...p, wompi: { ...p.wompi, env: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white">
                          <option value="prod">Producción</option>
                          <option value="sandbox">Sandbox</option>
                        </select>
                      </div>
                    )}
                    {isEnabled && pm.id === 'bold' && (
                      <input placeholder="API Key de Bold" value={provData.api_key || ''} onChange={e => setProviders(p => ({ ...p, bold: { ...p.bold, api_key: e.target.value } }))}
                        className="mt-3 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                    )}
                    {isEnabled && pm.id === 'payu' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input placeholder="Merchant ID" value={provData.merchant_id || ''} onChange={e => setProviders(p => ({ ...p, payu: { ...p.payu, merchant_id: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                        <input placeholder="API Login" value={provData.api_login || ''} onChange={e => setProviders(p => ({ ...p, payu: { ...p.payu, api_login: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                        <input placeholder="API Key" value={provData.api_key || ''} onChange={e => setProviders(p => ({ ...p, payu: { ...p.payu, api_key: e.target.value } }))}
                          className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                      </div>
                    )}
                    {isEnabled && pm.id === 'dataphone' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <select value={provData.acquirer || 'redeban'} onChange={e => setProviders(p => ({ ...p, dataphone: { ...p.dataphone, acquirer: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white">
                          <option value="redeban">Redeban</option>
                          <option value="credibanco">Credibanco</option>
                          <option value="otro">Otro</option>
                        </select>
                        <input placeholder="Nota interna" value={provData.note || ''} onChange={e => setProviders(p => ({ ...p, dataphone: { ...p.dataphone, note: e.target.value } }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 text-sm flex items-center justify-center gap-2">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Settings2 size={14} /> Guardar configuración</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const MasterAdmin: React.FC = () => {
  const { userRole } = useDatabase();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');

  const [showNewModal, setShowNewModal]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [showSupport, setShowSupport]       = useState(false);
  const [newCompany, setNewCompany]         = useState({ ...EMPTY_COMPANY });
  const [editCompany, setEditCompany]       = useState<any>(null);
  const [supportCompany, setSupportCompany] = useState<any>(null);
  const [saving, setSaving]                 = useState(false);

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
      name: newCompany.name, nit: newCompany.nit, email: newCompany.email,
      phone: newCompany.phone, address: newCompany.address,
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
    const isTrial = editCompany.subscription_plan === 'TRIAL';
    // Auto fecha de vencimiento para TRIAL (7 días desde hoy si no tiene)
    const endDate = isTrial && !editCompany.subscription_end_date
      ? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      : editCompany.subscription_end_date || null;
    const { error } = await supabase.from('companies').update({
      name: editCompany.name, nit: editCompany.nit, email: editCompany.email,
      phone: editCompany.phone, address: editCompany.address,
      subscription_plan:       editCompany.subscription_plan,
      subscription_status:     editCompany.subscription_status,
      subscription_start_date: editCompany.subscription_start_date || null,
      subscription_end_date:   endDate,
    }).eq('id', editCompany.id);
    setSaving(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(isTrial ? '🎁 Plan Gratis activado (7 días)' : 'Empresa actualizada');
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

  const openSupport = (c: any) => {
    setSupportCompany(c);
    setShowSupport(true);
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

      <div>
        <label className={labelCls}>Plan de suscripción</label>
        <div className="grid grid-cols-2 gap-2">
          {(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'] as const).map(p => {
            const meta = PLAN_META[p];
            const active = data.subscription_plan === p;
            return (
              <button key={p} type="button" onClick={() => setData({
                  ...data,
                  subscription_plan: p,
                  // Al elegir TRIAL, poner status en TRIAL automáticamente; al salir, volver a ACTIVE
                  subscription_status: p === 'TRIAL' ? 'TRIAL' : data.subscription_status === 'TRIAL' ? 'ACTIVE' : data.subscription_status,
                })}
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

      <div>
        <label className={labelCls}>Estado</label>
        <select value={data.subscription_status} onChange={e => setData({ ...data, subscription_status: e.target.value })} className={inputCls}>
          <option value="ACTIVE">Activa</option>
          <option value="INACTIVE">Inactiva</option>
          <option value="PAST_DUE">Vencida</option>
          <option value="TRIAL">Prueba</option>
        </select>
      </div>

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Empresas',  value: stats.total,      icon: <Building2 size={22} />,    color: 'blue'   },
          { label: 'Activas',         value: stats.active,     icon: <CheckCircle2 size={22} />, color: 'green'  },
          { label: 'Enterprise',      value: stats.enterprise, icon: <Crown size={22} />,        color: 'purple' },
          { label: 'Total Usuarios',  value: stats.users,      icon: <Users size={22} />,        color: 'slate'  },
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <h2 className="font-bold text-slate-800 flex-1">Clientes / Empresas</h2>
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'].map(p => (
              <button key={p} onClick={() => setFilterPlan(p)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterPlan === p
                  ? p === 'ENTERPRISE' ? 'bg-purple-600 text-white' : p === 'PRO' ? 'bg-blue-600 text-white'
                    : p === 'TRIAL' ? 'bg-green-600 text-white' : p === 'BASIC' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-white'
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
                const meta    = PLAN_META[c.subscription_plan] || PLAN_META['BASIC'];
                const expired = c.subscription_end_date && c.subscription_end_date < new Date().toISOString();
                const cfg     = c.config || {};
                const types: string[] = Array.isArray(cfg.business_types) ? cfg.business_types : cfg.business_type ? [cfg.business_type] : ['general'];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0">
                          {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover rounded-lg" alt="" /> : <Building2 size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400">
                            {types.map((t: string) => BUSINESS_TYPES.find(b => b.id === t)?.label || t).join(' · ')}
                          </p>
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
                        : <span className="flex items-center gap-1 text-sm text-red-500 font-medium"><XCircle size={13} /> Inactiva</span>}
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
                      <div className="flex items-center justify-end gap-1">
                        {/* Soporte */}
                        <button onClick={() => openSupport(c)} title="Soporte / Configuración"
                          className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 transition-colors">
                          <Wrench size={15} />
                        </button>
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
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-bold disabled:opacity-60 ${editCompany.subscription_plan === 'ENTERPRISE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL SOPORTE */}
      {showSupport && supportCompany && (
        <SupportPanel
          company={supportCompany}
          onClose={() => { setShowSupport(false); setSupportCompany(null); }}
          onSaved={fetchCompanies}
        />
      )}
    </div>
  );
};

export default MasterAdmin;