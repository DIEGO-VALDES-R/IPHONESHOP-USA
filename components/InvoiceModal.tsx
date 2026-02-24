import React, { useRef, useState } from 'react';
import {
  X, Printer, QrCode, MessageCircle, Mail,
  CheckCircle, XCircle, Clock, AlertTriangle,
  Download, Loader
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SaleItem {
  product_name?: string;
  name?: string;
  product?: { name: string };
  quantity: number;
  price: number;
  tax_rate: number;
  serial_number?: string;
  discount?: number;
}

interface SaleData {
  id: string;
  invoice_number: string;
  customer_name?: string;
  customer_document?: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount: number;
  subtotal?: number;
  tax_amount?: number;
  status?: string;
  created_at: string;
  dian_cufe?: string;
  items?: SaleItem[];
  invoice_items?: SaleItem[];
  _cartItems?: SaleItem[];
}

interface CompanyData {
  name?: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  config?: {
    dian_resolution?: string;
    dian_date?: string;
    dian_range_from?: string;
    dian_range_to?: string;
  };
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleData | null;
  company: CompanyData | null;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, sale, company }) => {
  const { formatMoney } = useCurrency();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  if (!isOpen || !sale) return null;

  const items: SaleItem[] = (
    sale._cartItems || sale.items || sale.invoice_items || []
  ).map((item: any) => ({
    product_name: item.product?.name || item.product_name || item.name || 'Producto',
    quantity: item.quantity || 1,
    price: item.price || 0,
    tax_rate: item.tax_rate ?? 0,
    serial_number: item.serial_number,
    discount: item.discount || 0,
  }));

  // Usar directamente los valores guardados en la venta (ya calculados correctamente en el POS)
  const subtotal = sale.subtotal != null ? sale.subtotal : items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const taxAmount = sale.tax_amount != null ? sale.tax_amount : 0;
  const showIva = taxAmount > 0;
  const companyName = company?.name ?? 'IPHONESHOP USA';

  // Captura el elemento completo sin cortar por scroll
  const captureFullElement = async (element: HTMLDivElement) => {
    const originalHeight = element.style.height;
    const originalMaxHeight = element.style.maxHeight;
    const originalOverflow = element.style.overflow;

    element.style.height = element.scrollHeight + 'px';
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    await new Promise(resolve => setTimeout(resolve, 150));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.offsetWidth,
      height: element.scrollHeight,
      windowWidth: element.offsetWidth,
      windowHeight: element.scrollHeight,
      scrollY: 0,
      scrollX: 0,
    });

    element.style.height = originalHeight;
    element.style.maxHeight = originalMaxHeight;
    element.style.overflow = originalOverflow;

    return canvas;
  };

  const generateAndUploadPdf = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    try {
      const canvas = await captureFullElement(receiptRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output('blob');

      const fileName = `facturas/${sale.invoice_number}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('invoices-pdf')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error('Error subiendo PDF:', uploadError);
        return null;
      }

      const { data } = supabase.storage.from('invoices-pdf').getPublicUrl(fileName);
      setPdfUrl(data.publicUrl);
      return data.publicUrl;
    } catch (err) {
      console.error('Error generando PDF:', err);
      return null;
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await captureFullElement(receiptRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Factura-${sale.invoice_number}.pdf`);
    } catch (err) {
      console.error('Error descargando PDF:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    setGeneratingPdf(true);
    try {
      let url = pdfUrl;
      if (!url) url = await generateAndUploadPdf();

      const phone = sale.customer_phone?.replace(/\D/g, '');
      const finalPhone = phone && phone.length === 10 ? `57${phone}` : phone;

      let msg = `Hola ${sale.customer_name || 'Cliente'} 👋\n\nTe enviamos tu factura *${sale.invoice_number}* de *${companyName}*.\n\n💰 Total: *${formatMoney(sale.total_amount)}*`;
      if (url) msg += `\n\n📄 Ver/Descargar tu factura PDF:\n${url}`;
      msg += `\n\n¡Gracias por tu compra! 🙏`;

      window.open(
        finalPhone
          ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`,
        '_blank'
      );
    } catch (err) {
      console.error('Error en handleWhatsApp:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleEmail = async () => {
    setGeneratingPdf(true);
    try {
      let url = pdfUrl;
      if (!url) url = await generateAndUploadPdf();

      const target = sale.customer_email || prompt('Ingrese el correo del cliente:');
      if (!target) return;

      const subject = encodeURIComponent(`Factura ${sale.invoice_number} - ${companyName}`);
      let bodyText = `Hola ${sale.customer_name || 'Cliente'},\n\nGracias por tu compra en ${companyName}.\n\nFactura: ${sale.invoice_number}\nTotal: ${formatMoney(sale.total_amount)}`;
      if (url) bodyText += `\n\nDescarga tu factura PDF aquí:\n${url}`;
      bodyText += `\n\n¡Gracias por preferirnos!\n${companyName}\nTel: ${company?.phone || ''}\n${company?.email || ''}`;

      window.location.href = `mailto:${target}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    } catch (err) {
      console.error('Error en handleEmail:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => setTimeout(() => window.print(), 300);

  const getStatusBadge = () => {
    const s = sale.status;
    if (s === 'ACCEPTED') return (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold flex items-center gap-1">
        <CheckCircle size={12} /> DIAN: ACEPTADA
      </span>
    );
    if (s === 'REJECTED') return (
      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold flex items-center gap-1">
        <XCircle size={12} /> DIAN: RECHAZADA
      </span>
    );
    if (s === 'PENDING_ELECTRONIC') return (
      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold flex items-center gap-1">
        <Clock size={12} /> PENDIENTE ENVÍO
      </span>
    );
    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden relative">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden flex-shrink-0">
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-slate-800">Factura Generada</h3>
            {getStatusBadge()}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={handleWhatsApp}
              disabled={generatingPdf}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              title="Enviar por WhatsApp con PDF"
            >
              {generatingPdf ? <Loader size={18} className="animate-spin" /> : <MessageCircle size={18} />}
            </button>
            <button
              onClick={handleEmail}
              disabled={generatingPdf}
              className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
              title="Enviar por Email con PDF"
            >
              {generatingPdf ? <Loader size={18} className="animate-spin" /> : <Mail size={18} />}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              title="Descargar PDF"
            >
              {generatingPdf ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
            </button>
            <button
              onClick={handlePrint}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              title="Imprimir"
            >
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Link PDF listo */}
        {pdfUrl && (
          <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2 print:hidden flex-shrink-0">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-xs text-green-700 font-medium">PDF listo —</span>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate">
              Ver PDF
            </a>
          </div>
        )}

        {/* Overlay carga */}
        {generatingPdf && (
          <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center gap-3 print:hidden rounded-xl">
            <Loader size={36} className="animate-spin text-blue-600" />
            <p className="text-slate-600 font-medium text-sm">Generando PDF completo...</p>
          </div>
        )}

        {/* Receipt */}
        <div
          ref={receiptRef}
          id="invoice-print-area"
          className="flex-1 overflow-auto p-6 bg-white text-sm font-mono text-slate-900"
        >
          {/* Empresa */}
          <div className="text-center mb-6">
            {company?.logo_url && (
              <div className="flex justify-center mb-4">
                <img
                  src={company.logo_url}
                  alt="Logo"
                  crossOrigin="anonymous"
                  className="w-auto object-contain"
                  style={{ height: '90px', maxWidth: '220px' }}
                />
              </div>
            )}
            <h2 className="font-bold text-xl uppercase mb-1">{companyName}</h2>
            <p>NIT: {company?.nit ?? '—'}</p>
            <p>{company?.address ?? ''}</p>
            <p>Tel: {company?.phone ?? ''}</p>
            <p className="text-xs text-slate-500">{company?.email ?? ''}</p>
            <div className="my-4 border-t border-b border-slate-300 py-2">
              <p className="font-bold">FACTURA ELECTRÓNICA DE VENTA</p>
              <p className="font-bold text-lg">{sale.invoice_number}</p>
            </div>
            {company?.config?.dian_resolution && (
              <div className="text-xs text-slate-500 mb-4">
                <p>Res. DIAN No. {company.config.dian_resolution}</p>
                <p>Fecha: {company.config.dian_date} | Rango: {company.config.dian_range_from} a {company.config.dian_range_to}</p>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="mb-6 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha:</span>
              <span>{new Date(sale.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-bold uppercase">{sale.customer_name || 'Consumidor Final'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">C.C./NIT:</span>
              <span>{sale.customer_document || '222222222222'}</span>
            </div>
          </div>

          {/* Items */}
          <table className="w-full mb-6 text-xs border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1">Cant.</th>
                <th className="text-left py-1">Descripción</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-slate-400 py-4">Sin items</td>
                </tr>
              ) : items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 align-top">{item.quantity}</td>
                  <td className="py-2 align-top">
                    <div>{item.product_name}</div>
                    {item.serial_number && (
                      <div className="text-[10px] text-slate-500">SN: {item.serial_number}</div>
                    )}
                  </td>
                  <td className="py-2 text-right align-top">{formatMoney(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className="space-y-1 mb-6 border-t border-black pt-2 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {showIva ? (
              <div className="flex justify-between text-slate-600">
                <span>IVA:</span>
                <span>{formatMoney(taxAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-400">
                <span>IVA:</span>
                <span>No aplica</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-slate-300">
              <span>TOTAL A PAGAR:</span>
              <span>{formatMoney(sale.total_amount)}</span>
            </div>
          </div>

          {/* DIAN / QR */}
          {sale.dian_cufe ? (
            <div className="text-center space-y-3">
              <div className="text-[10px] text-slate-400 break-all bg-slate-50 p-2 rounded">
                <span className="font-bold">CUFE:</span> {sale.dian_cufe}
              </div>
              <div className="flex justify-center my-4">
                <QrCode size={100} className="text-slate-900" />
              </div>
              <p className="text-[10px] italic text-slate-500">Consulte su documento en la página de la DIAN.</p>
            </div>
          ) : (
            <div className="text-center bg-amber-50 p-4 rounded-lg border border-amber-100">
              <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-amber-700">Factura en Proceso de Envío</p>
              <p className="text-[10px] text-amber-600">El CUFE se generará una vez la DIAN valide el documento.</p>
            </div>
          )}

          {/* TÉRMINOS Y CONDICIONES */}
          <div className="mt-6 pt-4 border-t border-slate-300 text-[9px] text-slate-500 leading-tight space-y-3">
            <p className="font-bold uppercase text-slate-700 text-[10px] text-center tracking-wide">
              Términos y Condiciones de Garantía
            </p>
            <div>
              <p className="font-bold text-slate-600 mb-0.5 uppercase text-[9px]">Condiciones de Recepción de Equipos</p>
              <p>• No se reciben equipos destapados o con sellos de garantía violados</p>
              <p>• No se reciben equipos que no enciendan al momento de la recepción</p>
              <p>• No se reciben equipos con humedad, corrosión o daño por líquidos</p>
              <p>• No se reciben equipos con golpes o daños físicos no reportados al momento de la compra</p>
            </div>
            <div>
              <p className="font-bold text-slate-600 mb-0.5 uppercase text-[9px]">Exclusiones de Garantía</p>
              <p>• Pantallas (Display) y vidrios no tienen cobertura de garantía</p>
              <p>• Daños ocasionados por mal uso, caídas o golpes</p>
              <p>• Daños por líquidos o humedad</p>
              <p>• Equipos que hayan sido intervenidos por terceros no autorizados</p>
              <p>• Accesorios (cables, audífonos, cargadores) tienen garantía de 30 días</p>
              <p>• No se responde por extravío o hurto del equipo</p>
              <p>• No se responde por bloqueo de iCloud o Activation Lock</p>
              <p>• No se responde por equipos con reporte de robo ante operadores o autoridades</p>
            </div>
            <div>
              <p className="font-bold text-slate-600 mb-0.5 uppercase text-[9px]">Proceso de Garantía</p>
              <p>• El proceso de garantía tiene una duración de 8 días hábiles</p>
              <p>• No se realizan devoluciones de dinero; se aplica cambio del producto o nota crédito</p>
              <p>• El cliente debe presentar su factura original para hacer válida la garantía</p>
              <p>• Los equipos deben entregarse con sus accesorios y empaque original</p>
            </div>
            <div className="pt-1 border-t border-slate-200 text-center">
              <p className="font-bold text-slate-600">Contacto: 316-154 55 54 | WhatsApp disponible</p>
            </div>
          </div>

          <p className="text-xs font-bold mt-6 text-center">¡GRACIAS POR SU COMPRA!</p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoiceModal;