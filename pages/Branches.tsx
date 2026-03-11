/**
 * Branches.tsx — Gestión de Sucursales (Plan PRO / ENTERPRISE)
 * CAMBIOS principales:
 *  1. El negocio principal cuenta como Sucursal #1 en el contador.
 *  2. Creación por CÓDIGO DE ACTIVACIÓN (no email/password del admin).
 *  3. Modal post-creación con link + código para compartir.
 *  4. Columna "Estado Activación" muestra si ya tiene admin.
 *  5. Botón "Nuevo código" para sucursales sin activar.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDatabase } from '../contexts/DatabaseContext';
import { toast } from 'react-hot-toast';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  general: 'Tienda General', tienda_tecnologia: 'Tecnología / Celulares',
  restaurante: 'Restaurante / Cafetería', ropa: 'Ropa / Calzado',
  zapateria: 'Zapatería / Marroquinería', ferreteria: 'Ferretería / Construcción',
  farmacia: 'Farmacia / Droguería', supermercado: 'Supermercado / Abarrotes',
  salon: 'Salón de Belleza / Spa', odontologia: 'Consultorio Odontológico',
  veterinaria: 'Clínica Veterinaria', otro: 'Negocio',
};

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const Branches: React.FC = () => {
  const { company, isLoading: ctxLoading } = useDatabase();
  const [branches, setBranches] = useState<any[]>([]);
  const [branchAdminCounts, setBranchAdminCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createdBranch, setCreatedBranch] = useState<{ name: string; id: string; code: string } | null>(null);

  const [form, setForm] = useState({ name: '', nit: '', phone: '', business_type: '', accessCode: generateCode() });
  const [editForm, setEditForm] = useState({ name: '', nit: '', email: '', phone: '', address: '', subscription_status: 'ACTIVE', business_type: 'general' });

  const isPro = ['PRO', 'MASTER', 'ENTERPRISE'].includes(company?.subscription_plan || '');
  const MAX_BRANCHES = 3;
  const totalCount = 1 + branches.length; // negocio principal = 1

  const parentBusinessType = (company as any)?.config?.business_type
    || (Array.isArray((company as any)?.config?.business_types) ? (company as any).config.business_types[0] : null)
    || 'general';
  const parentTypeLabel = BUSINESS_TYPE_LABELS[parentBusinessType] || 'Negocio';

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').eq('negocio_padre_id', company.id).order('created_at', { ascending: false });
    const rows = data || [];
    setBranches(rows);
    if (rows.length > 0) {
      const ids = rows.map((r: any) => r.id);
      const { data: profiles } = await supabase.from('profiles').select('company_id').in('company_id', ids).eq('role', 'ADMIN');
      const counts: Record<string, number> = {};
      (profiles || []).forEach((p: any) => { counts[p.company_id] = (counts[p.company_id] || 0) + 1; });
      setBranchAdminCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [company?.id]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const fe = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (totalCount >= MAX_BRANCHES) { toast.error('Límite de 3 sucursales alcanzado (incluye tu negocio principal).'); return; }
    if (!form.name || !form.nit) { toast.error('Completa nombre y NIT'); return; }
    const code = form.accessCode.trim().toUpperCase() || generateCode();
    setCreating(true);
    try {
      const { data: newCompany, error: companyError } = await supabase.from('companies').insert({
        name: form.name, nit: form.nit, phone: form.phone,
        email: company?.email || null, // hereda el email del negocio padre
        subscription_plan: (company as any)?.subscription_plan || 'PRO', subscription_status: 'ACTIVE',
        tipo: 'sucursal', negocio_padre_id: company!.id,
        config: {
          tax_rate: (company as any)?.config?.tax_rate ?? 19,
          currency_symbol: (company as any)?.config?.currency_symbol ?? '$',
          invoice_prefix: 'POS',
          business_type: form.business_type || parentBusinessType,
          business_types: [form.business_type || parentBusinessType],
        },
      }).select().single();
      if (companyError) throw companyError;

      // NO creamos branches aquí — cada sucursal es una company independiente,
      // el modelo kiosk no usa la tabla branches para esto.

      const { error: codeErr } = await supabase.from('branch_access_codes').insert({
        company_id: newCompany.id, code, expires_at: null, used_at: null,
      });
      if (codeErr) console.warn('branch_access_codes:', codeErr.message);

      toast.success(`Sucursal "${form.name}" creada`);
      setShowCreate(false);
      setCreatedBranch({ name: form.name, id: newCompany.id, code });
      setForm({ name: '', nit: '', phone: '', business_type: '', accessCode: generateCode() });
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    const updatedConfig = { ...(selected.config || {}), business_type: editForm.business_type, business_types: [editForm.business_type] };
    const { error } = await supabase.from('companies').update({ name: editForm.name, nit: editForm.nit, email: editForm.email, phone: editForm.phone, address: editForm.address, subscription_status: editForm.subscription_status, config: updatedConfig }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Sucursal actualizada');
    setShowEdit(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const { id, name } = confirmDeleteId;

      // 1. Borrar items de facturas
      const { data: invIds } = await supabase.from('invoices').select('id').eq('company_id', id);
      if (invIds?.length) await supabase.from('invoice_items').delete().in('invoice_id', invIds.map((r: any) => r.id));

      // 2. Borrar datos que tienen FK hacia branches.id (hay que borrar antes de branches)
      //    Obtenemos las branch.id de esa company
      const { data: branchRows } = await supabase.from('branches').select('id').eq('company_id', id);
      const branchIds = (branchRows || []).map((b: any) => b.id);
      if (branchIds.length) {
        await supabase.from('inventory_items').delete().in('branch_id', branchIds);
        await supabase.from('cash_register_sessions').delete().in('branch_id', branchIds);
        await supabase.from('repair_orders').delete().in('branch_id', branchIds);
        await supabase.from('cash_registers').delete().in('branch_id', branchIds);
      }

      // 3. Resto de datos por company_id
      await supabase.from('invoices').delete().eq('company_id', id);
      await supabase.from('products').delete().eq('company_id', id);
      await supabase.from('customers').delete().eq('company_id', id);
      await supabase.from('profiles').delete().eq('company_id', id);
      await supabase.from('branches').delete().eq('company_id', id);
      await supabase.from('branch_access_codes').delete().eq('company_id', id);

      // 4. Finalmente la company
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Sucursal "${name}" eliminada`);
      setConfirmDeleteId(null);
      load();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    finally { setDeleting(false); }
  };

  const handleSuspend = async (id: string, current: string) => {
    const newStatus = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await supabase.from('companies').update({ subscription_status: newStatus }).eq('id', id);
    toast.success(newStatus === 'ACTIVE' ? 'Sucursal activada' : 'Sucursal suspendida');
    load();
  };

  const handleRegenCode = async (branchId: string, branchName: string) => {
    const code = generateCode();
    const { error } = await supabase.from('branch_access_codes')
      .upsert({ company_id: branchId, code, used_at: null, expires_at: null }, { onConflict: 'company_id' });
    if (error) { toast.error('Error al regenerar: ' + error.message); return; }
    setCreatedBranch({ name: branchName, id: branchId, code });
    toast.success('Nuevo código generado');
  };

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    ACTIVE: { bg: '#dcfce7', color: '#16a34a', label: 'Activo' },
    INACTIVE: { bg: '#fee2e2', color: '#dc2626', label: 'Inactivo' },
    PENDING: { bg: '#fef9c3', color: '#ca8a04', label: 'Pendiente' },
    PAST_DUE: { bg: '#ffedd5', color: '#ea580c', label: 'Vencido' },
  };

  const filtered = branches
    .filter(b => filter === 'ALL' || b.subscription_status === filter)
    .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.nit || '').includes(search));

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#1e293b' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 5 };

  if (ctxLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!isPro) return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-4xl">🏪</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-3">Función exclusiva del Plan PRO</h2>
      <p className="text-slate-500 mb-6 max-w-md">Con el Plan PRO gestionas hasta 3 sucursales (tu negocio principal + 2 adicionales), cada una con su propio panel, inventario y equipo.</p>
      <a href="https://wa.me/573204884943?text=Hola, quiero actualizar mi plan a PRO en POSmaster" target="_blank" rel="noreferrer"
        className="flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors">
        💬 Actualizar a PRO
      </a>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ─── Modal: Sucursal creada — Mostrar código + link ─────────────── */}
      {createdBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white text-center">
              <div className="text-5xl mb-2">🏪</div>
              <h3 className="text-xl font-bold">¡Sucursal lista!</h3>
              <p className="text-blue-100 text-sm mt-1">{createdBranch.name}</p>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm mb-5 text-center">
                Comparte el <strong>link</strong> y el <strong>código</strong> con el administrador de esta sucursal.
                Solo necesita usarlos una vez para activar su cuenta.
              </p>
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 mb-4 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Código de activación</p>
                <p className="text-3xl font-black tracking-widest text-slate-800 font-mono">{createdBranch.code}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 mb-5">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Link de activación</p>
                <p className="text-xs text-slate-600 break-all font-mono">{window.location.origin}/#/sucursal-acceso/{createdBranch.id}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const text = `🏪 *${createdBranch.name}* — POSmaster\n\nLink:\n${window.location.origin}/#/sucursal-acceso/${createdBranch.id}\n\nCódigo: *${createdBranch.code}*\n\nAbre el link, ingresa el código y crea tu cuenta.`;
                    navigator.clipboard.writeText(text).then(() => toast.success('✓ Copiado'));
                  }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 text-sm">
                  📋 Copiar todo
                </button>
                <button onClick={() => setCreatedBranch(null)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-sm">
                  ✓ Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis Sucursales</h1>
          <p className="text-slate-500 text-sm">
            {totalCount}/{MAX_BRANCHES} sucursales usadas · Plan PRO
            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
              Tu negocio principal = Sucursal 1
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            if (totalCount >= MAX_BRANCHES) { toast.error('Límite de 3 sucursales alcanzado.'); return; }
            setForm(p => ({ ...p, name: `${parentTypeLabel} — Sucursal ${totalCount + 1}`, nit: company?.nit || '', business_type: parentBusinessType, accessCode: generateCode() }));
            setShowCreate(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          + Nueva Sucursal
        </button>
      </div>

      {/* Barra progreso */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-600">Sucursales (incluyendo negocio principal)</span>
          <span className="text-sm font-bold text-slate-800">{totalCount} / {MAX_BRANCHES}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${(totalCount / MAX_BRANCHES) * 100}%`, background: totalCount >= MAX_BRANCHES ? '#ef4444' : totalCount === 2 ? '#f97316' : '#3b82f6' }} />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">🏠 {company?.name} (Principal)</span>
          {branches.map(b => (
            <span key={b.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">🏪 {b.name}</span>
          ))}
        </div>
        {totalCount >= MAX_BRANCHES && <p className="text-xs text-red-500 font-semibold mt-2">Límite máximo alcanzado. Actualiza a Enterprise para más sucursales.</p>}
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'ACTIVE', 'PENDING', 'PAST_DUE', 'INACTIVE'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${filter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
              {s === 'ALL' ? 'Todos' : s === 'ACTIVE' ? 'Activos' : s === 'PENDING' ? 'Pendientes' : s === 'PAST_DUE' ? 'Vencidos' : 'Inactivos'}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar sucursal..."
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none w-52" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Negocio', 'Tipo', 'NIT', 'Activación', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  No hay sucursales adicionales.{' '}
                  {totalCount < MAX_BRANCHES && <button onClick={() => { setForm(p => ({ ...p, name: `${parentTypeLabel} — Sucursal 2`, nit: company?.nit || '', business_type: parentBusinessType, accessCode: generateCode() })); setShowCreate(true); }} className="text-blue-600 font-semibold underline">Crear la primera</button>}
                </td></tr>
              ) : filtered.map(b => {
                const st = statusColors[b.subscription_status] || statusColors['INACTIVE'];
                const isActivated = (branchAdminCounts[b.id] || 0) > 0;
                const accessLink = isActivated
                  ? `${window.location.origin}/#/kiosk/${b.id}`
                  : `${window.location.origin}/#/sucursal-acceso/${b.id}`;
                return (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-800">{b.name}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                        {BUSINESS_TYPE_LABELS[b.config?.business_type || 'general'] || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">{b.nit}</td>
                    <td className="px-5 py-4">
                      {isActivated
                        ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full font-bold">✓ Con admin</span>
                        : <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-bold">⏳ Sin activar</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      <span style={{ background: st.bg, color: st.color }} className="px-2.5 py-1 rounded-full text-xs font-bold">{st.label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { navigator.clipboard.writeText(accessLink).then(() => toast.success('🔗 Link copiado')); }}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                          🔗 Link
                        </button>
                        <button onClick={() => window.open(accessLink, '_blank')}
                          className="px-3 py-1.5 text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100">
                          ↗ Abrir
                        </button>
                        {/* Botón Equipo — abre el panel admin de la sucursal directo en /team */}
                        <button onClick={() => {
                          // Guardamos que queremos ir a /team al abrir la sucursal
                          sessionStorage.setItem(`branch_initial_path_${b.id}`, '/team');
                          window.open(`${window.location.origin}/#/sucursal/${b.id}`, '_blank');
                        }}
                          className="px-3 py-1.5 text-xs font-bold text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">
                          👥 Equipo
                        </button>
                        {!isActivated && (
                          <button onClick={() => handleRegenCode(b.id, b.name)}
                            className="px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
                            🔑 Código
                          </button>
                        )}
                        <button onClick={() => { setSelected(b); setEditForm({ name: b.name, nit: b.nit || '', email: b.email || '', phone: b.phone || '', address: b.address || '', subscription_status: b.subscription_status, business_type: b.config?.business_type || parentBusinessType }); setShowEdit(true); }}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                          ✏️ Editar
                        </button>
                        <button onClick={() => handleSuspend(b.id, b.subscription_status)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${b.subscription_status === 'ACTIVE' ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100'}`}>
                          {b.subscription_status === 'ACTIVE' ? '⏸' : '✓'}
                        </button>
                        <button onClick={() => setConfirmDeleteId({ id: b.id, name: b.name })}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                          🗑️
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

      {/* Modal Confirmar Eliminar */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 p-5 flex items-center gap-3">
              <div className="text-white text-2xl">⚠️</div>
              <div><h3 className="font-bold text-white">Eliminar sucursal</h3><p className="text-xs text-red-200">Esta acción no se puede deshacer</p></div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-sm mb-4">¿Eliminar permanentemente <strong>"{confirmDeleteId.name}"</strong>?</p>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-5">
                <p className="text-xs text-red-700">Se eliminarán todos los datos de la sucursal (inventario, ventas, clientes, usuarios).</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-bold text-sm">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
                  {deleting ? '⏳ Eliminando...' : '🗑️ Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Nueva Sucursal</h3>
                <p className="text-xs text-slate-400">Sucursal {totalCount + 1} de {MAX_BRANCHES} · Plan PRO</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {[
                { label: 'Nombre *', key: 'name', placeholder: `${parentTypeLabel} — Sucursal Norte` },
                { label: 'NIT / Cédula *', key: 'nit', placeholder: '900123456-7' },
                { label: 'Teléfono', key: 'phone', placeholder: '300 123 4567' },
              ].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input value={(form as any)[field.key]} onChange={f(field.key)} placeholder={field.placeholder} style={inputStyle} />
                </div>
              ))}

              <div>
                <label style={labelStyle}>Tipo de negocio</label>
                <select value={form.business_type || parentBusinessType} onChange={f('business_type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(BUSINESS_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>

              {/* Código de activación */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Código de Activación</p>
                <p className="text-xs text-slate-400 mb-3">
                  El administrador de la sucursal usará este código una sola vez para crear su cuenta.
                  No necesitas proporcionarle email ni contraseña.
                </p>
                <label style={labelStyle}>Código (8 caracteres)</label>
                <div className="flex gap-2">
                  <input
                    value={form.accessCode}
                    onChange={e => setForm(p => ({ ...p, accessCode: e.target.value.toUpperCase().slice(0, 8) }))}
                    placeholder="AB12CD34" maxLength={8}
                    style={{ ...inputStyle, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, fontSize: 18, textAlign: 'center' }}
                  />
                  <button type="button" onClick={() => setForm(p => ({ ...p, accessCode: generateCode() }))}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 whitespace-nowrap flex-shrink-0">
                    🔄 Nuevo
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Cancelar</button>
                <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60">
                  {creating ? 'Creando...' : 'Crear Sucursal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEdit && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Editar: {selected.name}</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {[{ label: 'Nombre', key: 'name' }, { label: 'NIT / Cédula', key: 'nit' }, { label: 'Email', key: 'email' }, { label: 'Teléfono', key: 'phone' }, { label: 'Dirección', key: 'address' }].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input value={(editForm as any)[field.key]} onChange={fe(field.key)} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Tipo de negocio</label>
                <select value={editForm.business_type} onChange={fe('business_type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(BUSINESS_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select value={editForm.subscription_status} onChange={fe('subscription_status')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="PENDING">Pendiente</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Cancelar</button>
                <button onClick={handleEdit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;