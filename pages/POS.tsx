import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, X, Printer, Barcode } from 'lucide-react';
import { Product, ProductType, CartItem, PaymentMethod, Sale } from '../types';
import { toast, Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';
import InvoiceModal from '../components/InvoiceModal';

const POS: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { products, session, processSale, company } = useDatabase();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // IVA Toggle — usa la tasa configurada en Settings
  const defaultTaxRate = company?.config?.tax_rate ?? 19;
  const [applyIva, setApplyIva] = useState(true);

  // Datos cliente
  const [customerName, setCustomerName] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Pago
  const [payments, setPayments] = useState<{method: PaymentMethod, amount: number}[]>([]);
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState('');
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);

  const filteredProducts = useMemo(() =>
    products.filter(p =>
      ((p.stock_quantity ?? 0) > 0 || p.type === 'SERVICE') &&
      (
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    ), [searchTerm, products]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    // CORRECCIÓN: siempre usa defaultTaxRate, no el tax_rate del producto
    const tax = applyIva
      ? subtotal * (defaultTaxRate / 100)
      : 0;
    const total = subtotal + tax;
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const remaining = total - totalPaid;
    return { subtotal, tax, total, totalPaid, remaining };
  }, [cart, payments, applyIva, defaultTaxRate]);

  useEffect(() => {
    if (session?.status === 'OPEN' && !isPaymentModalOpen && !showInvoice) {
      searchInputRef.current?.focus();
    }
  }, [session, isPaymentModalOpen, showInvoice, cart]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm) {
      const exactMatch = products.find(p => p.sku.toLowerCase() === searchTerm.toLowerCase());
      if (exactMatch) { addToCart(exactMatch); setSearchTerm(''); }
      else if (filteredProducts.length === 1) { addToCart(filteredProducts[0]); setSearchTerm(''); }
    }
  };

  const addToCart = (product: Product) => {
    if (session?.status !== 'OPEN') { toast.error('Debe abrir la caja primero'); return; }
    if (product.stock_quantity <= 0 && product.type !== ProductType.SERVICE) { toast.error('Producto sin stock'); return; }

    if (product.type === ProductType.SERIALIZED) {
      const serial = window.prompt(`Ingrese IMEI/Serial para ${product.name}:`);
      if (!serial) return;
      if (cart.find(item => item.product.id === product.id && item.serial_number === serial)) {
        toast.error('Este serial ya esta en el carrito'); return;
      }
      setCart([...cart, { product, quantity: 1, serial_number: serial, price: product.price, tax_rate: defaultTaxRate, discount: 0 }]);
    } else {
      const existing = cart.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) { toast.error('Stock insuficiente'); return; }
        setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      } else {
        setCart([...cart, { product, quantity: 1, price: product.price, tax_rate: defaultTaxRate, discount: 0 }]);
      }
    }
    toast.success('Agregado');
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.product.type === ProductType.SERIALIZED && delta > 0) { toast.error('Escanee la nueva unidad'); return; }
    if (delta > 0 && item.quantity >= item.product.stock_quantity && item.product.type !== ProductType.SERVICE) { toast.error('Stock maximo alcanzado'); return; }
    item.quantity += delta;
    if (item.quantity <= 0) newCart.splice(index, 1);
    setCart(newCart);
  };

  const removeFromCart = (index: number) => { const c = [...cart]; c.splice(index, 1); setCart(c); };

  const addPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (!amount || amount <= 0) return;
    if (amount > totals.remaining + 100) { toast.error('El monto excede el total restante'); return; }
    setPayments([...payments, { method: currentPaymentMethod, amount }]);
    setCurrentPaymentAmount('');
  };

  const removePayment = (index: number) => { const p = [...payments]; p.splice(index, 1); setPayments(p); };

  const handleFinalizeSale = async () => {
    if (Math.abs(totals.remaining) > 100) { toast.error('Debe cubrir el total de la venta'); return; }
    const sale = await processSale({
      customer: customerName || 'Consumidor Final',
      customerDoc, customerEmail, customerPhone,
      items: cart,
      total: totals.total,
      applyIva,
    });
    setLastSale(sale);
    setShowInvoice(true);
    setCart([]); setPayments([]);
    setCustomerName(''); setCustomerDoc(''); setCustomerEmail(''); setCustomerPhone('');
    setIsPaymentModalOpen(false);
  };

  if (session?.status !== 'OPEN') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-100 rounded-xl border border-dashed border-slate-300">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Banknote size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Caja Cerrada</h2>
          <p className="text-slate-500 mb-6">Debe realizar la apertura de caja antes de comenzar a vender.</p>
          <Link to="/cash-control" className="inline-block w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
            Ir a Apertura de Caja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.24))] gap-6 relative">
      <Toaster position="bottom-right" />

      <InvoiceModal isOpen={showInvoice} onClose={() => setShowInvoice(false)} sale={lastSale} company={company} />

      {/* Catalogo */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Escanear Codigo de Barras / SKU / IMEI..."
              className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Barcode size={20} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock_quantity === 0 && product.type !== ProductType.SERVICE}
                className="flex flex-col items-start text-left p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all bg-white group disabled:opacity-50 disabled:bg-slate-50"
              >
                <div className="w-full aspect-square bg-slate-100 rounded-md mb-3 flex items-center justify-center text-slate-300 group-hover:text-blue-400 overflow-hidden">
                  {(product as any).image_url ? (
                    <img src={(product as any).image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone size={40} />
                  )}
                </div>
                <h4 className="font-semibold text-slate-800 line-clamp-2">{product.name}</h4>
                <p className="text-xs text-slate-500 mb-1">{product.sku}</p>
                <div className={`text-xs font-bold mb-2 ${product.stock_quantity === 0 ? 'text-red-500' : 'text-green-600'}`}>
                  Stock: {product.stock_quantity}
                </div>
                <div className="mt-auto w-full flex justify-between items-center">
                  <span className="font-bold text-blue-600">{formatMoney(product.price)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${product.type === ProductType.SERIALIZED ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {product.type === ProductType.SERIALIZED ? 'IMEI' : 'STD'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Carrito */}
      <div className="w-96 flex flex-col bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <ShoppingCart size={20} /> Ticket Actual
          </h2>
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{cart.length} Items</span>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart size={48} className="mb-2 opacity-20" />
              <p>El carrito esta vacio</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className="flex gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-slate-800">{item.product.name}</h4>
                {item.serial_number && <p className="text-xs text-slate-500 font-mono bg-yellow-50 px-1 rounded inline-block">SN: {item.serial_number}</p>}
                <span className="text-xs text-slate-500">{formatMoney(item.price)} x {item.quantity}</span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-bold text-sm">{formatMoney(item.price * item.quantity)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-slate-200 rounded"><Minus size={14} /></button>
                  <button onClick={() => removeFromCart(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          {/* IVA TOGGLE */}
          <button
            onClick={() => setApplyIva(!applyIva)}
            className={`w-full mb-3 py-2 px-4 rounded-lg text-sm font-medium border-2 transition-all flex items-center justify-between ${
              applyIva ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-300 text-slate-500'
            }`}
          >
            <span>IVA {defaultTaxRate}%</span>
            <div className={`w-10 h-5 rounded-full flex items-center transition-all px-0.5 ${applyIva ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'}`}>
              <div className="w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </button>

          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className={`flex justify-between ${applyIva ? 'text-slate-500' : 'text-slate-300'}`}>
              <span>IVA ({defaultTaxRate}%)</span>
              <span>{applyIva ? formatMoney(totals.tax) : 'No aplica'}</span>
            </div>
            <div className="flex justify-between font-bold text-xl text-slate-800 mt-2 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={20} /> Pagar
          </button>
        </div>
      </div>

      {/* Modal Pago */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xl text-slate-800">Procesar Pago</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Cliente</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2" placeholder="Consumidor Final" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CC / NIT</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2" placeholder="222222222" value={customerDoc} onChange={e => setCustomerDoc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" className="w-full border border-slate-300 rounded-lg px-4 py-2" placeholder="cliente@email.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono (WhatsApp)</label>
                  <input type="tel" className="w-full border border-slate-300 rounded-lg px-4 py-2" placeholder="300 123 4567" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-8 mb-8">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-500 mb-2">Total a Pagar</h4>
                  <div className="text-3xl font-bold text-slate-800">{formatMoney(totals.total)}</div>
                  <div className={`text-xs mt-1 font-medium ${applyIva ? 'text-green-600' : 'text-slate-400'}`}>
                    {applyIva ? `IVA ${defaultTaxRate}% incluido` : 'Sin IVA'}
                  </div>
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Pagos Agregados</h5>
                    {payments.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Sin pagos registrados</p>
                    ) : payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 shadow-sm mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-slate-200 px-2 rounded">{p.method}</span>
                          <span className="font-mono">{formatMoney(p.amount)}</span>
                        </div>
                        <button onClick={() => removePayment(idx)} className="text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between font-bold text-sm">
                      <span>Restante:</span>
                      <span className={totals.remaining > 100 ? 'text-red-600' : 'text-green-600'}>{formatMoney(totals.remaining)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <h4 className="text-sm font-bold text-slate-500">Agregar Metodo</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.CREDIT].map(m => (
                      <button key={m} onClick={() => setCurrentPaymentMethod(m)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${currentPaymentMethod === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}>
                        {m === 'CASH' ? 'Efectivo' : m === 'CARD' ? 'Tarjeta' : m === 'CREDIT' ? 'Credito' : 'Transf.'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="number" className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-lg font-bold" placeholder="0"
                      value={currentPaymentAmount} onChange={e => setCurrentPaymentAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPayment()} />
                    <button onClick={addPayment} className="bg-slate-800 text-white px-4 rounded-lg hover:bg-slate-900"><Plus /></button>
                  </div>
                  <button onClick={() => setCurrentPaymentAmount(Math.max(0, totals.remaining).toString())}
                    className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded font-medium">
                    Todo Restante
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-6 py-3 rounded-lg border border-slate-300 font-bold text-slate-600 hover:bg-white">
                Cancelar
              </button>
              <button onClick={handleFinalizeSale} disabled={totals.remaining > 100}
                className="px-6 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:bg-slate-300 flex items-center gap-2">
                <Printer size={20} /> Facturar e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;