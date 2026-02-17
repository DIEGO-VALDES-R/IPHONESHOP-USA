import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { DollarSign, TrendingUp, Package, Users, AlertCircle } from 'lucide-react';
import { MOCK_SALES_HISTORY } from '../services/mockData';
import { useCurrency } from '../contexts/CurrencyContext';

const StatCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className="text-green-600 font-medium flex items-center gap-1">
        <TrendingUp size={14} />
        +12.5%
      </span>
      <span className="text-slate-400 ml-2">{subtext}</span>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { formatMoney } = useCurrency();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard General</h2>
          <p className="text-slate-500">Resumen de operaciones - Sucursal Centro</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm">
            <option>Hoy</option>
            <option>Esta Semana</option>
            <option>Este Mes</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Exportar Reporte
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ventas Totales" 
          value={formatMoney(85400000)} 
          subtext="vs mes anterior" 
          icon={DollarSign} 
          trend="up" 
        />
        <StatCard 
          title="Utilidad Bruta" 
          value={formatMoney(28200000)} 
          subtext="Margen: 33.6%" 
          icon={TrendingUp} 
          trend="up" 
        />
        <StatCard 
          title="Inventario Valorizado" 
          value={formatMoney(450200000)} 
          subtext="342 unidades" 
          icon={Package} 
          trend="down" 
        />
        <StatCard 
          title="Reparaciones Activas" 
          value="12" 
          subtext="4 urgentes" 
          icon={AlertCircle} 
          trend="up" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Ventas por Día</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_SALES_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(value) => `${value / 1000000}M`} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}} 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Top Productos</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-slate-500">#{i}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-800">iPhone 15 Case</h4>
                  <p className="text-xs text-slate-400">142 vendidos</p>
                </div>
                <span className="font-bold text-slate-700">{formatMoney(65000)}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 text-blue-600 text-sm font-medium hover:text-blue-700">Ver todo el reporte</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;