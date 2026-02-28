import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { DollarSign, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue', extra }: any) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      <p className="text-slate-400 text-sm mt-4">{subtext}</p>
      {extra && <p className="text-slate-300 text-xs mt-1">{extra}</p>}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { products, repairs, sales, isLoading, company } = useDatabase();
  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const grouped: Record<string, number> = {};
    dayNames.forEach(d => grouped[d] = 0);
    sales.forEach((s: any) => {
      const d = dayNames[new Date(s.created_at).getDay()];
      grouped[d] = (grouped[d] || 0) + (s.total_amount || 0);
    });
    setSalesChart(dayNames.map(name => ({ name, sales: grouped[name] })));
    const t = setTimeout(() => setChartReady(true), 50);
    return () => clearTimeout(t);
  }, [sales]);

  const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

  // ── INVENTARIO CORREGIDO ──────────────────────────────────────────────────
  // Total unidades físicas reales (suma de stock de todas las referencias)
  const totalUnidades = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

  // Inventario valorizado a PRECIO DE VENTA (valor comercial real)
  const inventoryValuePrecio = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

  // Inventario valorizado a COSTO (lo que costó)
  const inventoryValueCosto = products.reduce((sum, p) => sum + (p.cost * (p.stock_quantity || 0)), 0);

  // Ganancia potencial si se vende todo
  const gananciaPotencial = inventoryValuePrecio - inventoryValueCosto;

  const activeRepairs = repairs.filter((r: any) =>
    !['DELIVERED', 'CANCELLED'].includes(r.status)
  ).length;
  const urgentRepairs = repairs.filter((r: any) => r.status === 'READY').length;

  const topProducts = [...products]
    .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard General</h2>
          <p className="text-slate-500">{company?.name || 'IPHONESHOP USA'}</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm">
            <option>Esta Semana</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Exportar Reporte
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Totales"
          value={formatMoney(totalSales)}
          subtext={`${sales.length} facturas registradas`}
          icon={DollarSign} color="blue"
        />
        <StatCard
          title="Utilidad Estimada"
          value={formatMoney(totalSales * 0.25)}
          subtext="Margen ~25%"
          icon={TrendingUp} color="green"
        />
        <StatCard
          title="Inventario Valorizado"
          value={formatMoney(inventoryValuePrecio)}
          subtext={`${totalUnidades} unidades · ${products.length} referencias`}
          extra={`Costo: ${formatMoney(inventoryValueCosto)}`}
          icon={Package} color="purple"
        />
        <StatCard
          title="Reparaciones Activas"
          value={activeRepairs.toString()}
          subtext={`${urgentRepairs} listas para entregar`}
          icon={AlertCircle} color="orange"
        />
      </div>

      {/* ── FILA DE RESUMEN DE INVENTARIO ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">Valor a Precio Venta</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{formatMoney(inventoryValuePrecio)}</p>
          </div>
          <div className="text-3xl text-purple-300">📦</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor a Costo</p>
            <p className="text-xl font-bold text-slate-700 mt-1">{formatMoney(inventoryValueCosto)}</p>
          </div>
          <div className="text-3xl text-slate-300">🏷️</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-green-500 uppercase tracking-wide">Ganancia Potencial</p>
            <p className="text-xl font-bold text-green-700 mt-1">{formatMoney(gananciaPotencial)}</p>
            <p className="text-xs text-green-400 mt-0.5">Si se vende todo el stock</p>
          </div>
          <div className="text-3xl text-green-300">💰</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Ventas por Día (esta semana)</h3>
          <div className="h-80 w-full">
            {chartReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b' }}
                    tickFormatter={(v) => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}K`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatMoney(value)}
                  />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                Cargando gráfico...
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Top Productos (por margen)</h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin productos aún</p>
            ) : topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-slate-500">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-800 truncate">{p.name}</h4>
                  <p className="text-xs text-slate-400">Stock: {p.stock_quantity ?? 0} uds</p>
                  <p className="text-xs text-green-500">Margen: {formatMoney(p.price - p.cost)}</p>
                </div>
                <span className="font-bold text-slate-700 text-sm">{formatMoney(p.price)}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 text-blue-600 text-sm font-medium hover:text-blue-700">
            Ver reporte completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
