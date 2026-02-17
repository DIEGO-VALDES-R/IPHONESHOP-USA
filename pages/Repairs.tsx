import React, { useState } from 'react';
import { Wrench, Clock, CheckCircle, AlertTriangle, Plus, X } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { RepairOrder, RepairStatus } from '../types';

const Repairs: React.FC = () => {
    const { formatMoney } = useCurrency();
    const { repairs, addRepair, updateRepairStatus } = useDatabase();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newOrder, setNewOrder] = useState<Partial<RepairOrder>>({
      customer_name: '', device_model: '', serial_number: '', issue_description: '', estimated_cost: 0, status: RepairStatus.RECEIVED
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addRepair(newOrder as any);
        setIsModalOpen(false);
        setNewOrder({ customer_name: '', device_model: '', serial_number: '', issue_description: '', estimated_cost: 0, status: RepairStatus.RECEIVED });
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case RepairStatus.RECEIVED: return 'bg-gray-100 text-gray-800';
            case RepairStatus.DIAGNOSING: return 'bg-blue-100 text-blue-800';
            case RepairStatus.WAITING_PARTS: return 'bg-amber-100 text-amber-800';
            case RepairStatus.READY: return 'bg-green-100 text-green-800';
            case RepairStatus.DELIVERED: return 'bg-slate-800 text-white';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Servicio Técnico</h2>
                    <p className="text-slate-500">Gestión de reparaciones y garantías</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2"
                >
                    <Plus size={18} /> Nueva Orden
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {repairs.length === 0 && (
                    <div className="col-span-3 text-center py-10 text-slate-400">
                        No hay reparaciones activas
                    </div>
                )}
                {repairs.map(repair => (
                    <div key={repair.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(repair.status)}`}>
                                {repair.status}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">#{repair.id}</span>
                        </div>
                        
                        <h3 className="font-bold text-slate-800 text-lg mb-1">{repair.device_model}</h3>
                        <p className="text-slate-500 text-sm mb-4">Cliente: {repair.customer_name}</p>
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 flex-1">
                            <p className="text-sm text-slate-700">
                                <span className="font-semibold">Problema:</span> {repair.issue_description}
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                             <div className="text-sm">
                                <p className="text-slate-400">Estimado</p>
                                <p className="font-bold text-slate-800">{formatMoney(repair.estimated_cost)}</p>
                             </div>
                             
                             <div className="flex gap-2">
                                <select 
                                   className="text-xs border rounded p-1 bg-white"
                                   value={repair.status}
                                   onChange={(e) => updateRepairStatus(repair.id, e.target.value as RepairStatus)}
                                >
                                    <option value={RepairStatus.RECEIVED}>Recibido</option>
                                    <option value={RepairStatus.DIAGNOSING}>Diagnosticando</option>
                                    <option value={RepairStatus.WAITING_PARTS}>Esp. Repuestos</option>
                                    <option value={RepairStatus.READY}>Listo</option>
                                    <option value={RepairStatus.DELIVERED}>Entregado</option>
                                </select>
                             </div>
                        </div>
                    </div>
                ))}
            </div>

             {/* CREATE MODAL */}
             {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg text-slate-800">Nueva Orden de Reparación</h3>
                      <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Cliente</label>
                            <input required className="w-full border rounded-lg p-2" value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Dispositivo</label>
                                <input required className="w-full border rounded-lg p-2" placeholder="ej. iPhone 13" value={newOrder.device_model} onChange={e => setNewOrder({...newOrder, device_model: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Serial / IMEI</label>
                                <input required className="w-full border rounded-lg p-2" value={newOrder.serial_number} onChange={e => setNewOrder({...newOrder, serial_number: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Falla Reportada</label>
                            <textarea required className="w-full border rounded-lg p-2" rows={3} value={newOrder.issue_description} onChange={e => setNewOrder({...newOrder, issue_description: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Costo Estimado</label>
                            <input type="number" className="w-full border rounded-lg p-2" value={newOrder.estimated_cost} onChange={e => setNewOrder({...newOrder, estimated_cost: Number(e.target.value)})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">Crear Orden</button>
                    </form>
                  </div>
                </div>
             )}
        </div>
    );
};

export default Repairs;
