import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Package, Wrench, Clock, CheckCircle, XCircle,
  Camera, Upload, Trash2, Edit2, X, RefreshCw, AlertCircle,
  User, Phone, FileText, Calendar, DollarSign, BarChart2,
  ChevronRight, History, ShoppingCart, Tag, Hammer
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useDatabase } from '../contexts/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ── TYPES ─────────────────────────────────────────────────────────────────────
type RepairStatus = 'RECEIVED' | 'ASSIGNED' | 'IN_REPAIR' | 'PENDING_DELIVERY' | 'DELIVERED' | 'CANCELLED';

interface ShoeRepairOrder {
  id: string;
  company_id: string;
  ticket_number: string;
  client_name: string;
  client_id: string;       // cédula
  client_phone: string;
  product_description: string;
  service_type: string;
  damage_description: string;
  received_at: string;
  estimated_delivery: string;
  estimated_price: number;
  deposit_amount: number;
  technician_id: string | null;
  technician_name: string | null;
  status: RepairStatus;
  photos: { before: string[]; during: string[]; after: string[] };
  notes: string;
  delivered_at: string | null;
  invoice_id: string | null;
  created_at: string;
}

interface RepairTechnician {
  id: string;
  company_id: string;
  name: string;
  specialty: string;
  is_active: boolean;
}

interface RepairMaterial {
  id: string;
  company_id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  is_active: boolean;
}

interface RepairHistoryEntry {
  id: string;
  repair_id: string;
  event: string;
  description: string;
  user_name: string;
  created_at: string;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  RECEIVED:         { label: 'Recibido',           color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: <Package size={13} /> },
  ASSIGNED:         { label: 'Asignado',            color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: <User size={13} /> },
  IN_REPAIR:        { label: 'En reparación',       color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <Hammer size={13} /> },
  PENDING_DELIVERY: { label: 'Pendiente entrega',   color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', icon: <Clock size={13} /> },
  DELIVERED:        { label: 'Entregado',           color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: <CheckCircle size={13} /> },
  CANCELLED:        { label: 'Cancelado',           color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={13} /> },
};

const SERVICE_TYPES = [
  'Cambio de suela', 'Cambio de tacón', 'Pegado de suela', 'Costura',
  'Limpieza profunda', 'Teñido', 'Cambio de plantilla', 'Reparación de cierre',
  'Cambio de hebilla', 'Restauración de cuero', 'Impermeabilización', 'Otro',
];

const TABS = [
  { id: 'reception', label: 'Recepción',    icon: <Package size={15} /> },
  { id: 'workshop',  label: 'Taller',        icon: <Hammer size={15} /> },
  { id: 'materials', label: 'Materiales',    icon: <Tag size={15} /> },
  { id: 'history',   label: 'Historial',     icon: <History size={15} /> },
  { id: 'reports',   label: 'Reportes',      icon: <BarChart2 size={15} /> },
] as const;
type TabId = typeof TABS[number]['id'];

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
const ShoeRepair: React.FC = () => {
  const { company } = useDatabase();
  const companyId   = company?.id;
  const brandColor  = (company?.config as any)?.primary_color || '#0284c7';
  const navigate    = useNavigate();

  const [activeTab, setActiveTab]     = useState<TabId>('reception');
  const [orders, setOrders]           = useState<ShoeRepairOrder[]>([]);
  const [technicians, setTechnicians] = useState<RepairTechnician[]>([]);
  const [materials, setMaterials]     = useState<RepairMaterial[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQ, setSearchQ]         = useState('');
  const [filterStatus, setFilterStatus] = useState<RepairStatus | 'ALL'>('ALL');

  // Modals
  const [showNewOrder,     setShowNewOrder]     = useState(false);
  const [showDetail,       setShowDetail]       = useState(false);
  const [showTechModal,    setShowTechModal]    = useState(false);
  const [showMatModal,     setShowMatModal]     = useState(false);
  const [showMatUse,       setShowMatUse]       = useState(false);
  const [detailOrder,      setDetailOrder]      = useState<ShoeRepairOrder | null>(null);
  const [orderHistory,     setOrderHistory]     = useState<RepairHistoryEntry[]>([]);
  const [editingTech,      setEditingTech]      = useState<RepairTechnician | null>(null);
  const [editingMat,       setEditingMat]       = useState<RepairMaterial | null>(null);

  // Forms
  const emptyOrder = { client_name: '', client_id: '', client_phone: '', product_description: '', service_type: SERVICE_TYPES[0], damage_description: '', estimated_delivery: '', estimated_price: '', deposit_amount: '', technician_id: '', notes: '' };
  const [orderForm,  setOrderForm]  = useState({ ...emptyOrder });
  const [techForm,   setTechForm]   = useState({ name: '', specialty: '' });
  const [matForm,    setMatForm]    = useState({ name: '', unit: 'und', stock: '', min_stock: '5', cost: '' });
  const [matUseForm, setMatUseForm] = useState({ material_id: '', quantity: '1' });
  const [saving, setSaving]         = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoType,      setPhotoType]      = useState<'before' | 'during' | 'after'>('before');
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const cameraRef     = useRef<HTMLInputElement>(null);

