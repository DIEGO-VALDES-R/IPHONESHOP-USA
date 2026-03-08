import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { toast } from 'react-hot-toast';

interface Props { token: string; }

const AcceptInvitation: React.FC<Props> = ({ token }) => {
  const [step, setStep] = useState<'loading' | 'register' | 'success' | 'error'>('loading');
  const [invitation, setInvitation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { loadInvitation(); }, [token]);

  const loadInvitation = async () => {
    const { data: inv, error } = await supabase
      .from('user_invitations')
      .select('*, companies(name, logo_url)')
      .eq('token', token)
      .maybeSingle();

    if (error || !inv) { setErrorMsg('Invitación no encontrada.'); setStep('error'); return; }
    if (inv.status === 'ACCEPTED') { setErrorMsg('Esta invitación ya fue utilizada.'); setStep('error'); return; }
    if (new Date(inv.expires_at) < new Date()) { setErrorMsg('Esta invitación ha expirado. Pide una nueva al administrador.'); setStep('error'); return; }

    setInvitation(inv);
    setCompany(inv.companies);
    setStep('register');
  };

  const handleRegister = async () => {
    if (!fullName.trim()) { toast.error('Ingresa tu nombre completo'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== password2) { toast.error('Las contraseñas no coinciden'); return; }
    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) { toast.error('El PIN debe ser exactamente 4 dígitos'); return; }

    setLoading(true);
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: { data: { full_name: fullName } }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // 2. Crear perfil con rol y permisos de la invitación
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        company_id: invitation.company_id,
        branch_id: invitation.branch_id,
        role: 'STAFF',
        custom_role: invitation.custom_role,
        permissions: invitation.permissions || {},
        full_name: fullName,
        email: invitation.email,
        pin: pin || null,
        is_active: true,
      });

      if (profileError) throw profileError;

      // 3. Marcar invitación como ACCEPTED
      await supabase.from('user_invitations')
        .update({ status: 'ACCEPTED' })
        .eq('id', invitation.id);

      setStep('success');
      toast.success('¡Cuenta creada exitosamente!');
    } catch (err: any) {
      const msg = err.message?.includes('already registered')
        ? 'Este email ya tiene una cuenta. Intenta iniciar sesión directamente.'
        : err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = invitation?.custom_role
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Colaborador';

  // ── LOADING ──
  if (step === 'loading') {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p>Verificando invitación...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (step === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>❌</div>
          <h2 style={{ color: '#f1f5f9', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>Invitación inválida</h2>
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──
  if (step === 'success') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 16 }}>🎉</div>
          <h2 style={{ color: '#f1f5f9', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>¡Listo, {fullName.split(' ')[0]}!</h2>
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14, marginBottom: 8 }}>
            Tu cuenta fue creada. Ya puedes iniciar sesión en POSmaster.
          </p>
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, textAlign: 'center' }}>
            <p style={{ color: '#93c5fd', fontSize: 13 }}>Tu rol: <strong>{roleLabel}</strong></p>
            <p style={{ color: '#93c5fd', fontSize: 13 }}>Empresa: <strong>{company?.name}</strong></p>
            {pin && <p style={{ color: '#86efac', fontSize: 13, marginTop: 4 }}>PIN de caja: <strong>****</strong> (configurado)</p>}
          </div>
          <a href="/" style={{ display: 'block', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', textAlign: 'center' }}>
            → Ir a iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  // ── REGISTER FORM ──
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header empresa */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {company?.logo_url
            ? <img src={company.logo_url} alt="logo" style={{ height: 56, margin: '0 auto 12px', display: 'block', objectFit: 'contain' }} />
            : <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff', margin: '0 auto 12px' }}>
                {(company?.name || 'P').charAt(0)}
              </div>
          }
          <h2 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Completa tu registro</h2>
          <p style={{ color: '#64748b', fontSize: 13 }}>Fuiste invitado a <strong style={{ color: '#93c5fd' }}>{company?.name}</strong></p>
        </div>

        {/* Badge rol */}
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#a5b4fc', fontSize: 13 }}>Tu rol asignado</span>
          <span style={{ color: '#c7d2fe', fontWeight: 700, fontSize: 14 }}>👤 {roleLabel}</span>
        </div>

        {/* Email (readonly) */}
        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input value={invitation.email} readOnly
            style={{ ...styles.input, opacity: 0.6, cursor: 'not-allowed' }} />
        </div>

        {/* Nombre */}
        <div style={styles.field}>
          <label style={styles.label}>Nombre completo *</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Tu nombre y apellido" style={styles.input} />
        </div>

        {/* Contraseña */}
        <div style={styles.field}>
          <label style={styles.label}>Contraseña *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" style={styles.input} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Confirmar contraseña *</label>
          <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
            placeholder="Repite la contraseña" style={styles.input} />
        </div>

        {/* PIN rápido */}
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#6ee7b7', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🔢 PIN de acceso rápido (opcional)</p>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>Permite abrir caja con solo 4 dígitos, sin escribir email/contraseña.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[0,1,2,3].map(i => (
              <input key={i} type="password" inputMode="numeric" maxLength={1}
                value={pin[i] || ''}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  const arr = pin.split('');
                  arr[i] = val;
                  const newPin = arr.join('').slice(0, 4);
                  setPin(newPin);
                  if (val && i < 3) {
                    const next = document.getElementById(`pin-${i+1}`);
                    next?.focus();
                  }
                }}
                id={`pin-${i}`}
                style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: `2px solid ${pin[i] ? '#10b981' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: '#f1f5f9', outline: 'none' }} />
            ))}
            {pin.length > 0 && (
              <button type="button" onClick={() => setPin('')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                Borrar
              </button>
            )}
          </div>
        </div>

        <button onClick={handleRegister} disabled={loading}
          style={{ width: '100%', background: loading ? '#334155' : 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', color: '#fff', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
          {loading ? '⏳ Creando cuenta...' : '✓ Crear mi cuenta'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
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
  field: { marginBottom: 16 },
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
};

export default AcceptInvitation;