// supabase/functions/bold-webhook/index.ts
// Edge Function — Recibe notificaciones de pago de Bold y activa/renueva cuentas POSmaster

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOLD_API_KEY = Deno.env.get('BOLD_API_KEY') ?? ''; // Llave de identidad Bold

// Mapeo de referencia/link → plan y duración
// La "reference" que Bold devuelve = el link ID (LNK_...) o una referencia custom
const PLAN_CONFIG: Record<string, { plan: string; days: number; amount: number }> = {
  'LNK_U58X7N71NX': { plan: 'BASIC', days: 30,  amount: 65000  }, // BASIC mensual
  'LNK_F385LJNMKI': { plan: 'PRO',   days: 30,  amount: 120000 }, // PRO mensual
  // Agrega aquí los links de 6 meses y anuales cuando los crees en Bold
  // 'LNK_XXXXXX': { plan: 'BASIC', days: 180, amount: 330000 },
  // 'LNK_YYYYYY': { plan: 'BASIC', days: 365, amount: 540000 },
};

// ── VERIFICAR FIRMA BOLD ──────────────────────────────────────────────────────
async function verifyBoldSignature(body: string, signature: string, apiKey: string): Promise<boolean> {
  if (!apiKey || !signature) return true; // En dev sin key, pasar siempre
  try {
    const base64Body = btoa(body);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const msgData = encoder.encode(base64Body);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const computedHex = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHex === signature;
  } catch {
    return false;
  }
}

// ── CALCULAR FECHA DE VENCIMIENTO ─────────────────────────────────────────────
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────
serve(async (req) => {
  // Solo POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const bodyText = await req.text();
  const signature = req.headers.get('X-Bold-Signature') ?? '';

  // Verificar firma (seguridad)
  const isValid = await verifyBoldSignature(bodyText, signature, BOLD_API_KEY);
  if (!isValid) {
    console.error('❌ Firma Bold inválida');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Solo procesar ventas aprobadas
  if (payload.type !== 'SALE_APPROVED') {
    console.log(`ℹ️ Evento ignorado: ${payload.type}`);
    return new Response('OK', { status: 200 });
  }

  const data = payload.data;
  const payerEmail = (data.payer_email ?? '').toLowerCase().trim();
  const amountTotal = data.amount?.total ?? 0;
  const reference = data.metadata?.reference ?? '';   // referencia custom si la usas
  const paymentId = data.payment_id ?? '';
  const subject = payload.subject ?? '';              // puede ser el link ID

  console.log(`✅ Pago aprobado — email: ${payerEmail}, monto: ${amountTotal}, ref: ${reference}, subject: ${subject}`);

  // Determinar plan según link (subject = link ID como LNK_...)
  // Bold envía el link ID en payload.subject para pagos de link
  const planKey = subject.startsWith('LNK_') ? subject : reference;
  const planConfig = PLAN_CONFIG[planKey] ?? PLAN_CONFIG['LNK_U58X7N71NX']; // fallback BASIC

  // Crear cliente Supabase con service role (puede escribir en cualquier tabla)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Buscar usuario por email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_id, email, full_name')
    .ilike('email', payerEmail)
    .maybeSingle();

  if (profileError || !profile) {
    console.error('❌ Perfil no encontrado para:', payerEmail);
    // Guardar en tabla de pagos sin asignar para revisión manual
    await supabase.from('admin_notifications').insert({
      type: 'PAYMENT_UNMATCHED',
      title: '⚠️ Pago sin usuario asignado',
      message: `Pago de $${amountTotal.toLocaleString()} COP recibido de ${payerEmail} pero no se encontró cuenta en POSmaster.`,
      data: { payment_id: paymentId, email: payerEmail, amount: amountTotal, plan: planConfig.plan },
      is_read: false,
    });
    return new Response('OK', { status: 200 });
  }

  if (!profile.company_id) {
    console.error('❌ Perfil sin company_id:', payerEmail);
    await supabase.from('admin_notifications').insert({
      type: 'PAYMENT_UNMATCHED',
      title: '⚠️ Pago sin negocio asignado',
      message: `Pago de $${amountTotal.toLocaleString()} COP de ${payerEmail} — cuenta existe pero sin negocio asignado.`,
      data: { profile_id: profile.id, email: payerEmail, amount: amountTotal },
      is_read: false,
    });
    return new Response('OK', { status: 200 });
  }

  // 2. Obtener estado actual de la empresa
  const { data: company } = await supabase
    .from('companies')
    .select('subscription_status, subscription_end_date, subscription_plan')
    .eq('id', profile.company_id)
    .maybeSingle();

  // 3. Calcular nueva fecha de vencimiento
  // Si ya tiene días restantes, sumar encima (renovación anticipada)
  let startDate = new Date().toISOString().split('T')[0];
  let endDate = addDays(planConfig.days);

  if (company?.subscription_end_date && company.subscription_status === 'ACTIVE') {
    const current = new Date(company.subscription_end_date);
    const today = new Date();
    if (current > today) {
      // Sumar días desde la fecha actual de vencimiento
      const remainingDays = Math.ceil((current.getTime() - today.getTime()) / 86400000);
      const newEnd = new Date(current);
      newEnd.setDate(newEnd.getDate() + planConfig.days);
      endDate = newEnd.toISOString().split('T')[0];
      console.log(`📅 Renovación anticipada: ${remainingDays} días restantes + ${planConfig.days} días = vence ${endDate}`);
    }
  }

  // 4. Activar / renovar la empresa
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      subscription_status: 'ACTIVE',
      subscription_plan: planConfig.plan,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
    })
    .eq('id', profile.company_id);

  if (updateError) {
    console.error('❌ Error actualizando empresa:', updateError);
    return new Response('Internal error', { status: 500 });
  }

  // 5. Registrar pago en historial
  await supabase.from('payment_history').insert({
    company_id: profile.company_id,
    payment_id: paymentId,
    amount: amountTotal,
    plan: planConfig.plan,
    days: planConfig.days,
    end_date: endDate,
    payer_email: payerEmail,
    source: 'BOLD_WEBHOOK',
    raw_payload: payload,
  }).catch(() => {}); // No fallar si la tabla no existe aún

  // 6. Notificar al admin
  await supabase.from('admin_notifications').insert({
    type: 'PAYMENT_RECEIVED',
    title: '💰 Pago recibido — cuenta activada',
    message: `${profile.full_name || payerEmail} pagó $${amountTotal.toLocaleString()} COP. Plan ${planConfig.plan} activado hasta ${endDate}.`,
    data: {
      company_id: profile.company_id,
      profile_id: profile.id,
      email: payerEmail,
      amount: amountTotal,
      plan: planConfig.plan,
      end_date: endDate,
      payment_id: paymentId,
    },
    is_read: false,
  });

  console.log(`✅ Cuenta activada: ${payerEmail} → Plan ${planConfig.plan} hasta ${endDate}`);
  return new Response('OK', { status: 200 });
});
