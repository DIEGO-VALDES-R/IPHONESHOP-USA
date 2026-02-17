import React from 'react';
import { MOCK_RECEIVABLES } from '../services/mockData';
import { Filter, Download, AlertTriangle, Clock } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

const AccountsReceivable: React.FC = () => {
    const { formatMoney } = useCurrency();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                        Cuentas por Cobrar
                    </h2>
                    <p className="text-slate-500">
                        Gestión de cartera y créditos a clientes
                    </p>
                </div>

                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm">
                        <Filter size={16} /> Filtros
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                        <Download size={16} /> Reporte
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-slate-500 text-sm font-medium">
                        Total Cartera
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">
                        {formatMoney(14500000)}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-red-500 text-sm font-medium">
                        Vencida &gt; 30 días
                    </p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">
                        {formatMoney(4500000)}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-green-500 text-sm font-medium">
                        Recaudado este mes
                    </p>
                    <h3 className="text-2xl font-bold text-green-600 mt-1">
                        {formatMoney(5000000)}
                    </h3>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Cliente
                            </th>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Monto Orig.
                            </th>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Saldo
                            </th>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Vencimiento
                            </th>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Estado
                            </th>
                            <th className="px-6 py-4 font-semibold text-slate-700">
                                Acción
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {MOCK_RECEIVABLES.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {rec.customer_name}
                                </td>

                                <td className="px-6 py-4 text-slate-500">
                                    {formatMoney(rec.total_amount)}
                                </td>

                                <td className="px-6 py-4 font-bold text-slate-800">
                                    {formatMoney(rec.balance)}
                                </td>

                                <td className="px-6 py-4 text-slate-600">
                                    {new Date(rec.due_date).toLocaleDateString()}
                                </td>

                                <td className="px-6 py-4">
                                    <span
                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            rec.status === 'OVERDUE'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                    >
                                        {rec.status === 'OVERDUE' ? (
                                            <AlertTriangle size={12} />
                                        ) : (
                                            <Clock size={12} />
                                        )}
                                        {rec.status}
                                    </span>
                                </td>

                                <td className="px-6 py-4">
                                    <button className="text-blue-600 font-medium hover:underline text-xs">
                                        Registrar Abono
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AccountsReceivable;