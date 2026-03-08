import React, { useState, useEffect, useCallback } from 'react';
import { ChefHat, Clock, Check, AlertCircle, RefreshCw, Printer, X, Bell } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useDatabase } from '../contexts/DatabaseContext';
import toast from 'react-hot-toast';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  notes?: string;
  status: ItemStatus;
  sent_to_kitchen: boolean;
}

interface TableOrder {
  id: string;
  company_id: string;
  table_id: string;
  table_name: string;
  waiter_name?: string;
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
  guests: number;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; headerBg: string }> = {
  PENDING:   { label: '⏳ Nuevo',     bg: '#fff7ed', border: '#fdba74', text: '#c2410c', headerBg: '#f97316' },
  PREPARING: { label: '🔥 Preparando', bg: '#fefce8', border: '#fde047', text: '#a16207', headerBg: '#eab308' },
  READY:     { label: '✅ Listo',      bg: '#f0fdf4', border: '#86efac', text: '#15803d', headerBg: '#22c55e' },
};

const KitchenDisplay: React.FC = () => {
  const { company } = useDatabase();
  const companyId = company?.id;

  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY'>('ALL');

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, [soundEnabled]);

  const loadOrders = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('table_orders')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['PENDING', 'PREPARING', 'READY'])
      .order('created_at', { ascending: true });
    if (data) {
      setOrders(prev => {
        const newIds = new Set(data.map((o: TableOrder) => o.id));
        const prevIds = new Set(prev.map(o => o.id));
        const hasNew = [...newIds].some(id => !prevIds.has(id));
        if (hasNew) playBeep();
        return data;
      });
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [companyId, playBeep]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase.channel('kitchen-display')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'table_orders',
        filter: `company_id=eq.${companyId}`
      }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, loadOrders]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    await supabase.from('table_orders').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    if (newStatus === 'READY') {
      // Also update table status to READY
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await supabase.from('restaurant_tables').update({ status: 'READY' }).eq('id', order.table_id);
      }
      toast.success('🍽️ Pedido marcado como listo');
    }
    loadOrders();
  };

  const updateItemStatus = async (orderId: string, itemId: string, newStatus: ItemStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = order.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
    const allReady = updatedItems.every(i => i.status === 'READY' || i.status === 'DELIVERED');
    await supabase.from('table_orders').update({
      items: updatedItems,
      status: allReady ? 'READY' : 'PREPARING',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    if (allReady) {
      await supabase.from('restaurant_tables').update({ status: 'READY' }).eq('id', order.table_id);
      toast.success(`🍽️ ${order.table_name} — todo listo!`);
    }
    loadOrders();
  };

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getTimerColor = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 10) return '#10b981';
    if (mins < 20) return '#f59e0b';
    return '#ef4444';
  };

  const filteredOrders = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  const counts = {
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    PREPARING: orders.filter(o => o.status === 'PREPARING').length,
    READY: orders.filter(o => o.status === 'READY').length,
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <ChefHat size={48} className="text-orange-400 mx-auto mb-3 animate-pulse" />
        <p className="text-white text-lg font-semibold">Cargando cocina...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="font-black text-white text-lg leading-tight">Pantalla de Cocina</h1>
            <p className="text-slate-400 text-xs">{company?.name} · Actualizado {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary badges */}
          {[
            { key: 'PENDING',   label: 'Nuevos',     color: '#f97316' },
            { key: 'PREPARING', label: 'Preparando', color: '#eab308' },
            { key: 'READY',     label: 'Listos',     color: '#22c55e' },
          ].map(s => (
            <button key={s.key}
              onClick={() => setFilter(filter === s.key as any ? 'ALL' : s.key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === s.key ? 'text-slate-900' : 'text-white'}`}
              style={{ background: filter === s.key ? s.color : 'rgba(255,255,255,0.08)' }}>
              {counts[s.key as keyof typeof counts]} {s.label}
            </button>
          ))}

          <button onClick={() => setSoundEnabled(s => !s)}
            className={`p-2 rounded-lg transition-all ${soundEnabled ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}
            title={soundEnabled ? 'Silenciar alertas' : 'Activar alertas'}>
            <Bell size={18} />
          </button>

          <button onClick={loadOrders}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── ORDERS GRID ── */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <ChefHat size={64} className="text-slate-700" />
          <p className="text-slate-500 text-xl font-semibold">Sin pedidos activos</p>
          <p className="text-slate-600 text-sm">Los nuevos pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
            const timerColor = getTimerColor(order.created_at);
            return (
              <div key={order.id}
                className="rounded-2xl overflow-hidden border shadow-lg flex flex-col"
                style={{ background: cfg.bg, borderColor: cfg.border }}>

                {/* Card header */}
                <div className="px-4 py-3 flex items-center justify-between text-white"
                  style={{ background: cfg.headerBg }}>
                  <div>
                    <h3 className="font-black text-lg leading-tight">{order.table_name}</h3>
                    <p className="text-white/80 text-xs">{order.guests} comensal{order.guests !== 1 ? 'es' : ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-bold text-sm" style={{ color: '#fff' }}>
                      <Clock size={13} />
                      <span style={{ color: timerColor === '#ef4444' ? '#fecaca' : '#fff' }}>
                        {timeAgo(order.created_at)}
                      </span>
                    </div>
                    <p className="text-white/70 text-xs">{cfg.label}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="flex-1 p-3 space-y-2">
                  {order.items.filter(i => i.sent_to_kitchen || order.status !== 'PENDING').map(item => (
                    <div key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        item.status === 'READY' ? 'opacity-60 line-through' : ''
                      }`}
                      style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-slate-800 text-lg w-7 text-center leading-none">{item.quantity}</span>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">{item.product_name}</p>
                          {item.notes && <p className="text-xs text-orange-600 font-medium">⚠ {item.notes}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => updateItemStatus(order.id, item.id, item.status === 'READY' ? 'PREPARING' : 'READY')}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.status === 'READY'
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-300 bg-white hover:border-green-400 hover:bg-green-50 text-slate-400'
                        }`}>
                        <Check size={14} />
                      </button>
                    </div>
                  ))}

                  {order.notes && (
                    <div className="mt-2 p-2.5 rounded-xl bg-yellow-100 border border-yellow-300">
                      <p className="text-xs font-semibold text-yellow-800">📝 {order.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 border-t flex gap-2" style={{ borderColor: cfg.border }}>
                  {order.status === 'PENDING' && (
                    <button onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                      className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5">
                      🔥 Preparar
                    </button>
                  )}
                  {order.status === 'PREPARING' && (
                    <button onClick={() => updateOrderStatus(order.id, 'READY')}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5">
                      ✅ Listo para entregar
                    </button>
                  )}
                  {order.status === 'READY' && (
                    <button onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                      className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5">
                      🛎️ Entregado
                    </button>
                  )}
                  <button onClick={() => {
                    if (confirm('¿Cancelar este pedido?'))
                      updateOrderStatus(order.id, 'CANCELLED');
                  }}
                    className="w-10 h-10 rounded-xl bg-white/70 border border-red-200 hover:bg-red-50 text-red-500 flex items-center justify-center transition-all">
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;