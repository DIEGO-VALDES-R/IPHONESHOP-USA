import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Filter, FileText, Send, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronUp, Trash2, Edit3, Copy, ShoppingCart,
  Download, Share2, Eye, MoreVertical, AlertCircle, Calendar,
  User, Package, X, Save, Printer
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useDatabase } from '../contexts/DatabaseContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Product } from '../types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuoteItem {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  price: number;
  tax_rate: number;
  discount: number;
  total?: number;
  _product?: Product;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  customer_name: string;
  customer_doc?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'INVOICED';
  valid_until?: string;
  notes?: string;
  terms?: string;
  invoice_id?: string;
  created_at: string;
  quote_items?: QuoteItem[];
}

const STATUS_CONFIG = {
  DRAFT:    { label: 'Borrador',   cls: 'bg-slate-100 text-slate-600',    icon: <Edit3 size={11} /> },
  SENT:     { label: 'Enviada',    cls: 'bg-blue-100 text-blue-700',      icon: <Send size={11} /> },
  APPROVED: { label: 'Aprobada',   cls: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle size={11} /> },
  REJECTED: { label: 'Rechazada',  cls: 'bg-red-100 text-red-700',        icon: <XCircle size={11} /> },
  EXPIRED:  { label: 'Vencida',    cls: 'bg-amber-100 text-amber-700',    icon: <AlertCircle size={11} /> },
  INVOICED: { label: 'Facturada',  cls: 'bg-purple-100 text-purple-700',  icon: <FileText size={11} /> },
};

const EMPTY_ITEM: QuoteItem = { description: '', quantity: 1, price: 0, tax_rate: 19, discount: 0 };
const DEFAULT_TERMS = 'Cotización válida por los días indicados.\nPrecios no incluyen flete salvo indicación.\nTiempos de entrega sujetos a disponibilidad de inventario.';
const DEFAULT_VALIDITY = 15; // días

// ─── Utility ──────────────────────────────────────────────────────────────────
function nextQuoteNumber(existing: Quote[]): string {
  const nums = existing.map(q => parseInt(q.quote_number.replace(/\D/g, '')) || 0);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `COT-${next}`;
}

function validUntilDefault(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_VALIDITY);
  return d.toISOString().split('T')[0];
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generateQuotePDF(quote: Quote, company: any, formatMoney: (n: number) => string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 15;
  let y = M;

  const rp = (text: string, x: number, yy: number, opts?: any) => doc.text(text, x, yy, opts);
  const line = (yy: number) => { doc.setDrawColor(226,232,240); doc.line(M, yy, W-M, yy); };

  // Header
  doc.setFillColor(79,70,229); doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  rp('COTIZACIÓN', M, 13);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  rp(company?.name || 'POSmaster', M, 20);
  rp(`NIT: ${company?.nit || ''}`, M, 26);
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  rp(quote.quote_number, W-M, 13, { align:'right' });
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  rp(`Fecha: ${new Date(quote.created_at).toLocaleDateString('es-CO')}`, W-M, 20, { align:'right' });
  if (quote.valid_until) rp(`Válida hasta: ${new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('es-CO')}`, W-M, 26, { align:'right' });
  y = 40;

  // Cliente
  doc.setTextColor(30,41,59);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  rp('CLIENTE', M, y); y += 5;
  doc.setFont('helvetica','normal');
  rp(quote.customer_name, M, y); y += 4;
  if (quote.customer_doc) { rp(`Doc: ${quote.customer_doc}`, M, y); y += 4; }
  if (quote.customer_email) { rp(quote.customer_email, M, y); y += 4; }
  if (quote.customer_phone) { rp(`Tel: ${quote.customer_phone}`, M, y); y += 4; }
  y += 3; line(y); y += 5;

  // Tabla items
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.setFillColor(241,245,249); doc.rect(M, y-3, W-M*2, 7, 'F');
  rp('DESCRIPCIÓN', M+1, y+1);
  rp('CANT', 110, y+1, { align:'right' });
  rp('PRECIO', 135, y+1, { align:'right' });
  rp('DESC', 155, y+1, { align:'right' });
  rp('IVA', 170, y+1, { align:'right' });
  rp('TOTAL', W-M-1, y+1, { align:'right' });
  y += 8;

  doc.setFont('helvetica','normal');
  (quote.quote_items || []).forEach((item, i) => {
    if (y > 260) { doc.addPage(); y = M; }
    const total = item.quantity * item.price - item.discount;
    if (i % 2 === 0) { doc.setFillColor(248,250,252); doc.rect(M, y-3, W-M*2, 6, 'F'); }
    rp(item.description.substring(0,45), M+1, y);
    rp(item.quantity.toString(), 110, y, { align:'right' });
    rp(formatMoney(item.price), 135, y, { align:'right' });
    rp(item.discount > 0 ? formatMoney(item.discount) : '-', 155, y, { align:'right' });
    rp(item.tax_rate > 0 ? `${item.tax_rate}%` : 'EX', 170, y, { align:'right' });
    rp(formatMoney(total), W-M-1, y, { align:'right' });
    y += 6;
  });

  y += 2; line(y); y += 6;

  // Totales
  const totW = 80;
  const tx = W - M - totW;
  doc.setFontSize(8);
  const tot = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    rp(label, tx, y); rp(val, W-M-1, y, { align:'right' }); y += 5;
  };
  tot('Subtotal:', formatMoney(quote.subtotal));
  if (quote.discount_amount > 0) tot('Descuento:', `- ${formatMoney(quote.discount_amount)}`);
  tot('IVA:', formatMoney(quote.tax_amount));
  line(y-1); y += 2;
  doc.setFontSize(10);
  tot('TOTAL:', formatMoney(quote.total_amount), true);
  y += 4;

  // Términos
  if (quote.terms) {
    if (y > 240) { doc.addPage(); y = M; }
    line(y); y += 5;
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    rp('TÉRMINOS Y CONDICIONES', M, y); y += 4;
    doc.setFont('helvetica','normal');
    quote.terms.split('\n').forEach(l => { if (y < 280) { rp(l, M, y); y += 3.5; } });
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(148,163,184);
  rp('Generado por POSmaster · posmaster.app', W/2, 290, { align:'center' });

  doc.save(`${quote.quote_number}.pdf`);
}

// ─── Quote Form Modal ─────────────────────────────────────────────────────────
interface QuoteFormProps {
  initial?: Quote | null;
  products: Product[];
  companyId: string;
  branchId: string | null;
  onClose: () => void;
  onSaved: (q: Quote) => void;
  formatMoney: (n: number) => string;
  nextNumber: string;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ initial, products, companyId, branchId, onClose, onSaved, formatMoney, nextNumber }) => {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    quote_number: initial?.quote_number || nextNumber,
    customer_name: initial?.customer_name || '',
    customer_doc: initial?.customer_doc || '',
    customer_email: initial?.customer_email || '',
    customer_phone: initial?.customer_phone || '',
    valid_until: initial?.valid_until || validUntilDefault(),
    notes: initial?.notes || '',
    terms: initial?.terms || DEFAULT_TERMS,
    status: initial?.status || 'DRAFT' as Quote['status'],
  });

  const [items, setItems] = useState<QuoteItem[]>(
    initial?.quote_items?.length ? initial.quote_items : [{ ...EMPTY_ITEM }]
  );

  // Totals
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price - i.discount, 0);
  const taxAmount = items.reduce((s, i) => {
    const base = i.quantity * i.price - i.discount;
    return s + base * (i.tax_rate / 100);
  }, 0);
  const discountAmount = items.reduce((s, i) => s + i.discount, 0);
  const totalAmount = subtotal + taxAmount;

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx: number) => {
    if (items.length === 1) { setItems([{ ...EMPTY_ITEM }]); return; }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const selectProduct = (product: Product, idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? {
      ...item,
      product_id: product.id,
      description: product.name,
      price: product.price,
      tax_rate: product.tax_rate || 19,
      _product: product,
    } : item));
    setShowProductList(false);
    setProductSearch('');
    setActiveItemIdx(null);
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) { toast.error('Ingresa el nombre del cliente'); return; }
    if (items.every(i => !i.description.trim())) { toast.error('Agrega al menos un ítem'); return; }

    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        branch_id: branchId,
        quote_number: form.quote_number,
        customer_name: form.customer_name,
        customer_doc: form.customer_doc || null,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
        terms: form.terms || null,
        status: form.status,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
      };

      let quoteId = initial?.id;

      if (isEdit) {
        const { error } = await supabase.from('quotes').update(payload).eq('id', quoteId);
        if (error) throw error;
        await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      } else {
        const { data, error } = await supabase.from('quotes').insert(payload).select().single();
        if (error) throw error;
        quoteId = data.id;
      }

      const itemsPayload = items
        .filter(i => i.description.trim())
        .map(i => ({
          quote_id: quoteId,
          product_id: i.product_id || null,
          description: i.description,
          quantity: i.quantity,
          price: i.price,
          tax_rate: i.tax_rate,
          discount: i.discount,
        }));

      if (itemsPayload.length) {
        const { error } = await supabase.from('quote_items').insert(itemsPayload);
        if (error) throw error;
      }

      const { data: saved } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quoteId)
        .single();

      toast.success(isEdit ? 'Cotización actualizada' : 'Cotización creada');
      onSaved(saved);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 bg-white';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{isEdit ? 'Editar cotización' : 'Nueva cotización'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{form.quote_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cliente + Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Datos del cliente</p>
              <input className={inputCls} placeholder="Nombre cliente *" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Cédula / NIT" value={form.customer_doc} onChange={e => setForm(f => ({ ...f, customer_doc: e.target.value }))} />
                <input className={inputCls} placeholder="Teléfono" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
              </div>
              <input className={inputCls} placeholder="Email" type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Detalles</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Número</label>
                  <input className={inputCls} value={form.quote_number} onChange={e => setForm(f => ({ ...f, quote_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Válida hasta</label>
                  <input className={inputCls} type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Estado</label>
                <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Quote['status'] }))}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Notas internas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Productos / Servicios</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800">
                <Plus size={13} /> Agregar ítem
              </button>
            </div>

            {/* Items header */}
            <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-slate-400 uppercase px-1 mb-1">
              <span className="col-span-4">Descripción</span>
              <span className="col-span-2 text-right">Cant</span>
              <span className="col-span-2 text-right">Precio</span>
              <span className="col-span-1 text-right">IVA%</span>
              <span className="col-span-2 text-right">Descuento</span>
              <span className="col-span-1"></span>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="grid grid-cols-12 gap-1 items-center">
                    {/* Descripción con búsqueda de producto */}
                    <div className="col-span-4 relative">
                      <input
                        className={inputCls + ' pr-7'}
                        placeholder="Producto o servicio..."
                        value={item.description}
                        onChange={e => {
                          updateItem(idx, 'description', e.target.value);
                          setProductSearch(e.target.value);
                          setActiveItemIdx(idx);
                          setShowProductList(true);
                        }}
                        onFocus={() => { setActiveItemIdx(idx); setShowProductList(true); setProductSearch(item.description); }}
                        onBlur={() => setTimeout(() => setShowProductList(false), 200)}
                      />
                      <Package size={12} className="absolute right-2 top-2.5 text-slate-300" />
                    </div>
                    <div className="col-span-2">
                      <input className={inputCls + ' text-right'} type="number" min="0.001" step="0.001"
                        value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      <input className={inputCls + ' text-right'} type="number" min="0"
                        value={item.price} onChange={e => updateItem(idx, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1">
                      <input className={inputCls + ' text-right'} type="number" min="0" max="100"
                        value={item.tax_rate} onChange={e => updateItem(idx, 'tax_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      <input className={inputCls + ' text-right'} type="number" min="0"
                        value={item.discount} onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button onClick={() => removeItem(idx)} className="p-1 text-slate-300 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Total de línea */}
                  <div className="text-right text-[10px] pr-6 mt-0.5 flex items-center justify-end gap-2">
                    {item.discount > 0 && (
                      <span className="text-slate-300 line-through">{formatMoney(item.quantity * item.price)}</span>
                    )}
                    <span className="font-semibold text-slate-700">{formatMoney(item.quantity * item.price - item.discount)}</span>
                    {item.discount > 0 && (
                      <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                        -{formatMoney(item.discount)}
                      </span>
                    )}
                    {item.tax_rate > 0 && <span className="text-amber-500">+IVA {item.tax_rate}%</span>}
                  </div>

                  {/* Product dropdown */}
                  {showProductList && activeItemIdx === idx && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-20 mt-1 overflow-hidden">
                      {filteredProducts.map(p => (
                        <button key={p.id} onMouseDown={() => selectProduct(p, idx)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50 text-left">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{p.sku} · {p.category}</p>
                          </div>
                          <span className="text-xs font-bold text-indigo-600">{formatMoney(p.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 text-sm">
              {discountAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Precio original</span>
                  <span className="line-through">{formatMoney(subtotal + discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Descuento aplicado</span>
                  <span>- {formatMoney(discountAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex justify-between text-green-700 text-xs font-bold">
                  <span>💰 Ahorro del cliente</span>
                  <span>{formatMoney(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500"><span>IVA</span><span>{formatMoney(taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5">
                <span>Total</span><span>{formatMoney(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Términos */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Términos y condiciones</p>
            <textarea className={inputCls + ' resize-none'} rows={3} value={form.terms}
              onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 text-sm hover:bg-slate-200 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            <Save size={15} /> {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Quote Detail Modal ───────────────────────────────────────────────────────
interface QuoteDetailProps {
  quote: Quote;
  company: any;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onStatusChange: (status: Quote['status']) => void;
  formatMoney: (n: number) => string;
}

const QuoteDetail: React.FC<QuoteDetailProps> = ({ quote, company, onClose, onEdit, onConvert, onStatusChange, formatMoney }) => {
  const cfg = STATUS_CONFIG[quote.status];
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status !== 'INVOICED';

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hola ${quote.customer_name},\n\nAdjunto la cotización *${quote.quote_number}* de ${company?.name || 'nosotros'} por *${formatMoney(quote.total_amount)}*.\n\n` +
      (quote.valid_until ? `Válida hasta: ${new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('es-CO')}\n\n` : '') +
      `Para aprobarla, responde a este mensaje. ¡Gracias!`
    );
    const phone = quote.customer_phone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone ? '57' + phone : ''}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-slate-800 text-lg">{quote.quote_number}</h2>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                {cfg.icon} {cfg.label}
              </span>
              {isExpired && <span className="text-xs text-amber-600 font-semibold">⚠️ Vencida</span>}
            </div>
            <p className="text-xs text-slate-400">{new Date(quote.created_at).toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cliente */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Cliente</p>
            <p className="font-bold text-slate-800">{quote.customer_name}</p>
            {quote.customer_doc && <p className="text-xs text-slate-500">Doc: {quote.customer_doc}</p>}
            {quote.customer_email && <p className="text-xs text-slate-500">{quote.customer_email}</p>}
            {quote.customer_phone && <p className="text-xs text-slate-500">Tel: {quote.customer_phone}</p>}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Productos / Servicios</p>
            <div className="space-y-1">
              {(quote.quote_items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm text-slate-800">{item.description}</p>
                    <p className="text-xs text-slate-400">{item.quantity} × {formatMoney(item.price)}{item.tax_rate > 0 ? ` + IVA ${item.tax_rate}%` : ''}</p>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{formatMoney(item.quantity * item.price - item.discount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Precio original</span>
                <span className="line-through">{formatMoney(quote.subtotal + quote.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(quote.subtotal)}</span></div>
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Descuento</span><span>- {formatMoney(quote.discount_amount)}</span>
              </div>
            )}
            {quote.discount_amount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1 flex justify-between text-green-700 text-xs font-bold">
                <span>💰 Ahorro</span><span>{formatMoney(quote.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500"><span>IVA</span><span>{formatMoney(quote.tax_amount)}</span></div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>TOTAL</span><span>{formatMoney(quote.total_amount)}</span>
            </div>
          </div>

          {/* Validez */}
          {quote.valid_until && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar size={11} /> Válida hasta: {new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </p>
          )}

          {/* Notas */}
          {quote.notes && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">{quote.notes}</div>}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 space-y-3">
          {/* Status actions */}
          {quote.status === 'DRAFT' && (
            <div className="flex gap-2">
              <button onClick={() => onStatusChange('SENT')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                <Send size={14} /> Marcar como enviada
              </button>
            </div>
          )}
          {quote.status === 'SENT' && (
            <div className="flex gap-2">
              <button onClick={() => onStatusChange('APPROVED')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">
                <CheckCircle size={14} /> Aprobar
              </button>
              <button onClick={() => onStatusChange('REJECTED')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-bold hover:bg-red-200">
                <XCircle size={14} /> Rechazar
              </button>
            </div>
          )}
          {quote.status === 'APPROVED' && !quote.invoice_id && (
            <button onClick={onConvert} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700">
              <ShoppingCart size={14} /> Convertir a factura
            </button>
          )}

          {/* Utility actions */}
          <div className="flex gap-2">
            <button onClick={() => generateQuotePDF(quote, company, formatMoney)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">
              <Download size={14} /> PDF
            </button>
            <button onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-200">
              <Share2 size={14} /> WhatsApp
            </button>
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">
              <Edit3 size={14} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Quotes Page ─────────────────────────────────────────────────────────
const Quotes: React.FC = () => {
  const { products, company, companyId, branchId } = useDatabase();
  const { formatMoney } = useCurrency();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);

  const loadQuotes = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  // Auto-expire quotes past valid_until
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    quotes.forEach(async q => {
      if (q.valid_until && q.valid_until < today && q.status === 'SENT') {
        await supabase.from('quotes').update({ status: 'EXPIRED' }).eq('id', q.id);
      }
    });
  }, [quotes]);

  const filtered = quotes.filter(q => {
    const matchSearch = !search ||
      q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
      q.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPIs
  const kpis = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'DRAFT').length,
    sent: quotes.filter(q => q.status === 'SENT').length,
    approved: quotes.filter(q => q.status === 'APPROVED').length,
    totalValue: quotes.filter(q => ['SENT','APPROVED'].includes(q.status)).reduce((s, q) => s + q.total_amount, 0),
    conversionRate: quotes.length > 0
      ? Math.round((quotes.filter(q => ['APPROVED','INVOICED'].includes(q.status)).length / quotes.length) * 100)
      : 0,
  };

  const handleStatusChange = async (quote: Quote, status: Quote['status']) => {
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quote.id);
    if (error) { toast.error('Error al actualizar estado'); return; }
    toast.success(`Cotización marcada como ${STATUS_CONFIG[status].label}`);
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status } : q));
    if (detailQuote?.id === quote.id) setDetailQuote(prev => prev ? { ...prev, status } : null);
  };

  const handleConvertToInvoice = async (quote: Quote) => {
    const ok = window.confirm(`¿Convertir cotización ${quote.quote_number} a factura?\n\nSe creará una nueva factura con los mismos ítems.`);
    if (!ok) return;
    toast('Redirigiendo al POS con los ítems precargados...', { icon: '🛒' });
    // Store quote items in sessionStorage for POS to pick up
    sessionStorage.setItem('pos_prefill_quote', JSON.stringify({
      quote_id: quote.id,
      quote_number: quote.quote_number,
      customer_name: quote.customer_name,
      customer_doc: quote.customer_doc,
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
      items: quote.quote_items,
    }));
    await supabase.from('quotes').update({ status: 'INVOICED' }).eq('id', quote.id);
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'INVOICED' } : q));
    setDetailQuote(null);
    window.location.hash = '/pos';
  };

  const handleDelete = async (quote: Quote) => {
    if (!window.confirm(`¿Eliminar cotización ${quote.quote_number}?`)) return;
    const { error } = await supabase.from('quotes').delete().eq('id', quote.id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Cotización eliminada');
    setQuotes(prev => prev.filter(q => q.id !== quote.id));
  };

  const nextNumber = nextQuoteNumber(quotes);

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cotizaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Crea y gestiona presupuestos para tus clientes</p>
        </div>
        <button onClick={() => { setEditQuote(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors">
          <Plus size={16} /> Nueva cotización
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Borradores', value: kpis.draft, icon: <Edit3 size={16} />, color: 'bg-slate-100 text-slate-600' },
          { label: 'Enviadas', value: kpis.sent, icon: <Send size={16} />, color: 'bg-blue-100 text-blue-600' },
          { label: 'Aprobadas', value: kpis.approved, icon: <CheckCircle size={16} />, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Tasa conversión', value: `${kpis.conversionRate}%`, icon: <FileText size={16} />, color: 'bg-purple-100 text-purple-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${k.color}`}>{k.icon}</div>
            <p className="text-xl font-bold text-slate-800">{k.value}</p>
            <p className="text-xs text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline valor */}
      {kpis.totalValue > 0 && (
        <div className="bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-200 font-semibold uppercase tracking-wide">Valor en pipeline</p>
            <p className="text-2xl font-bold">{formatMoney(kpis.totalValue)}</p>
            <p className="text-xs text-indigo-200 mt-0.5">Cotizaciones enviadas + aprobadas</p>
          </div>
          <FileText size={40} className="text-indigo-300 opacity-50" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[['ALL','Todas'], ['DRAFT','Borrador'], ['SENT','Enviadas'], ['APPROVED','Aprobadas'], ['EXPIRED','Vencidas'], ['INVOICED','Facturadas']].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Cargando cotizaciones...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText size={32} className="mb-3 opacity-30" />
            <p className="font-semibold">No hay cotizaciones</p>
            <p className="text-sm mt-1">Crea tu primera cotización con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Número</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Vence</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(q => {
                  const cfg = STATUS_CONFIG[q.status];
                  const expired = q.valid_until && new Date(q.valid_until) < new Date() && !['INVOICED','APPROVED'].includes(q.status);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => setDetailQuote(q)} className="font-bold text-indigo-600 hover:underline text-sm">
                          {q.quote_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{q.customer_name}</p>
                        {q.customer_phone && <p className="text-xs text-slate-400">{q.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(q.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {q.valid_until
                          ? <span className={expired ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                              {new Date(q.valid_until + 'T12:00:00').toLocaleDateString('es-CO')}
                              {expired && ' ⚠️'}
                            </span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 text-sm">
                        {formatMoney(q.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setDetailQuote(q)} title="Ver detalle"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => generateQuotePDF(q, company, formatMoney)} title="Descargar PDF"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
                            <Download size={14} />
                          </button>
                          {!['INVOICED'].includes(q.status) && (
                            <button onClick={() => { setEditQuote(q); setShowForm(true); }} title="Editar"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
                              <Edit3 size={14} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(q)} title="Eliminar"
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <QuoteForm
          initial={editQuote}
          products={products}
          companyId={companyId!}
          branchId={branchId}
          nextNumber={nextNumber}
          formatMoney={formatMoney}
          onClose={() => { setShowForm(false); setEditQuote(null); }}
          onSaved={saved => {
            setQuotes(prev => editQuote
              ? prev.map(q => q.id === saved.id ? saved : q)
              : [saved, ...prev]
            );
            setShowForm(false);
            setEditQuote(null);
            setDetailQuote(saved);
          }}
        />
      )}

      {detailQuote && (
        <QuoteDetail
          quote={detailQuote}
          company={company}
          formatMoney={formatMoney}
          onClose={() => setDetailQuote(null)}
          onEdit={() => { setEditQuote(detailQuote); setDetailQuote(null); setShowForm(true); }}
          onConvert={() => handleConvertToInvoice(detailQuote)}
          onStatusChange={status => handleStatusChange(detailQuote, status)}
        />
      )}
    </div>
  );
};

export default Quotes;