import { supabase } from '../supabaseClient';

export type TipoDocumento = 'FEV' | 'POS';

export interface ResultadoFactus {
  success: boolean;
  cufe?: string;
  pdf_url?: string;
  numero_factura?: string;
  environment?: string;
  message?: string;
  error?: string;
  detail?: unknown;
}

/**
 * Emite una factura electrónica (FEV) o documento POS equivalente.
 * @param invoiceId  UUID de la factura en tabla `invoices`
 * @param tipo       'FEV' = Factura electrónica de venta | 'POS' = Documento equivalente
 */
export const emitirFacturaElectronica = async (
  invoiceId: string,
  tipo: TipoDocumento = 'FEV',
): Promise<ResultadoFactus> => {
  try {
    const tipoDocumento = tipo === 'POS' ? '03' : '01';

    const { data, error } = await supabase.functions.invoke('emitir-factura-factus', {
      body: { invoice_id: invoiceId, tipo_documento: tipoDocumento },
    });

    if (error) throw new Error(error.message);

    if (data?.success) {
      return {
        success: true,
        cufe:           data.cufe,
        pdf_url:        data.pdf_url,
        numero_factura: data.numero_factura,
        environment:    data.environment,
        message:        data.message,
      };
    }

    return {
      success: false,
      error: data?.error || 'Error desconocido en Factus',
      detail: data?.detail,
    };
  } catch (err: any) {
    console.error('[dianService] Error:', err);
    return { success: false, error: err.message || 'Error de conexión' };
  }
};

/**
 * Consulta el estado de una factura ya enviada en Factus.
 */
export const consultarEstadoFactus = async (
  cufe: string,
  companyId: string,
): Promise<{ status: string; message?: string }> => {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('config')
      .eq('id', companyId)
      .single();

    const cfg = company?.config || {};
    const token = cfg.factus_token;
    const env   = cfg.factus_env || 'sandbox';

    if (!token) return { status: 'ERROR', message: 'Token Factus no configurado' };

    const base = env === 'production'
      ? 'https://api.factus.com.co'
      : 'https://api-sandbox.factus.com.co';

    const res = await fetch(`${base}/v1/bills/${cufe}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });

    if (!res.ok) return { status: 'ERROR', message: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      status: data.data?.bill?.status_document || 'UNKNOWN',
      message: data.data?.bill?.errors_messages?.[0],
    };
  } catch (err: any) {
    return { status: 'ERROR', message: err.message };
  }
};