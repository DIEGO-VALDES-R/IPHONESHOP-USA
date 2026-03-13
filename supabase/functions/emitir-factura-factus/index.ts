import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────────────────────────────────────────
// EDGE FUNCTION: emitir-factura-factus
// Emite facturas electrónicas (FEV) y documentos equivalentes POS
// a través de la API de Factus (sandbox y producción).
//
// Cada empresa usa SU PROPIO token de Factus — guardado en
// company.config.factus_token (cifrado en Supabase).
//
// Factus sandbox: https://api-sandbox.factus.com.co
// Factus producción: https://api.factus.com.co
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ── Mapeo tipos de documento cliente → código Factus ─────────────────────────
const DOC_TYPE_MAP: Record<string, string> = {
  CC:  '13',   // Cédula de ciudadanía
  CE:  '22',   // Cédula de extranjería
  NIT: '31',   // NIT
  PAS: '41',   // Pasaporte
  TI:  '12',   // Tarjeta de identidad
  RC:  '11',   // Registro civil
  DE:  '50',   // NIT de otro país
};

// ── Mapeo métodos de pago → código Factus ────────────────────────────────────
const PAYMENT_METHOD_MAP: Record<string, string> = {
  CASH:     '10',   // Efectivo
  CARD:     '48',   // Tarjeta crédito/débito
  TRANSFER: '42',   // Transferencia bancaria
  CREDIT:   'ZZZ',  // Crédito (a plazo)
  PAYPAL:   '48',   // Asimilado tarjeta
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── 1. Autenticación ────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'No autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role para leer config sensible
    );

    // Verificar usuario
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: 'Sesión inválida' }, 401);

    // ── 2. Leer parámetros ──────────────────────────────────────────────────
    const body = await req.json();
    const { invoice_id, tipo_documento } = body;
    // tipo_documento: '01' = FEV (factura electrónica), '03' = POS equivalente
    const tipoDoc = tipo_documento || '01';

    if (!invoice_id) return json({ success: false, error: 'invoice_id requerido' }, 400);

    // ── 3. Leer la factura completa ─────────────────────────────────────────
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (
          id, quantity, price, tax_rate, discount, total,
          products (id, name, sku, description)
        ),
        customers (
          id, name, document_type, document_number, email, address, phone
        ),
        companies (
          id, name, nit, email, phone, address, config
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invErr || !invoice) return json({ success: false, error: 'Factura no encontrada' }, 404);

    // ── 4. Verificar que no esté ya enviada ─────────────────────────────────
    if (['ACCEPTED', 'SENT_TO_DIAN'].includes(invoice.status) && invoice.dian_cufe) {
      return json({
        success: false,
        error: 'Esta factura ya fue enviada a la DIAN',
        cufe: invoice.dian_cufe,
      }, 409);
    }

    // ── 5. Obtener config Factus de la empresa ──────────────────────────────
    const company = invoice.companies;
    const cfg = company.config || {};
    const factusToken  = cfg.factus_token;
    const factusEnv    = cfg.factus_env || 'sandbox';   // 'sandbox' | 'production'
    const prefijo      = cfg.dian_prefix || 'SETP';
    const resolucion   = cfg.dian_resolution || '';
    const rangeFrom    = cfg.dian_range_from || 1;
    const rangeTo      = cfg.dian_range_to || 5000000;
    const resolucionFecha = cfg.dian_resolution_date || '';
    const nitEmpresa   = company.nit?.replace(/[^0-9]/g, '') || '';
    const digitoNIT    = cfg.dian_nit_digit ?? '0'; // dígito de verificación

    if (!factusToken) {
      return json({
        success: false,
        error: 'Token de Factus no configurado. Ve a Configuración → Facturación DIAN.',
      }, 422);
    }

    if (!resolucion) {
      return json({
        success: false,
        error: 'Resolución DIAN no configurada. Ve a Configuración → Facturación DIAN.',
      }, 422);
    }

    const FACTUS_BASE = factusEnv === 'production'
      ? 'https://api.factus.com.co'
      : 'https://api-sandbox.factus.com.co';

    // ── 6. Obtener número correlativo de la factura ─────────────────────────
    // Usar invoice_number ya guardado, o calcular el siguiente
    let numeroFactura = invoice.invoice_number?.replace(/\D/g, '') || '1';
    // Si el invoice_number tiene prefijo (ej: POS-0001), extraer solo el número
    const numMatch = invoice.invoice_number?.match(/(\d+)$/);
    if (numMatch) numeroFactura = numMatch[1];

    // ── 7. Mapear items ─────────────────────────────────────────────────────
    const items = (invoice.invoice_items || []).map((item: any, idx: number) => {
      const product = item.products;
      const unitPrice = parseFloat(item.price);
      const qty = item.quantity;
      const taxPct = parseFloat(item.tax_rate) || 0;
      const disc = parseFloat(item.discount) || 0;

      // Factus espera precio sin IVA en unit_price
      const unitPriceSinIva = taxPct > 0 ? unitPrice / (1 + taxPct / 100) : unitPrice;
      const subtotalItem = unitPriceSinIva * qty - disc;
      const taxAmount = subtotalItem * (taxPct / 100);

      return {
        code_reference: product?.sku || `ITEM-${idx + 1}`,
        name: product?.name || `Producto ${idx + 1}`,
        quantity: qty,
        discount_rate: disc > 0 ? ((disc / (unitPriceSinIva * qty)) * 100).toFixed(2) : '0.00',
        price: unitPriceSinIva.toFixed(2),
        tax_rate: taxPct.toFixed(2),
        // Código de impuesto: 01 = IVA, 04 = Excluido
        taxes: taxPct > 0
          ? [{ tax_rate_code: taxPct === 19 ? '19.00' : taxPct.toFixed(2) }]
          : [],
        unit_measure_id: 70,   // 70 = Unidad
        standard_code_id: 1,   // 1 = estándar de producto
        is_excluded: taxPct === 0 ? 1 : 0,
      };
    });

    // ── 8. Mapear cliente ───────────────────────────────────────────────────
    const customer = invoice.customers;
    const docType = DOC_TYPE_MAP[customer?.document_type || 'CC'] || '13';
    const docNum  = customer?.document_number || '222222222222';
    const custName = customer?.name || 'Consumidor Final';

    // Consumidor final (sin documento)
    const isConsumidorFinal = !customer?.document_number || customer.document_number === '0';

    const buyerPayload = isConsumidorFinal
      ? {
          identification: '222222222222',
          dv: null,
          company: null,
          trade_name: null,
          names: 'Consumidor',
          address: null,
          email: 'consumidor@factus.com.co',
          mobile: null,
          phone: null,
          type_document_identification_id: 13,   // CC genérico consumidor final
          type_organization_id: 2,               // 1=persona jurídica, 2=natural
          municipality_id: 149,                  // Bogotá por defecto
          type_regime_id: 2,                     // 2=No responsable IVA
          type_liability_id: 117,                // R-99-PN = no aplica
          type_currency_id: 35,                  // COP
        }
      : {
          identification: docNum,
          dv: null,
          company: custName,
          trade_name: custName,
          names: custName,
          address: customer?.address || 'No registrada',
          email: customer?.email || 'sin@email.com',
          mobile: customer?.phone || null,
          phone: customer?.phone || null,
          type_document_identification_id: parseInt(docType, 10),
          type_organization_id: docType === '31' ? 1 : 2,
          municipality_id: 149,
          type_regime_id: 2,
          type_liability_id: 117,
          type_currency_id: 35,
        };

    // ── 9. Método de pago dominante ─────────────────────────────────────────
    let paymentMethods: any[] = [];
    if (invoice.payment_method && Array.isArray(invoice.payment_method)) {
      paymentMethods = invoice.payment_method.map((pm: any) => ({
        payment_method_code: PAYMENT_METHOD_MAP[pm.method] || '10',
        amount: parseFloat(pm.amount).toFixed(2),
        time_days: pm.method === 'CREDIT' ? '30' : '0',
      }));
    } else {
      paymentMethods = [{
        payment_method_code: PAYMENT_METHOD_MAP[invoice.payment_method] || '10',
        amount: parseFloat(invoice.total_amount).toFixed(2),
        time_days: '0',
      }];
    }

    // ── 10. Construir payload Factus ────────────────────────────────────────
    const subtotalSinIVA = parseFloat(invoice.subtotal) - parseFloat(invoice.tax_amount || '0');
    const fechaHoy = new Date().toISOString().split('T')[0];

    const factusPayload = {
      document: tipoDoc,                    // '01' FEV, '03' POS equivalente
      numbering_range_id: null,            // null = Factus elige la resolución activa
      reference_code: invoice.invoice_number,
      observation: invoice.notes || null,
      payment_form: paymentMethods[0]?.time_days === '0' ? '1' : '2',  // 1=contado, 2=crédito
      payment_due_date: fechaHoy,
      payment_method_code: paymentMethods[0]?.payment_method_code || '10',
      billing_period: null,
      order_reference: null,
      customer: buyerPayload,
      items,
      withholding_taxes: [],
    };

    // ── 11. Enviar a Factus ─────────────────────────────────────────────────
    const endpoint = tipoDoc === '03'
      ? `${FACTUS_BASE}/v1/bills/pos`
      : `${FACTUS_BASE}/v1/bills/validate`;

    console.log(`Enviando a Factus (${factusEnv}):`, endpoint);

    const factusRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${factusToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(factusPayload),
    });

    const factusData = await factusRes.json();
    console.log('Respuesta Factus:', JSON.stringify(factusData));

    // ── 12. Procesar respuesta ──────────────────────────────────────────────
    if (!factusRes.ok || factusData.status === 'error') {
      // Guardar intento fallido
      await supabase.from('invoices').update({
        status: 'REJECTED',
        dian_qr_data: JSON.stringify({ factus_error: factusData }),
      }).eq('id', invoice_id);

      return json({
        success: false,
        error: factusData.message || factusData.errors?.join(', ') || 'Error en Factus',
        detail: factusData,
      }, 422);
    }

    // ── 13. Éxito — guardar CUFE y URL del PDF ──────────────────────────────
    const bill = factusData.data?.bill || factusData.bill || {};
    const cufe    = bill.cufe || bill.uuid || '';
    const pdfUrl  = bill.public_url || bill.pdf_url || '';
    const qrStr   = bill.qr_data || bill.qr || '';

    await supabase.from('invoices').update({
      status: 'ACCEPTED',
      dian_cufe: cufe,
      dian_qr_data: qrStr || JSON.stringify({ cufe, pdf: pdfUrl }),
    }).eq('id', invoice_id);

    // Guardar en electronic_documents si la tabla existe
    await supabase.from('electronic_documents').upsert({
      company_id: invoice.company_id,
      sale_id: invoice_id,
      cufe,
      qr_data: qrStr,
      status: 'ACCEPTED',
      dian_response: JSON.stringify(factusData),
      sent_at: new Date().toISOString(),
      validated_at: new Date().toISOString(),
    }, { onConflict: 'sale_id', ignoreDuplicates: false }).select();

    return json({
      success: true,
      cufe,
      pdf_url: pdfUrl,
      numero_factura: bill.number || bill.bill_number || numeroFactura,
      environment: factusEnv,
      message: tipoDoc === '03' ? 'Documento POS emitido' : 'Factura electrónica validada por DIAN',
    });

  } catch (err: any) {
    console.error('Error en emitir-factura-factus:', err);
    return json({ success: false, error: 'Error interno', detail: err.message }, 500);
  }
});