  // ── LOAD ─────────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('shoe_repair_orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setOrders((data || []) as ShoeRepairOrder[]);
  }, [companyId]);

  const loadTechs = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('shoe_repair_technicians').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
    setTechnicians((data || []) as RepairTechnician[]);
  }, [companyId]);

  const loadMaterials = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('shoe_repair_materials').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
    setMaterials((data || []) as RepairMaterial[]);
  }, [companyId]);

  const loadHistory = useCallback(async (repairId: string) => {
    const { data } = await supabase.from('shoe_repair_history').select('*').eq('repair_id', repairId).order('created_at', { ascending: false });
    setOrderHistory((data || []) as RepairHistoryEntry[]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOrders(), loadTechs(), loadMaterials()]);
    setLoading(false);
  }, [loadOrders, loadTechs, loadMaterials]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const addHistory = async (repairId: string, event: string, description: string) => {
    await supabase.from('shoe_repair_history').insert({
      repair_id: repairId, event, description, user_name: 'Admin', company_id: companyId,
    });
  };

  const nextTicket = () => `ZAP-${Date.now().toString().slice(-6)}`;

  // ── CREATE ORDER ──────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!companyId || !orderForm.client_name || !orderForm.product_description) {
      toast.error('Cliente y producto son obligatorios');
      return;
    }
    setSaving(true);
    const tech = technicians.find(t => t.id === orderForm.technician_id);
    const ticketNumber = nextTicket();
    const { data: order, error } = await supabase.from('shoe_repair_orders').insert({
      company_id: companyId,
      ticket_number: ticketNumber,
      client_name: orderForm.client_name,
      client_id: orderForm.client_id,
      client_phone: orderForm.client_phone,
      product_description: orderForm.product_description,
      service_type: orderForm.service_type,
      damage_description: orderForm.damage_description,
      received_at: new Date().toISOString(),
      estimated_delivery: orderForm.estimated_delivery || null,
      estimated_price: parseFloat(orderForm.estimated_price) || 0,
      deposit_amount: parseFloat(orderForm.deposit_amount) || 0,
      technician_id: orderForm.technician_id || null,
      technician_name: tech?.name || null,
      status: orderForm.technician_id ? 'ASSIGNED' : 'RECEIVED',
      photos: { before: [], during: [], after: [] },
      notes: orderForm.notes,
    }).select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    await addHistory(order.id, 'RECEPTION', `Recibido: ${orderForm.product_description}. Daño: ${orderForm.damage_description}`);
    if (tech) await addHistory(order.id, 'ASSIGNED', `Asignado a ${tech.name}`);
    toast.success(`✅ Ticket ${ticketNumber} creado — Abriendo POS...`);
    setShowNewOrder(false);
    setOrderForm({ ...emptyOrder });
    setSaving(false);
    loadOrders();

    // ── Redirigir al POS inmediatamente al crear la orden ──
    const estimatedPrice = parseFloat(orderForm.estimated_price) || 0;
    const depositAmount  = parseFloat(orderForm.deposit_amount)  || 0;
    const params = new URLSearchParams({
      shoe:     order.id,
      ticket:   ticketNumber,
      cliente:  orderForm.client_name,
      cedula:   orderForm.client_id    || '',
      tel:      orderForm.client_phone || '',
      email:    orderForm.client_phone || '',
      total:    String(estimatedPrice),
      abono:    String(depositAmount),
      servicio: orderForm.service_type,
    });
    navigate(`/pos?${params.toString()}`);
  };

  // ── UPDATE STATUS ─────────────────────────────────────────────────────────
  const updateStatus = async (order: ShoeRepairOrder, status: RepairStatus) => {
    const extra: Record<string, any> = {};
    if (status === 'DELIVERED') extra.delivered_at = new Date().toISOString();
    const { error } = await supabase.from('shoe_repair_orders').update({ status, ...extra }).eq('id', order.id);
    if (error) { toast.error(error.message); return; }
    await addHistory(order.id, 'STATUS_CHANGE', `Estado cambiado a: ${STATUS_CONFIG[status].label}`);
    toast.success(`Estado: ${STATUS_CONFIG[status].label}`);
    loadOrders();
    if (detailOrder?.id === order.id) {
      setDetailOrder(prev => prev ? { ...prev, status, ...extra } : null);
      loadHistory(order.id);
    }
  };

  // ── ASSIGN TECH ───────────────────────────────────────────────────────────
  const assignTech = async (orderId: string, techId: string) => {
    const tech = technicians.find(t => t.id === techId);
    if (!tech) return;
    await supabase.from('shoe_repair_orders').update({ technician_id: techId, technician_name: tech.name, status: 'ASSIGNED' }).eq('id', orderId);
    await addHistory(orderId, 'ASSIGNED', `Asignado a técnico: ${tech.name}`);
    toast.success(`Asignado a ${tech.name}`);
    loadOrders();
  };

  // ── PHOTOS ────────────────────────────────────────────────────────────────
  const handlePhotoUpload = async (file: File, order: ShoeRepairOrder, type: 'before' | 'during' | 'after') => {
    if (!file || !companyId) return;
    setUploadingPhoto(true);
    const ext  = file.name.split('.').pop();
    const path = `shoe-repairs/${order.id}/${type}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('company-logos').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Error subiendo foto'); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(path);
    const newPhotos = {
      ...order.photos,
      [type]: [...(order.photos?.[type] || []), urlData.publicUrl],
    };
    await supabase.from('shoe_repair_orders').update({ photos: newPhotos }).eq('id', order.id);
    await addHistory(order.id, 'PHOTO', `Foto ${type === 'before' ? 'antes' : type === 'during' ? 'durante' : 'después'} agregada`);
    toast.success('Foto subida');
    setUploadingPhoto(false);
    loadOrders();
    setDetailOrder(prev => prev ? { ...prev, photos: newPhotos } : null);
  };

  const deletePhoto = async (order: ShoeRepairOrder, type: 'before' | 'during' | 'after', idx: number) => {
    const newPhotos = { ...order.photos, [type]: order.photos[type].filter((_, i) => i !== idx) };
    await supabase.from('shoe_repair_orders').update({ photos: newPhotos }).eq('id', order.id);
    toast.success('Foto eliminada');
    loadOrders();
    setDetailOrder(prev => prev ? { ...prev, photos: newPhotos } : null);
  };

  // ── TECHNICIANS CRUD ──────────────────────────────────────────────────────
  const saveTech = async () => {
    if (!companyId || !techForm.name) { toast.error('Nombre requerido'); return; }
    setSaving(true);
    const payload = { company_id: companyId, name: techForm.name, specialty: techForm.specialty, is_active: true };
    const { error } = editingTech
      ? await supabase.from('shoe_repair_technicians').update(payload).eq('id', editingTech.id)
      : await supabase.from('shoe_repair_technicians').insert(payload);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(editingTech ? 'Técnico actualizado' : 'Técnico creado');
    setShowTechModal(false); setEditingTech(null); setTechForm({ name: '', specialty: '' });
    setSaving(false); loadTechs();
  };

  const deleteTech = async (id: string) => {
    if (!confirm('¿Eliminar técnico?')) return;
    await supabase.from('shoe_repair_technicians').update({ is_active: false }).eq('id', id);
    toast.success('Técnico eliminado'); loadTechs();
  };

  // ── MATERIALS CRUD ────────────────────────────────────────────────────────
  const saveMaterial = async () => {
    if (!companyId || !matForm.name) { toast.error('Nombre requerido'); return; }
    setSaving(true);
    const payload = { company_id: companyId, name: matForm.name, unit: matForm.unit, stock: parseFloat(matForm.stock) || 0, min_stock: parseFloat(matForm.min_stock) || 5, cost: parseFloat(matForm.cost) || 0, is_active: true };
    const { error } = editingMat
      ? await supabase.from('shoe_repair_materials').update(payload).eq('id', editingMat.id)
      : await supabase.from('shoe_repair_materials').insert(payload);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(editingMat ? 'Material actualizado' : 'Material creado');
    setShowMatModal(false); setEditingMat(null); setMatForm({ name: '', unit: 'und', stock: '', min_stock: '5', cost: '' });
    setSaving(false); loadMaterials();
  };

  const useMaterial = async () => {
    if (!detailOrder || !matUseForm.material_id) return;
    const mat = materials.find(m => m.id === matUseForm.material_id);
    const qty = parseFloat(matUseForm.quantity) || 1;
    if (!mat || mat.stock < qty) { toast.error('Stock insuficiente'); return; }
    setSaving(true);
    await supabase.from('shoe_repair_materials').update({ stock: mat.stock - qty }).eq('id', mat.id);
    await addHistory(detailOrder.id, 'MATERIAL', `Usado: ${mat.name} x${qty} ${mat.unit}`);
    toast.success(`${mat.name} x${qty} descontado`);
    setSaving(false); setShowMatUse(false); setMatUseForm({ material_id: '', quantity: '1' });
    loadMaterials(); loadHistory(detailOrder.id);
  };

  // ── COMPUTED ──────────────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const matchQ = !searchQ || o.client_name.toLowerCase().includes(searchQ.toLowerCase()) ||
      o.ticket_number.toLowerCase().includes(searchQ.toLowerCase()) ||
      o.product_description.toLowerCase().includes(searchQ.toLowerCase());
    const matchS = filterStatus === 'ALL' || o.status === filterStatus;
    return matchQ && matchS;
  });

  const activeOrders  = orders.filter(o => !['DELIVERED','CANCELLED'].includes(o.status));
  const todayDelivered = orders.filter(o => o.status === 'DELIVERED' && o.delivered_at && new Date(o.delivered_at).toDateString() === new Date().toDateString());
  const pendingDeposit = orders.filter(o => o.deposit_amount > 0 && !['DELIVERED','CANCELLED'].includes(o.status));
  const lowStock = materials.filter(m => m.stock <= m.min_stock);

  const totalRevenue = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.estimated_price, 0);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-slate-400 animate-pulse text-lg">Cargando taller...</div></div>;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-4">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Hammer size={24} style={{ color: brandColor }} /> Zapatería & Marroquinería
          </h1>
          <p className="text-slate-500 text-sm">Gestión de reparaciones de calzado</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow"
            style={{ background: brandColor }}>
            <Plus size={16} /> Nueva Orden
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Activas',          value: activeOrders.length,    color: brandColor, icon: <Wrench size={19} /> },
          { label: 'Entregadas hoy',   value: todayDelivered.length,  color: '#10b981',  icon: <CheckCircle size={19} /> },
          { label: 'Stock bajo',       value: lowStock.length,        color: '#ef4444',  icon: <AlertCircle size={19} /> },
          { label: 'Ingresos total',   value: fmt(totalRevenue),      color: '#3b82f6',  icon: <DollarSign size={19} /> },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: k.color + '18', color: k.color }}>{k.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-xl font-bold text-slate-800">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: RECEPCIÓN ═══════ */}
      {activeTab === 'reception' && (
        <div className="flex flex-col gap-3 flex-1">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar ticket, cliente..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-300" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
              <option value="ALL">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-1">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Ticket', 'Cliente', 'Producto', 'Servicio', 'Técnico', 'Entrega Est.', 'Precio', 'Estado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const sc = STATUS_CONFIG[o.status];
                    return (
                      <tr key={o.id} className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer"
                        onClick={() => { setDetailOrder(o); loadHistory(o.id); setShowDetail(true); }}>
                        <td className="px-4 py-3 font-mono font-bold text-slate-700">{o.ticket_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{o.client_name}</p>
                          <p className="text-xs text-slate-400">{o.client_phone}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{o.product_description}</td>
                        <td className="px-4 py-3 text-slate-500">{o.service_type}</td>
                        <td className="px-4 py-3 text-slate-500">{o.technician_name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {o.estimated_delivery ? new Date(o.estimated_delivery).toLocaleDateString('es-CO') : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{fmt(o.estimated_price)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight size={16} className="text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="text-center py-16 text-slate-400">
                  <Wrench size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Sin órdenes de reparación</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB: TALLER (Kanban) ═══════ */}
      {activeTab === 'workshop' && (
        <div className="grid md:grid-cols-3 gap-4 flex-1">
          {(['RECEIVED', 'ASSIGNED', 'IN_REPAIR'] as RepairStatus[]).map(status => {
            const colOrders = activeOrders.filter(o => o.status === status);
            const sc = STATUS_CONFIG[status];
            return (
              <div key={status} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: sc.color }}>{sc.icon}</span>
                  <span className="font-semibold text-slate-700 text-sm">{sc.label}</span>
                  <span className="ml-auto w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: sc.color }}>{colOrders.length}</span>
                </div>
                {colOrders.length === 0
                  ? <p className="text-center text-slate-400 text-xs py-8">Sin órdenes</p>
                  : colOrders.map(o => (
                    <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setDetailOrder(o); loadHistory(o.id); setShowDetail(true); }}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-slate-500">{o.ticket_number}</span>
                        <span className="text-xs font-semibold text-slate-700">{fmt(o.estimated_price)}</span>
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{o.client_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{o.product_description}</p>
                      <p className="text-xs text-slate-400 mt-1">{o.service_type}</p>
                      {o.technician_name && <p className="text-xs text-purple-600 mt-1 font-medium">🔧 {o.technician_name}</p>}
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {status === 'RECEIVED' && (
                          <button onClick={e => { e.stopPropagation(); updateStatus(o, 'ASSIGNED'); }}
                            className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 font-medium hover:bg-purple-100">
                            Asignar
                          </button>
                        )}
                        {status === 'ASSIGNED' && (
                          <button onClick={e => { e.stopPropagation(); updateStatus(o, 'IN_REPAIR'); }}
                            className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-600 font-medium hover:bg-amber-100">
                            Iniciar
                          </button>
                        )}
                        {status === 'IN_REPAIR' && (
                          <button onClick={e => { e.stopPropagation(); updateStatus(o, 'PENDING_DELIVERY'); }}
                            className="text-xs px-2 py-1 rounded-lg bg-pink-50 text-pink-600 font-medium hover:bg-pink-100">
                            Listo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ TAB: MATERIALES ═══════ */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-700">Inventario de Materiales</h2>
              {lowStock.length > 0 && <p className="text-xs text-red-500 mt-0.5">⚠️ {lowStock.length} materiales con stock bajo</p>}
            </div>
            <button onClick={() => { setEditingMat(null); setMatForm({ name: '', unit: 'und', stock: '', min_stock: '5', cost: '' }); setShowMatModal(true); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: brandColor }}>
              <Plus size={14} /> Agregar
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['Material', 'Unidad', 'Stock', 'Mín.', 'Costo', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const isLow = m.stock <= m.min_stock;
                  return (
                    <tr key={m.id} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-3 text-slate-500">{m.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>{m.stock}</span>
                        {isLow && <span className="ml-1 text-xs text-red-400">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{m.min_stock}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(m.cost)}</td>
                      <td className="px-4 py-3 flex gap-1">
                        <button onClick={() => { setEditingMat(m); setMatForm({ name: m.name, unit: m.unit, stock: String(m.stock), min_stock: String(m.min_stock), cost: String(m.cost) }); setShowMatModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('shoe_repair_materials').update({ is_active: false }).eq('id', m.id); toast.success('Eliminado'); loadMaterials(); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!materials.length && (
              <div className="text-center py-16 text-slate-400">
                <Tag size={40} className="mx-auto mb-3 opacity-30" />
                <p>Sin materiales registrados</p>
              </div>
            )}
          </div>

          {/* Técnicos */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 text-sm">Técnicos del Taller ({technicians.length})</h3>
              <button onClick={() => { setEditingTech(null); setTechForm({ name: '', specialty: '' }); setShowTechModal(true); }}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-white text-xs font-medium" style={{ background: brandColor }}>
                <Plus size={12} /> Técnico
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {technicians.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: brandColor }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{t.name}</p>
                    {t.specialty && <p className="text-[10px] text-slate-400">{t.specialty}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => { setEditingTech(t); setTechForm({ name: t.name, specialty: t.specialty }); setShowTechModal(true); }}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400"><Edit2 size={11} /></button>
                    <button onClick={() => deleteTech(t.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
              {!technicians.length && <p className="text-xs text-slate-400">Sin técnicos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB: HISTORIAL ═══════ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['Ticket', 'Cliente', 'Producto', 'Servicio', 'Precio', 'Abono', 'Estado', 'Fecha'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => !searchQ || o.client_name.toLowerCase().includes(searchQ.toLowerCase()) || o.ticket_number.includes(searchQ)).map(o => {
                  const sc = STATUS_CONFIG[o.status];
                  return (
                    <tr key={o.id} className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer"
                      onClick={() => { setDetailOrder(o); loadHistory(o.id); setShowDetail(true); }}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{o.ticket_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{o.client_name}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{o.product_description}</td>
                      <td className="px-4 py-3 text-slate-500">{o.service_type}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{fmt(o.estimated_price)}</td>
                      <td className="px-4 py-3 text-slate-500">{o.deposit_amount > 0 ? fmt(o.deposit_amount) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ TAB: REPORTES ═══════ */}
      {activeTab === 'reports' && (
        <div className="grid md:grid-cols-2 gap-4 flex-1">
          {/* Por estado */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={16} /> Órdenes por Estado</h3>
            <div className="space-y-3">
              {Object.entries(STATUS_CONFIG).map(([key, sc]) => {
                const count = orders.filter(o => o.status === key).length;
                const pct = orders.length ? (count / orders.length) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{sc.label}</span>
                      <span className="font-bold text-slate-800">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Por técnico */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><User size={16} /> Por Técnico</h3>
            {technicians.length === 0
              ? <p className="text-slate-400 text-sm text-center py-8">Sin técnicos</p>
              : <div className="space-y-3">
                {technicians.map(t => {
                  const tOrders  = orders.filter(o => o.technician_id === t.id);
                  const tDone    = tOrders.filter(o => o.status === 'DELIVERED');
                  const tRevenue = tDone.reduce((s, o) => s + o.estimated_price, 0);
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: brandColor }}>
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                        <p className="text-xs text-slate-400">{tOrders.length} total · {tDone.length} entregados</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{fmt(tRevenue)}</span>
                    </div>
                  );
                })}
              </div>
            }
          </div>

          {/* Materiales usados */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Tag size={16} /> Stock de Materiales</h3>
            <div className="space-y-2">
              {materials.slice(0, 8).map(m => {
                const isLow = m.stock <= m.min_stock;
                return (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className={isLow ? 'text-red-600 font-medium' : 'text-slate-600'}>{m.name} {isLow && '⚠️'}</span>
                    <span className="font-bold text-slate-700">{m.stock} {m.unit}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><DollarSign size={16} /> Resumen Financiero</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Órdenes', value: orders.length },
                { label: 'Entregadas', value: orders.filter(o => o.status === 'DELIVERED').length },
                { label: 'Ingresos totales', value: fmt(totalRevenue) },
                { label: 'Abonos recibidos', value: fmt(orders.reduce((s, o) => s + o.deposit_amount, 0)) },
                { label: 'Saldo pendiente', value: fmt(orders.filter(o => !['DELIVERED','CANCELLED'].includes(o.status)).reduce((s, o) => s + (o.estimated_price - o.deposit_amount), 0)) },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-sm">{r.label}</span>
                  <span className="font-bold text-slate-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: NUEVA ORDEN
      ══════════════════════════════════════════════ */}
      {showNewOrder && (
        <ModalWrap title="Nueva Orden de Reparación" onClose={() => setShowNewOrder(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente *</label>
                <input value={orderForm.client_name} onChange={e => setOrderForm(p => ({ ...p, client_name: e.target.value }))}
                  placeholder="Nombre completo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cédula</label>
                <input value={orderForm.client_id} onChange={e => setOrderForm(p => ({ ...p, client_id: e.target.value }))}
                  placeholder="N° documento" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <input value={orderForm.client_phone} onChange={e => setOrderForm(p => ({ ...p, client_phone: e.target.value }))}
                  placeholder="Celular" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Producto recibido *</label>
                <input value={orderForm.product_description} onChange={e => setOrderForm(p => ({ ...p, product_description: e.target.value }))}
                  placeholder="Ej: Zapato de cuero negro talla 42" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de servicio</label>
                <select value={orderForm.service_type} onChange={e => setOrderForm(p => ({ ...p, service_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Técnico</label>
                <select value={orderForm.technician_id} onChange={e => setOrderForm(p => ({ ...p, technician_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="">Sin asignar</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción del daño</label>
                <textarea value={orderForm.damage_description} onChange={e => setOrderForm(p => ({ ...p, damage_description: e.target.value }))}
                  placeholder="Describe el daño detalladamente..." rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Entrega estimada</label>
                <input type="date" value={orderForm.estimated_delivery} onChange={e => setOrderForm(p => ({ ...p, estimated_delivery: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Precio estimado ($)</label>
                <input type="number" value={orderForm.estimated_price} onChange={e => setOrderForm(p => ({ ...p, estimated_price: e.target.value }))}
                  placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Abono inicial ($) <span className="text-slate-400 font-normal">opcional</span></label>
                <input type="number" value={orderForm.deposit_amount} onChange={e => setOrderForm(p => ({ ...p, deposit_amount: e.target.value }))}
                  placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones</label>
                <input value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notas adicionales..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300" />
              </div>
            </div>
            <button onClick={handleCreateOrder} disabled={saving}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: brandColor }}>
              {saving ? 'Creando...' : '✅ Crear Orden de Reparación'}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: DETALLE ORDEN
      ══════════════════════════════════════════════ */}
      {showDetail && detailOrder && (
        <ModalWrap title={`Orden ${detailOrder.ticket_number}`} onClose={() => setShowDetail(false)} wide>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Columna izquierda: info + estado + fotos */}
            <div className="space-y-4">
              {/* Info */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <InfoRow label="Cliente"    value={detailOrder.client_name} />
                <InfoRow label="Cédula"     value={detailOrder.client_id || '—'} />
                <InfoRow label="Teléfono"   value={detailOrder.client_phone || '—'} />
                <InfoRow label="Producto"   value={detailOrder.product_description} />
                <InfoRow label="Servicio"   value={detailOrder.service_type} />
                <InfoRow label="Daño"       value={detailOrder.damage_description || '—'} />
                <InfoRow label="Técnico"    value={detailOrder.technician_name || 'Sin asignar'} />
                <InfoRow label="Precio"     value={fmt(detailOrder.estimated_price)} />
                <InfoRow label="Abono"      value={fmt(detailOrder.deposit_amount)} />
                <InfoRow label="Saldo"      value={fmt(detailOrder.estimated_price - detailOrder.deposit_amount)} />
                <InfoRow label="Entrega est." value={detailOrder.estimated_delivery ? new Date(detailOrder.estimated_delivery).toLocaleDateString('es-CO') : '—'} />
                {detailOrder.delivered_at && <InfoRow label="Entregado" value={new Date(detailOrder.delivered_at).toLocaleDateString('es-CO')} />}
              </div>

              {/* Estado actual */}
              {(() => { const sc = STATUS_CONFIG[detailOrder.status]; return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                  {sc.icon} {sc.label}
                </span>
              ); })()}

              {/* Acciones de estado */}
              {!['DELIVERED','CANCELLED'].includes(detailOrder.status) && (
                <div className="flex flex-wrap gap-2">
                  {detailOrder.status === 'RECEIVED' && <ActionBtn label="Asignar al taller" color="#7c3aed" onClick={() => updateStatus(detailOrder, 'ASSIGNED')} />}
                  {detailOrder.status === 'ASSIGNED' && <ActionBtn label="Iniciar reparación" color="#d97706" onClick={() => updateStatus(detailOrder, 'IN_REPAIR')} />}
                  {detailOrder.status === 'IN_REPAIR' && <ActionBtn label="Listo para entrega" color="#db2777" onClick={() => updateStatus(detailOrder, 'PENDING_DELIVERY')} />}
                  {detailOrder.status === 'PENDING_DELIVERY' && <ActionBtn label="✅ Marcar entregado" color="#059669" onClick={() => updateStatus(detailOrder, 'DELIVERED')} />}
                  <ActionBtn label="Cancelar" color="#dc2626" outline onClick={() => { if (confirm('¿Cancelar esta orden?')) updateStatus(detailOrder, 'CANCELLED'); }} />
                </div>
              )}

              {/* Asignar técnico */}
              {detailOrder.status !== 'DELIVERED' && detailOrder.status !== 'CANCELLED' && technicians.length > 0 && (
                <div className="flex gap-2">
                  <select id="tech-assign-sel" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Asignar técnico...</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={() => {
                    const v = (document.getElementById('tech-assign-sel') as HTMLSelectElement).value;
                    if (v) assignTech(detailOrder.id, v);
                  }} className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: brandColor }}>
                    Asignar
                  </button>
                </div>
              )}

              {/* Usar material */}
              {!['DELIVERED','CANCELLED'].includes(detailOrder.status) && (
                <button onClick={() => setShowMatUse(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 w-full justify-center">
                  <Tag size={14} /> Registrar uso de material
                </button>
              )}

              {/* Cobrar en POS */}
              {detailOrder.status === 'PENDING_DELIVERY' && (
                <button onClick={() => {
                  const params = new URLSearchParams({
                    shoe:     detailOrder.id,
                    ticket:   detailOrder.ticket_number,
                    cliente:  detailOrder.client_name,
                    cedula:   detailOrder.client_id  || '',
                    tel:      detailOrder.client_phone || '',
                    total:    String(detailOrder.estimated_price),
                    abono:    String(detailOrder.deposit_amount),
                    servicio: detailOrder.service_type,
                  });
                  navigate(`/pos?${params.toString()}`);
                }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold w-full justify-center hover:bg-blue-700">
                  <ShoppingCart size={16} /> Cobrar en POS
                </button>
              )}
            </div>

            {/* Columna derecha: fotos + historial */}
            <div className="space-y-4">
              {/* Fotos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-700 text-sm">Fotos del producto</p>
                  <div className="flex gap-1">
                    <select value={photoType} onChange={e => setPhotoType(e.target.value as any)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                      <option value="before">Antes</option>
                      <option value="during">Durante</option>
                      <option value="after">Después</option>
                    </select>
                    {/* Upload */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, detailOrder, photoType); }} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Subir imagen">
                      <Upload size={13} />
                    </button>
                    {/* Camera */}
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, detailOrder, photoType); }} />
                    <button onClick={() => cameraRef.current?.click()} disabled={uploadingPhoto}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Tomar foto">
                      <Camera size={13} />
                    </button>
                  </div>
                </div>
                {(['before', 'during', 'after'] as const).map(type => {
                  const photos = detailOrder.photos?.[type] || [];
                  if (!photos.length) return null;
                  return (
                    <div key={type} className="mb-3">
                      <p className="text-xs text-slate-400 mb-1 font-medium">
                        {type === 'before' ? '📷 Antes' : type === 'during' ? '📷 Durante' : '📷 Después'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {photos.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                            <button onClick={() => deletePhoto(detailOrder, type, idx)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center font-bold">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {uploadingPhoto && <p className="text-xs text-blue-500 animate-pulse">Subiendo foto...</p>}
              </div>

              {/* Historial */}
              <div>
                <p className="font-semibold text-slate-700 text-sm mb-2">Historial de actividades</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {orderHistory.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-4">Sin actividad registrada</p>
                    : orderHistory.map(h => (
                      <div key={h.id} className="flex gap-3 text-xs">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                        <div className="flex-1">
                          <p className="text-slate-600">{h.description}</p>
                          <p className="text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleString('es-CO')} · {h.user_name}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </ModalWrap>
      )}

      {/* Modal: Técnico */}
      {showTechModal && (
        <ModalWrap title={editingTech ? 'Editar Técnico' : 'Nuevo Técnico'} onClose={() => setShowTechModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre *</label>
              <input value={techForm.name} onChange={e => setTechForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre completo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Especialidad</label>
              <input value={techForm.specialty} onChange={e => setTechForm(p => ({ ...p, specialty: e.target.value }))}
                placeholder="Ej: Cuero, suela, costura..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <button onClick={saveTech} disabled={saving} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50" style={{ background: brandColor }}>
              {saving ? 'Guardando...' : editingTech ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Modal: Material */}
      {showMatModal && (
        <ModalWrap title={editingMat ? 'Editar Material' : 'Nuevo Material'} onClose={() => setShowMatModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre *</label>
              <input value={matForm.name} onChange={e => setMatForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Pegante, Suela..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad</label>
                <select value={matForm.unit} onChange={e => setMatForm(p => ({ ...p, unit: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none bg-white">
                  {['und', 'par', 'ml', 'gr', 'mt', 'pza'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Stock</label>
                <input type="number" value={matForm.stock} onChange={e => setMatForm(p => ({ ...p, stock: e.target.value }))}
                  placeholder="0" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Stock mín.</label>
                <input type="number" value={matForm.min_stock} onChange={e => setMatForm(p => ({ ...p, min_stock: e.target.value }))}
                  placeholder="5" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Costo unitario ($)</label>
              <input type="number" value={matForm.cost} onChange={e => setMatForm(p => ({ ...p, cost: e.target.value }))}
                placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <button onClick={saveMaterial} disabled={saving} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50" style={{ background: brandColor }}>
              {saving ? 'Guardando...' : editingMat ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Modal: Usar Material */}
      {showMatUse && detailOrder && (
        <ModalWrap title="Registrar Uso de Material" onClose={() => setShowMatUse(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Material</label>
              <select value={matUseForm.material_id} onChange={e => setMatUseForm(p => ({ ...p, material_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="">Seleccionar material...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} — Stock: {m.stock} {m.unit}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cantidad</label>
              <input type="number" value={matUseForm.quantity} onChange={e => setMatUseForm(p => ({ ...p, quantity: e.target.value }))}
                min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <button onClick={useMaterial} disabled={saving} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50" style={{ background: brandColor }}>
              {saving ? 'Registrando...' : 'Registrar uso y descontar stock'}
            </button>
          </div>
        </ModalWrap>
      )}

    </div>
  );
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────
const ModalWrap: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[92vh] overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
      <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const ActionBtn: React.FC<{ label: string; color: string; outline?: boolean; onClick: () => void }> = ({ label, color, outline, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
    style={outline ? { border: `1px solid ${color}`, color, background: 'transparent' } : { background: color, color: '#fff' }}>
    {label}
  </button>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-start gap-4">
    <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
    <span className="text-sm text-slate-700 font-medium text-right">{value}</span>
  </div>
);

export default ShoeRepair;