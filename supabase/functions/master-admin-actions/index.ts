import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: object, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verificar identidad y rol con token del usuario (igual que validate-access)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Sesion invalida' }, 401);

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile)  return json({ error: 'Perfil no encontrado' }, 403);
    if (!profile.is_active)         return json({ error: 'Usuario desactivado' }, 403);
    if (profile.role !== 'MASTER') return json({ error: 'Solo MASTER puede realizar esta accion' }, 403);

    // Cliente admin con service role
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, user_id, company_id, new_email, new_password } = body;

    if (action === 'get_company_users') {
      if (!company_id) return json({ error: 'Falta company_id' }, 400);

      const { data: profiles, error: pErr } = await adminClient
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at')
        .eq('company_id', company_id)
        .order('role');

      if (pErr) return json({ error: pErr.message }, 500);

      const enriched = await Promise.all((profiles || []).map(async (p: any) => {
        try {
          const { data: { user: au } } = await adminClient.auth.admin.getUserById(p.id);
          return {
            ...p,
            auth_email:      au?.email || p.email,
            last_sign_in:    au?.last_sign_in_at || null,
            email_confirmed: au?.email_confirmed_at ? true : false,
          };
        } catch {
          return { ...p, auth_email: p.email, last_sign_in: null, email_confirmed: false };
        }
      }));

      return json({ ok: true, users: enriched });
    }

    if (action === 'reset_password') {
      if (!user_id) return json({ error: 'Falta user_id' }, 400);

      const { data: { user: target }, error: gErr } = await adminClient.auth.admin.getUserById(user_id);
      if (gErr || !target?.email) return json({ error: 'Usuario no encontrado en auth' }, 404);

      const { error } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: target.email,
      });
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true, message: `Correo de recuperacion enviado a ${target.email}`, email: target.email });
    }

    if (action === 'set_password') {
      if (!user_id || !new_password) return json({ error: 'Faltan user_id o new_password' }, 400);
      if (new_password.length < 6)   return json({ error: 'Minimo 6 caracteres' }, 400);

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true, message: 'Contrasena actualizada correctamente' });
    }

    if (action === 'change_email') {
      if (!user_id || !new_email) return json({ error: 'Faltan user_id o new_email' }, 400);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(new_email)) return json({ error: 'Email invalido' }, 400);

      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, {
        email: new_email,
        email_confirm: true,
      });
      if (authErr) return json({ error: authErr.message }, 500);

      await adminClient.from('profiles').update({ email: new_email }).eq('id', user_id);

      return json({ ok: true, message: `Correo cambiado a ${new_email}` });
    }

    return json({ error: `Accion desconocida: ${action}` }, 400);

  } catch (e: any) {
    return json({ error: e.message || 'Error interno' }, 500);
  }
});
