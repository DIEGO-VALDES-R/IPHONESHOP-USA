import React from 'react';
import { X, Printer, Share2, QrCode, MessageCircle, Mail, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Sale, Company, SaleStatus } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'react-hot-toast';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
    company: Company;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, sale, company }) => {
    const { formatMoney } = useCurrency();

    if (!isOpen || !sale) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsApp = () => {
        // Simple logic: if phone provided, use it. If not, open whatsapp blank to pick contact.
        // Assume country code +57 (Colombia) if not present, for demo purposes
        const phone = sale.customer_phone;
        const message = `Hola ${sale.customer_name || 'Cliente'}, aquí tienes tu Factura Electrónica ${sale.invoice_number} de ${company.name} por valor de ${formatMoney(sale.total_amount)}. Gracias por tu compra!`;
        const encodedMessage = encodeURIComponent(message);
        
        let url = `https://wa.me/?text=${encodedMessage}`;
        if (phone) {
             // Remove spaces and symbols
             const cleanPhone = phone.replace(/\D/g, '');
             const finalPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;
             url = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
        }
        
        window.open(url, '_blank');
    };

    const handleEmail = () => {
        const email = sale.customer_email;
        const subject = encodeURIComponent(`Factura Electrónica ${sale.invoice_number} - ${company.name}`);
        const body = encodeURIComponent(`Hola ${sale.customer_name},\n\nGracias por tu compra en ${company.name}.\n\nDetalles de la factura:\nNúmero: ${sale.invoice_number}\nTotal: ${formatMoney(sale.total_amount)}\nFecha: ${new Date(sale.created_at).toLocaleDateString()}\n\nPuedes consultar tu factura electrónica en la página de la DIAN con el CUFE adjunto: ${sale.dian_cufe}\n\nAtentamente,\n${company.name}`);
        
        if (!email) {
            // Prompt if email missing in record
            const userEmail = prompt("Ingrese el correo del cliente:");
            if (userEmail) {
                window.location.href = `mailto:${userEmail}?subject=${subject}&body=${body}`;
            }
        } else {
            window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        }
    };

    // Calculate Taxes Breakdown
    const subtotal = sale.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Group taxes by rate for breakdown
    const taxesByRate: Record<number, number> = {};
    sale.items.forEach(item => {
        const taxAmount = (item.price * item.tax_rate / 100) * item.quantity;
        taxesByRate[item.tax_rate] = (taxesByRate[item.tax_rate] || 0) + taxAmount;
    });

    const getStatusBadge = () => {
        switch(sale.status) {
            case SaleStatus.ACCEPTED:
                return <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200"><CheckCircle size={14}/> DIAN: ACEPTADA</div>;
            case SaleStatus.REJECTED:
                return <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200"><XCircle size={14}/> DIAN: RECHAZADA</div>;
            case SaleStatus.SENT_TO_DIAN:
                return <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold border border-blue-200"><Clock size={14}/> ENVIADA DIAN</div>;
            case SaleStatus.PENDING_ELECTRONIC:
                return <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-bold border border-amber-200"><Clock size={14}/> PENDIENTE ENVÍO</div>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:w-full">
                
                {/* Header Actions (No Print) */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
                    <div className="flex flex-col">
                        <h3 className="font-bold text-slate-800">Factura Generada</h3>
                        {getStatusBadge()}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleWhatsApp} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors" title="Enviar por WhatsApp">
                            <MessageCircle size={20} />
                        </button>
                        <button onClick={handleEmail} className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors" title="Enviar por Email">
                            <Mail size={20} />
                        </button>
                        <button onClick={handlePrint} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title="Imprimir">
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Receipt Content */}
                <div className="flex-1 overflow-auto p-8 bg-white text-sm leading-relaxed print:p-0 print:overflow-visible font-mono text-slate-900">
                    
                    {/* Header Factura */}
                    <div className="text-center mb-6">
                        <h2 className="font-bold text-xl uppercase mb-1">{company.name}</h2>
                        <p>NIT: {company.nit}</p>
                        <p>{company.address}</p>
                        <p>Tel: {company.phone}</p>
                        <p className="text-xs mt-2 text-slate-500">{company.email}</p>
                        
                        <div className="my-4 border-t border-b border-slate-300 py-2">
                            <p className="font-bold">FACTURA ELECTRÓNICA DE VENTA</p>
                            <p className="font-bold text-lg">{sale.invoice_number}</p>
                        </div>

                        <div className="text-xs text-slate-500 mb-4">
                            <p>Res. DIAN No. {company.config?.dian_resolution}</p>
                            <p>Fecha: {company.config?.dian_date} | Rango: {company.config?.dian_range_from} a {company.config?.dian_range_to}</p>
                        </div>
                    </div>

                    {/* Info Cliente */}
                    <div className="mb-6 space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Fecha Emisión:</span>
                            <span>{new Date(sale.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Cliente:</span>
                            <span className="font-bold uppercase">{sale.customer_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">C.C./NIT:</span>
                            <span>{sale.customer_document || '222222222222'}</span>
                        </div>
                        {(sale.customer_phone || sale.customer_email) && (
                            <div className="text-xs text-slate-400 mt-1">
                                {sale.customer_phone && <span>Tel: {sale.customer_phone} </span>}
                                {sale.customer_email && <span>Email: {sale.customer_email}</span>}
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <table className="w-full mb-6 border-collapse">
                        <thead>
                            <tr className="border-b border-black text-xs">
                                <th className="text-left py-1">Cant.</th>
                                <th className="text-left py-1">Desc.</th>
                                <th className="text-right py-1">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sale.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-slate-100">
                                    <td className="py-2 align-top">{item.quantity}</td>
                                    <td className="py-2 align-top">
                                        <div>{item.product.name}</div>
                                        {item.serial_number && (
                                            <div className="text-[10px] text-slate-500">SN: {item.serial_number}</div>
                                        )}
                                    </td>
                                    <td className="py-2 text-right align-top">{formatMoney(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="space-y-1 mb-6 border-t border-black pt-2">
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>{formatMoney(subtotal)}</span>
                        </div>
                        {Object.entries(taxesByRate).map(([rate, amount]) => (
                             <div key={rate} className="flex justify-between text-xs text-slate-600">
                                <span>IVA ({rate}%):</span>
                                <span>{formatMoney(amount)}</span>
                             </div>
                        ))}
                        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-slate-300">
                            <span>TOTAL A PAGAR:</span>
                            <span>{formatMoney(sale.total_amount)}</span>
                        </div>
                    </div>

                    {/* DIAN Footer */}
                    {sale.dian_cufe ? (
                        <div className="text-center space-y-4">
                            <div className="text-[10px] text-slate-400 break-all leading-tight bg-slate-50 p-2 rounded">
                                <span className="font-bold">CUFE:</span> {sale.dian_cufe}
                            </div>
                            
                            <div className="flex justify-center my-4">
                                <QrCode size={128} className="text-slate-900"/>
                            </div>
                            
                            <p className="text-xs italic text-slate-500">
                                Representación gráfica de la factura electrónica.
                                Consulte su documento en la página de la DIAN.
                            </p>
                        </div>
                    ) : (
                         <div className="text-center space-y-4 bg-amber-50 p-4 rounded-lg border border-amber-100">
                             <AlertTriangle size={32} className="text-amber-500 mx-auto" />
                             <p className="text-xs font-bold text-amber-700">Factura Electrónica en Proceso de Envío</p>
                             <p className="text-[10px] text-amber-600">El CUFE y el QR se generarán una vez la DIAN valide el documento.</p>
                         </div>
                    )}
                    
                    <p className="text-xs font-bold mt-6 text-center">
                        ¡GRACIAS POR SU COMPRA!
                    </p>

                </div>
            </div>
            
            {/* Estilos específicos de impresión */}
            <style>{`
                @media print {
                    @page {
                        margin: 0;
                        size: 80mm 297mm; /* Tamaño térmico aprox */
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print\\:fixed {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        visibility: visible;
                        display: block !important;
                    }
                    .print\\:fixed * {
                        visibility: visible;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default InvoiceModal;