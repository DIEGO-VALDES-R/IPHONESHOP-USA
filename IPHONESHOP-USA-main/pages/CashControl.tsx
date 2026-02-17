import React, { useState } from 'react';
import { DollarSign, Lock, Unlock, History, AlertTriangle } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';

const CashControl: React.FC = () => {
    const { session, openSession, closeSession, sessionsHistory } = useDatabase();
    const [openAmount, setOpenAmount] = useState('');
    const [closeAmount, setCloseAmount] = useState('');
    const [notes, setNotes] = useState('');
    
    const { formatMoney } = useCurrency();

    const handleOpenRegister = (e: React.FormEvent) => {
        e.preventDefault();
        openSession(parseFloat(openAmount));
        setOpenAmount('');
    };

    const handleCloseRegister = (e: React.FormEvent) => {
        e.preventDefault();
        closeSession(parseFloat(closeAmount));
        setCloseAmount('');
        setNotes('');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Toaster />
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Control de Caja</h2>
                    <p className="text-slate-500">Apertura, cierre y arqueo de turnos</p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${session?.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {session?.status === 'OPEN' ? <Unlock size={20}/> : <Lock size={20}/>}
                    {session?.status === 'OPEN' ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg text-slate-800 mb-4">Estado Actual</h3>
                    
                    {!session || session.status === 'CLOSED' ? (
                        <form onSubmit={handleOpenRegister} className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <p className="text-sm text-blue-800">Ingrese el monto base (sencillo) para iniciar operaciones.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Base de Caja ($)</label>
                                <input 
                                    type="number" 
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="0"
                                    value={openAmount}
                                    onChange={e => setOpenAmount(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">
                                Abrir Caja
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-xs text-slate-500">Hora Apertura</p>
                                    <p className="font-mono font-bold">{new Date(session.start_time).toLocaleTimeString()}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-xs text-slate-500">Base Inicial</p>
                                    <p className="font-mono font-bold">{formatMoney(session.start_cash)}</p>
                                </div>
                            </div>
                            
                            <div className="py-4 border-t border-b border-slate-100 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Ventas Efectivo (Sistema)</span>
                                    <span className="font-bold text-slate-800">{formatMoney(session.total_sales_cash)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Ventas Tarjeta/Otros</span>
                                    <span className="font-bold text-slate-800">{formatMoney(session.total_sales_card)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 text-blue-600">
                                    <span>Total Esperado en Caja</span>
                                    <span>{formatMoney(session.start_cash + session.total_sales_cash)}</span>
                                </div>
                            </div>

                            <form onSubmit={handleCloseRegister} className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dinero Contado (Arqueo)</label>
                                    <input 
                                        type="number" 
                                        required
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                        placeholder="Ingrese total contado..."
                                        value={closeAmount}
                                        onChange={e => setCloseAmount(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notas / Observaciones</label>
                                    <textarea 
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    ></textarea>
                                </div>
                                <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 flex justify-center gap-2">
                                    <Lock size={18} /> Cerrar Turno
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* History Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                        <History size={20} /> Historial Reciente
                     </h3>
                     <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {sessionsHistory.length === 0 ? (
                             <p className="text-slate-400 text-sm text-center py-4">No hay historial reciente.</p>
                        ) : (
                            sessionsHistory.map((hist) => {
                                const diff = hist.difference || 0;
                                const isNegative = diff < 0;
                                const isPositive = diff > 0;
                                
                                return (
                                    <div key={hist.id} className={`p-3 border rounded-lg hover:bg-slate-50 transition-colors ${
                                        isNegative ? 'border-l-4 border-l-red-500' : isPositive ? 'border-l-4 border-l-blue-500' : 'border-slate-100'
                                    }`}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-slate-700">
                                                {new Date(hist.start_time).toLocaleDateString()} - {new Date(hist.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            {diff === 0 ? (
                                                <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-0.5 rounded">Cuadrado</span>
                                            ) : (
                                                <span className={`font-bold text-xs px-2 py-0.5 rounded ${isNegative ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>
                                                    {isNegative ? 'Faltante: ' : 'Sobrante: '}{formatMoney(Math.abs(diff))}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Base: {formatMoney(hist.start_cash)}</span>
                                            <span>Ventas: {formatMoney(hist.total_sales_cash + hist.total_sales_card)}</span>
                                        </div>
                                        {hist.end_time && (
                                            <div className="text-[10px] text-slate-400 mt-1 text-right">
                                                Cierre: {new Date(hist.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default CashControl;