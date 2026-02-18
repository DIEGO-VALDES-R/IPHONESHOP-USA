import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { DollarSign, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue' }: any) => {
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
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { products, repairs, sales, isLoading, company } = useDatabase();
  const [salesChart, setSalesChart] = useState<any[]>([]);

  useEffect(() => {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const grouped: Record<string, number> = {};
    dayNames.forEach(d => grouped[d] = 0);
    sales.forEach((s: any) => {
      const d = dayNames[new Date(s.created_at).getDay()];
      grouped[d] = (grouped[d] || 0) + (s.total_amount || 0);
    });
    setSalesChart(dayNames.map(name => ({ name, sales: grouped[name] })));
  }, [sales]);

  const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

  // Utilidad real: suma (precio - costo) * cantidad por cada item vendido
  const totalProfit = sales.reduce((sum: number, sale: any) => {
    const items = sale.invoice_items || [];
    const saleProfit = items.reduce((itemSum: number, item: any) => {
      const product = products.find(p => p.id === item.product_id);
      const cost = product?.cost ?? 0;
      const price = item.price ?? 0;
      const qty = item.quantity ?? 1;
      return itemSum + ((price - cost) * qty);
    }, 0);
    return sum + saleProfit;
  }, 0);

  const profitMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const inventoryValue = products.reduce((sum, p) => sum + (p.cost * (p.stock_quantity || 0)), 0);
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
          title="Utilidad Real"
          value={formatMoney(totalProfit)}
          subtext={`Margen ${profitMargin}% sobre ventas`}
          icon={TrendingUp} color="green"
        />
        <StatCard
          title="Inventario Valorizado"
          value={formatMoney(inventoryValue)}
          subtext={`${products.length} productos activos`}
          icon={Package} color="purple"
        />
        <StatCard
          title="Reparaciones Activas"
          value={activeRepairs.toString()}
          subtext={`${urgentRepairs} listas para entregar`}
          icon={AlertCircle} color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Ventas por Dia (esta semana)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }}
                  tickFormatter={(v) => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}K`} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Top Productos (por margen)</h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin productos aun</p>
            ) : topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-slate-500">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-800 truncate">{p.name}</h4>
                  <p className="text-xs text-slate-400">Stock: {p.stock_quantity ?? 0} | Margen: {formatMoney(p.price - p.cost)}</p>
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