import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── FRO-04: CORS restringido a dominio POSmaster ───────────────────────────────
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://posmaster.vercel.app';

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { invoice_id } = await req.json()

    const { data: inv, error: invError } = await supabase
      .from('invoices')
      .select(`*, invoice_items(*)`)
      .eq('id', invoice_id)
      .single()

    if (invError || !inv) throw new Error("Factura no encontrada en la base de datos.")

    const TOKEN = Deno.env.get('FACTUS_TOKEN')

    if (!TOKEN || TOKEN === "esperando_token") {
      const mockResponse = {
        success: true,
        data: {
          bill: {
            cufe: "MOCK-CUFE-" + Math.random().toString(36).substring(7),
            public_url: "https://disenante.com/demo.pdf",
            qr: "MOCK-QR-DATA"
          }
        }
      }
      await supabase.from('invoices').update({
        dian_status: 'exitoso_demo',
        dian_cufe: mockResponse.data.bill.cufe,
        dian_pdf_url: mockResponse.data.bill.public_url
      }).eq('id', invoice_id)
      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const payload = {
      "number": 0,
      "type_document_id": 1,
      "customer": {
        "identification": inv.customer_nit || "222222222222",
        "names": inv.customer_name || "Consumidor Final",
        "email": inv.customer_email || "cliente@tienda.com",
        "type_document_identification_id": 6,
        "type_organization_id": 1,
        "municipality_id": 985,
        "type_regime_id": 1
      },
      "items": inv.invoice_items.map((item: any) => ({
        "name": "Producto ID: " + (item.product_id || "Gral"),
        "quantity": item.quantity,
        "price": item.price,
        "tax_id": 1,
        "discount_value": item.discount || 0
      })),
      "payment_form_id": 1,
      "payment_method_id": 10
    }

    const response = await fetch("https://api-sandbox.factus.com.co/v1/bills/auth", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (result.success) {
      await supabase.from('invoices').update({
        dian_status: 'exitoso',
        dian_cufe: result.data.bill.cufe,
        dian_pdf_url: result.data.bill.public_url,
        dian_qr_data: result.data.bill.qr
      }).eq('id', invoice_id)
    } else {
      await supabase.from('invoices').update({
        dian_status: 'error',
        dian_error_log: JSON.stringify(result.errors || result.message)
      }).eq('id', invoice_id)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: getCorsHeaders(req.headers.get('origin'))
    })
  }
})