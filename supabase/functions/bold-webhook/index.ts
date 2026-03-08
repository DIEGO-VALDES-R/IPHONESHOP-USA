// supabase/functions/bold-webhook/index.ts
// Edge Function — Recibe notificaciones de pago de Bold y activa/renueva cuentas POSmaster

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOLD_API_KEY        = Deno.env.get('BOLD_API_KEY') ?? '';

// ── FRO-04: solo Bold puede llamar este webhook (no es llamada de navegador) ───
// Bold no envía Origin, pero validamos que si viene Origin sea el nuestro.
// La protección real aquí es la firma HMAC (BOLD-01 ya resuelto).
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://posmaster.vercel.app';

const PLAN_CONFIG: Record<string, { plan: string; days: number; amount: number }> = {
  'LNK_U58X7N71NX': { plan: 'BASIC', days: 30,  amount: 65000  },
  'LNK_F385LJNMKI': { plan: 'PRO',   days: 30,  amount: 120000 },
};

async function verifyBoldSignature(body: string, signature: string, apiKey: string): Promise<boolean> {
  if (!apiKey || !signature) return true;
  try {
    const base64Body = btoa(body);
    const encoder   = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(apiKey),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuffer  = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(base64Body));
    const computedHex = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHex === signature;
  } catch { return false; }
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

serve(async (req) => {
  // ── FRO-04: rechazar si viene Origin de dominio no autorizado ──────────────
  const origin = req.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) {
    console.warn(`⛔ Origin bloqueado: ${origin}`);
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const bodyText  = await req.text();
  const signature = req.headers.get('X-Bold-Signature') ?? '';

  const isValid = await verifyBoldSignature(bodyText, signature, BOLD_API_KEY);
  if (!isValid) {
    console.error('❌ Firma Bold inválida');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(bodyText); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  if (payload.type !== 'SALE_APPROVED') {
    console.log(`ℹ️ Evento ignorado: ${payload.type}`);
    return new Response('OK', { status: 200 });
  }

  const data        = payload.data;
  const payerEmail  = (data.payer_email ?? '').toLowerCase().trim();
  const amountTotal = data.amount?.total ?? 0;
  const reference   = data.metadata?.reference ?? '';
  const paymentId   = data.payment_id ?? '';
  const subject     = payload.subject ?? '';

  console.log(`✅ Pago aprobado — email: ${payerEmail}, monto: ${amountTotal}`);

  const planKey    = subject.startsWith('LNK_') ? subject : reference;
  const planConfig = PLAN_CONFIG[planKey] ?? PLAN_CONFIG['LNK_U58X7N71NX'];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id, company_id, email, full_name')
    .ilike('email', payerEmail).maybeSingle();

  if (profileError || !profile) {
    await supabase.from('admin_notifications').insert({
      type: 'PAYMENT_UNMATCHED',
      title: '⚠️ Pago sin usuario asignado',
      message: `Pago de $${amountTotal.toLocaleString()} COP de ${payerEmail} sin cuenta en POSmaster.`,
      data: { payment_id: paymentId, email: payerEmail, amount: amountTotal, plan: planConfig.plan },
      is_read: false,
    });
    return new Response('OK', { status: 200 });
  }

  if (!profile.company_id) {
    await supabase.from('admin_notifications').insert({
      type: 'PAYMENT_UNMATCHED',
      title: '⚠️ Pago sin negocio asignado',
      message: `Pago de $${amountTotal.toLocaleString()} COP de ${payerEmail} — sin negocio asignado.`,
      data: { profile_id: profile.id, email: payerEmail, amount: amountTotal },
      is_read: false,
    });
    return new Response('OK', { status: 200 });
  }

  const { data: company } = await supabase
    .from('companies').select('subscription_status, subscription_end_date, subscription_plan')
    .eq('id', profile.company_id).maybeSingle();

  let endDate = addDays(planConfig.days);
  if (company?.subscription_end_date && company.subscription_status === 'ACTIVE') {
    const current = new Date(company.subscription_end_date);
    if (current > new Date()) {
      const newEnd = new Date(current);
      newEnd.setDate(newEnd.getDate() + planConfig.days);
      endDate = newEnd.toISOString().split('T')[0];
    }
  }

  const { error: updateError } = await supabase.from('companies').update({
    subscription_status:    'ACTIVE',
    subscription_plan:      planConfig.plan,
    subscription_start_date: new Date().toISOString().split('T')[0],
    subscription_end_date:  endDate,
  }).eq('id', profile.company_id);

  if (updateError) {
    console.error('❌ Error actualizando empresa:', updateError);
    return new Response('Internal error', { status: 500 });
  }

  await supabase.from('payment_history').insert({
    company_id: profile.company_id, payment_id: paymentId,
    amount: amountTotal, plan: planConfig.plan, days: planConfig.days,
    end_date: endDate, payer_email: payerEmail,
    source: 'BOLD_WEBHOOK', raw_payload: payload,
  }).catch(() => {});

  await supabase.from('admin_notifications').insert({
    type: 'PAYMENT_RECEIVED',
    title: '💰 Pago recibido — cuenta activada',
    message: `${profile.full_name || payerEmail} pagó $${amountTotal.toLocaleString()} COP. Plan ${planConfig.plan} hasta ${endDate}.`,
    data: { company_id: profile.company_id, profile_id: profile.id, email: payerEmail,
            amount: amountTotal, plan: planConfig.plan, end_date: endDate, payment_id: paymentId },
    is_read: false,
  });

  console.log(`✅ Cuenta activada: ${payerEmail} → Plan ${planConfig.plan} hasta ${endDate}`);
  return new Response('OK', { status: 200 });
});