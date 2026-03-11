/**
 * AcceptBranchInvitation.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Pantalla que se muestra cuando alguien abre el link de una sucursal
 * (/#/sucursal-acceso/:companyId) SIN sesión activa.
 *
 * Flujo:
 *  1. El dueño crea la sucursal → obtiene un "código de acceso" de 8 chars
 *  2. El administrador de esa sucursal recibe el link + código
 *  3. Abre el link → ve esta pantalla
 *  4. Ingresa el código → se le pide nombre, email, contraseña y PIN
 *  5. Se crea su cuenta con rol ADMIN y queda vinculado a esa sucursal
 *
 * La lógica es idéntica a AcceptInvitation pero:
 *  - La autenticación usa un código numérico/alfanumérico de 8 chars en vez
 *    de un token de 32 chars en la URL
 *  - No se pre-fija el email — el admin de sucursal elige su propio email
 *  - El rol siempre es ADMIN dentro de la sucursal hija
 * ──────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { toast } from 'react-hot-toast';

interface Props {
  /** ID de la company-sucursal que se va a activar */
  companyId: string;
}

const AcceptBranchInvitation: React.FC<Props> = ({ companyId }) => {
  const [step, setStep] = useState<'loading' | 'code' | 'register' | 'success' | 'error'>('loading');
  const [branch, setBranch] = useState<any>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Campos del formulario
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Cargar datos de la sucursal ──────────────────────────────────────────
  useEffect(() => { loadBranch(); }, [companyId]);

  const loadBranch = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, logo_url, subscription_status, tipo, negocio_padre_id, config')
      .eq('id', companyId)
      .maybeSingle();

    if (error || !data) {
      setErrorMsg('Sucursal no encontrada.');
      setStep('error');
      return;
    }

    // Sólo se puede activar una sucursal hija
    if (data.tipo !== 'sucursal' || !data.negocio_padre_id) {
      setErrorMsg('Este enlace no corresponde a una sucursal válida.');
      setStep('error');
      return;
    }

    // Verificar si ya tiene un admin — si ya está activada, redirigir al login
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', 'ADMIN');

    if ((count ?? 0) > 0) {
      setErrorMsg('Esta sucursal ya fue activada. Usa el botón de inicio de sesión normal.');
      setStep('error');
      return;
    }

    setBranch(data);
    setStep('code');
  };

  // ── Verificar código de acceso ───────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (!codeInput.trim()) { setCodeError('Ingresa el código de activación'); return; }
    setVerifying(true);
    setCodeError('');

    const { data, error } = await supabase
      .from('branch_access_codes')
      .select('id, used_at, expires_at')
      .eq('company_id', companyId)
      .eq('code', codeInput.trim().toUpperCase())
      .maybeSingle();

    if (error || !data) {
      setCodeError('Código incorrecto. Solicítalo al dueño del negocio.');
      setVerifying(false);
      return;
    }

    if (data.used_at) {
      setCodeError('Este código ya fue utilizado.');
      setVerifying(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setCodeError('Este código ha expirado. Solicita uno nuevo.');
      setVerifying(false);
      return;
    }

    setVerifying(false);
    setStep('register');
  };

  // ── Crear cuenta del admin de sucursal ──────────────────────────────────
  const handleRegister = async () => {
    if (!fullName.trim()) { toast.error('Ingresa tu nombre completo'); return; }
    if (!email.trim() || !email.includes('@')) { toast.error('Ingresa un email válido'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== password2) { toast.error('Las contraseñas no coinciden'); return; }
    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) { toast.error('El PIN debe ser exactamente 4 dígitos'); return; }

    setLoading(true);
    try {
      // 1. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const userId = authData.user.id;

      // 2. Obtener o crear la sede principal de esta sucursal
      const { data: branchRow } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();

      // 3. Crear perfil con rol ADMIN en la sucursal
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        company_id: companyId,
        branch_id: branchRow?.id || null,
        role: 'ADMIN',
        custom_role: 'administrador',
        permissions: {},
        full_name: fullName,
        email: email.trim().toLowerCase(),
        pin: pin || null,
        is_active: true,
      }, { onConflict: 'id' });
      if (profileError) throw profileError;

      // 4. Marcar el código como usado
      await supabase
        .from('branch_access_codes')
        .update({ used_at: new Date().toISOString(), used_by_email: email.trim().toLowerCase() })
        .eq('company_id', companyId)
        .eq('code', codeInput.trim().toUpperCase());

      // 5. Iniciar sesión automáticamente para que el botón "Ingresar" funcione
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      setStep('success');
      toast.success('¡Cuenta creada! Ya puedes ingresar.');
    } catch (err: any) {
      const msg = err.message?.includes('already registered')
        ? 'Este email ya tiene una cuenta. Inicia sesión directamente.'
        : err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── RENDERS ──────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Spinner />
          <p style={{ marginTop: 16 }}>Verificando sucursal...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>❌</div>
          <h2 style={S.title}>Enlace inválido</h2>
          <p style={S.sub}>{errorMsg}</p>
          <a href="/" style={S.btn}>← Ir al inicio de sesión</a>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 16 }}>🎉</div>
          <h2 style={S.title}>¡Sucursal activada!</h2>
          <p style={S.sub}>Tu cuenta de administrador para <strong style={{ color: '#93c5fd' }}>{branch?.name}</strong> fue creada correctamente.</p>
          <div style={S.infoBadge}>
            <p style={{ color: '#6ee7b7', fontSize: 13 }}>Rol: <strong>Administrador de Sucursal</strong></p>
            {pin && <p style={{ color: '#86efac', fontSize: 13 }}>PIN de caja configurado ✓</p>}
          </div>
          <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            Ahora puedes invitar a tu equipo desde el menú <strong>Equipo</strong> dentro de la sucursal.
          </p>
          <a href={`/#/sucursal/${companyId}`} style={S.btn}>→ Ingresar a mi sucursal</a>
        </div>
      </div>
    );
  }

  // ── STEP: CODE ────────────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BranchLogo name={branch?.name} logo={branch?.logo_url} />
          <h2 style={S.title}>Activar Sucursal</h2>
          <p style={S.sub}>
            Ingresa el código de activación de <strong style={{ color: '#93c5fd' }}>{branch?.name}</strong> que te proporcionó el dueño del negocio.
          </p>

          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Código de activación</label>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Ej: AB12CD34"
              maxLength={8}
              style={{ ...S.input, letterSpacing: '0.2em', textAlign: 'center', fontSize: 20, fontWeight: 800, textTransform: 'uppercase' }}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyCode(); }}
            />
            {codeError && <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 6 }}>{codeError}</p>}
          </div>

          <button onClick={handleVerifyCode} disabled={verifying} style={S.primaryBtn}>
            {verifying ? '⏳ Verificando...' : '✓ Continuar con este código'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#475569' }}>
            ¿Ya tienes cuenta?{' '}
            <a href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Iniciar sesión</a>
          </p>
        </div>
      </div>
    );
  }

  // ── STEP: REGISTER ────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        <BranchLogo name={branch?.name} logo={branch?.logo_url} />
        <h2 style={S.title}>Crea tu cuenta de administrador</h2>
        <p style={S.sub}>Serás el <strong style={{ color: '#93c5fd' }}>Administrador</strong> de la sucursal <strong style={{ color: '#93c5fd' }}>{branch?.name}</strong></p>

        <div style={S.field}>
          <label style={S.label}>Nombre completo *</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre y apellido" style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@tusucursal.com" style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Contraseña *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Confirmar contraseña *</label>
          <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="Repite la contraseña" style={S.input} />
        </div>

        {/* PIN opcional */}
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#6ee7b7', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🔢 PIN de acceso rápido (opcional)</p>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>Permite abrir caja sin escribir email/contraseña.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[0, 1, 2, 3].map(i => (
              <input key={i} type="password" inputMode="numeric" maxLength={1}
                value={pin[i] || ''}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  const arr = pin.split(''); arr[i] = val;
                  const newPin = arr.join('').slice(0, 4);
                  setPin(newPin);
                  if (val && i < 3) document.getElementById(`bpin-${i + 1}`)?.focus();
                }}
                id={`bpin-${i}`}
                style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: `2px solid ${pin[i] ? '#10b981' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: '#f1f5f9', outline: 'none' }} />
            ))}
            {pin.length > 0 && (
              <button type="button" onClick={() => setPin('')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>Borrar</button>
            )}
          </div>
        </div>

        <button onClick={handleRegister} disabled={loading} style={S.primaryBtn}>
          {loading ? '⏳ Creando cuenta...' : '✓ Activar mi sucursal'}
        </button>

        <button onClick={() => setStep('code')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', width: '100%', marginTop: 12, fontSize: 13, fontWeight: 600 }}>
          ← Volver
        </button>
      </div>
    </div>
  );
};

// ── Sub-componentes ──────────────────────────────────────────────────────────
const BranchLogo: React.FC<{ name: string; logo?: string }> = ({ name, logo }) => (
  <div style={{ textAlign: 'center', marginBottom: 28 }}>
    {logo
      ? <img src={logo} alt="logo" style={{ height: 56, margin: '0 auto 12px', display: 'block', objectFit: 'contain' }} />
      : <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff', margin: '0 auto 12px' }}>
          {(name || 'S').charAt(0).toUpperCase()}
        </div>
    }
  </div>
);

const Spinner = () => (
  <div style={{ width: 40, height: 40, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ── Estilos ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0a0f1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 36,
  },
  title: { color: '#f1f5f9', fontWeight: 800, fontSize: 20, textAlign: 'center', marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  input: {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  field: { marginBottom: 16 },
  primaryBtn: {
    width: '100%',
    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    border: 'none',
    color: '#fff',
    padding: '14px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  btn: {
    display: 'block',
    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    color: '#fff',
    padding: '14px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    textDecoration: 'none',
    textAlign: 'center',
    marginTop: 16,
  },
  infoBadge: {
    background: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 16,
    textAlign: 'center',
  },
};

export default AcceptBranchInvitation;