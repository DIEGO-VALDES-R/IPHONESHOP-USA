import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { invoice_id } = await req.json()

    // 1. Obtener Factura + Items (Usando tus nombres de columna exactos)
    const { data: inv, error: invError } = await supabase
      .from('invoices')
      .select(`*, invoice_items(*)`)
      .eq('id', invoice_id)
      .single()

    if (invError || !inv) throw new Error("Factura no encontrada")

    const TOKEN = Deno.env.get('FACTUS_TOKEN')

    // --- MODO SIMULACIÓN (Activo mientras no tengas el Token real) ---
    if (!TOKEN || TOKEN === "esperando_token") {
      return new Response(JSON.stringify({
        success: true,
        data: { 
          bill: { 
            cufe: "MOCK-CUFE-" + inv.id, 
            public_url: "https://disenante.com/demo.pdf", 
            qr: "MOCK-QR-DATA" 
          } 
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- MAPEO PARA ENVIAR A FACTUS ---
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
        "name": "Producto Ref: " + (item.product_id || "General"),
        "quantity": item.quantity,
        "price": item.price,
        "tax_id": 1, // IVA 19% estándar
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
    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 400, 
      headers: corsHeaders 
    })
  }
})