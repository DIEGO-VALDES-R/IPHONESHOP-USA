import React, { useState, useEffect } from 'react';
import { Filter, AlertTriangle, Clock, X, DollarSign, Plus } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { receivableService, Receivable } from '../services/receivableService';
import { useCompany } from '../hooks/useCompany';
import toast from 'react-hot-toast';

const AccountsReceivable: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { companyId } = useCompany();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [summary, setSummary] = useState({ totalPortfolio: 0, overdue30: 0, collectedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ customer_name: '', total_amount: '', paid_amount: '0', due_date: '', notes: '' });

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        receivableService.getAll(companyId),
        receivableService.getSummary(companyId)
      ]);
      setReceivables(data); setSummary(sum);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [companyId]);

  const handlePayment = async () => {
    if (!selectedRec?.id || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedRec.balance) { toast.error('Monto inválido'); return; }
    setSaving(true);
    try {
      await receivableService.registerPayment(selectedRec.id, amount, payMethod, payNotes);
      toast.success('Abono registrado'); setShowPayModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleCreateReceivable = async () => {
    const total = parseFloat(newForm.total_amount);
    const paid = parseFloat(newForm.paid_amount || '0');
    if (!newForm.customer_name || !total || !newForm.due_date) { toast.error('Completa los campos requeridos'); return; }
    setSaving(true);
    try {
      await receivableService.create({
        company_id: companyId!, customer_name: newForm.customer_name,
        total_amount: total, paid_amount: paid,
        due_date: new Date(newForm.due_date).toISOString(),
        status: 'PENDING', notes: newForm.notes,
      });
      toast.success('Cuenta por cobrar creada');
      setShowNewModal(false);
      setNewForm({ customer_name: '', total_amount: '', paid_amount: '0', due_date: '', notes: '' });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cuentas por Cobrar</h2>
          <p className="text-slate-500">Gestión de cartera y créditos a clientes</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            <Plus size={16} /> Nueva Cuenta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Total Cartera</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatMoney(summary.totalPortfolio)}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-red-500 text-sm font-medium">Vencida &gt; 30 días</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">{formatMoney(summary.overdue30)}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-green-500 text-sm font-medium">Recaudado este mes</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">{formatMoney(summary.collectedThisMonth)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Cargando cartera...</div>
        ) : receivables.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No hay cuentas por cobrar pendientes</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Cliente','Monto Orig.','Saldo','Vencimiento','Estado','Acción'].map(h => (
                <th key={h} className="px-6 py-4 font-semibold text-slate-700">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receivables.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{rec.customer_name}</td>
                  <td className="px-6 py-4 text-slate-500">{formatMoney(rec.total_amount)}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{formatMoney(rec.balance)}</td>
                  <td className="px-6 py-4 text-slate-600">{new Date(rec.due_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rec.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      rec.status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {rec.status === 'OVERDUE' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {rec.status === 'OVERDUE' ? 'Vencida' : rec.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setSelectedRec(rec); setPayAmount(''); setPayMethod('CASH'); setPayNotes(''); setShowPayModal(true); }}
                      className="text-blue-600 font-medium hover:underline text-xs">
                      Registrar Abono
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPayModal && selectedRec && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Registrar Abono</h3>
              <button onClick={() => setShowPayModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-semibold text-slate-800">{selectedRec.customer_name}</p>
                <p className="text-sm text-slate-500 mt-2">Saldo pendiente</p>
                <p className="font-bold text-red-600 text-xl">{formatMoney(selectedRec.balance)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto del Abono</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} max={selectedRec.balance} placeholder="0"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="NEQUI">Nequi</option>
                  <option value="DAVIPLATA">Daviplata</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Referencia de pago..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Cancelar</button>
              <button onClick={handlePayment} disabled={saving || !payAmount} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Nueva Cuenta por Cobrar</h3>
              <button onClick={() => setShowNewModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                <input value={newForm.customer_name} onChange={e => setNewForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto Total *</label>
                  <input type="number" value={newForm.total_amount} onChange={e => setNewForm(p => ({ ...p, total_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Abono Inicial</label>
                  <input type="number" value={newForm.paid_amount} onChange={e => setNewForm(p => ({ ...p, paid_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Vencimiento *</label>
                <input type="date" value={newForm.due_date} onChange={e => setNewForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <input value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowNewModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Cancelar</button>
              <button onClick={handleCreateReceivable} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivable;
