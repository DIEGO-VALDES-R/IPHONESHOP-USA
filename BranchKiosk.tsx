/**
 * BranchKiosk.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla de ingreso tipo "kiosk" para empleados de una sucursal.
 * Ruta: /#/kiosk/:companyId
 *
 * El empleado ve el nombre del negocio, una lista de sus compañeros activos,
 * selecciona su nombre y digita su PIN de 4 dígitos.
 * No requiere email ni contraseña — solo PIN asignado por el admin.
 *
 * Una vez autenticado, App.tsx lo monta en el DatabaseProvider de esa
 * sucursal con su rol y permisos correctos (view = 'kiosk_session').
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { toast } from 'react-hot-toast';

interface Props {
  companyId: string;
  /** Llamado cuando el PIN es correcto — pasa el perfil del empleado */
  onSuccess: (profile: KioskProfile) => void;
}

export interface KioskProfile {
  id: string;
  full_name: string;
  custom_role: string;
  role: string;
  permissions: Record<string, boolean>;
  branch_id: string | null;
  company_id: string;
}

interface Member {
  id: string;
  full_name: string;
  custom_role: string | null;
  role: string;
  is_active: boolean;
  branch_id: string | null;
}

const PIN_MAX = 5;
const PIN_LOCKOUT_MS = 10 * 60 * 1000;

const BranchKiosk: React.FC<Props> = ({ companyId, onSuccess }) => {
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // Rate limiting por empleado seleccionado
  const attemptsRef = React.useRef<Record<string, { count: number; until: number }>>({});

  const checkLocked = (memberId: string) => {
    const r = attemptsRef.current[memberId];
    if (!r) return false;
    if (r.until && Date.now() < r.until) return true;
    if (r.until && Date.now() >= r.until) { delete attemptsRef.current[memberId]; }
    return false;
  };

  const registerFail = (memberId: string) => {
    const r = attemptsRef.current[memberId] || { count: 0, until: 0 };
    r.count++;
    if (r.count >= PIN_MAX) r.until = Date.now() + PIN_LOCKOUT_MS;
    attemptsRef.current[memberId] = r;
  };

  useEffect(() => { load(); }, [companyId]);

  const load = async () => {
    setLoading(true);
    const [{ data: co }, { data: mems }] = await Promise.all([
      supabase.from('companies').select('id, name, logo_url, config').eq('id', companyId).maybeSingle(),
      supabase.from('profiles').select('id, full_name, custom_role, role, is_active, branch_id')
        .eq('company_id', companyId).eq('is_active', true).order('full_name'),
    ]);
    setCompany(co);
    setMembers(mems || []);
    setLoading(false);
  };

  const handleSelectMember = (m: Member) => {
    setSelected(m);
    setPin(['', '', '', '']);
    setError('');
    setTimeout(() => document.getElementById('kpin-0')?.focus(), 100);
  };

  const handleDigit = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const arr = [...pin]; arr[i] = v;
    setPin(arr);
    if (v && i < 3) document.getElementById(`kpin-${i + 1}`)?.focus();
    if (!v && i > 0) document.getElementById(`kpin-${i - 1}`)?.focus();
  };

  const handleVerify = useCallback(async () => {
    if (!selected) return;
    const fullPin = pin.join('');
    if (fullPin.length < 4) { setError('Ingresa los 4 dígitos'); return; }

    if (checkLocked(selected.id)) {
      setError('Demasiados intentos. Espera 10 minutos.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // Verificar PIN contra el hash almacenado usando la función RPC existente
      const { data, error: rpcErr } = await supabase
        .rpc('verify_pin_for_member', { member_id: selected.id, input_pin: fullPin });

      if (rpcErr || !data) {
        // Fallback: comparar directamente si no hay función RPC
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, custom_role, role, permissions, branch_id, company_id, pin')
          .eq('id', selected.id)
          .maybeSingle();

        if (!profile || profile.pin !== fullPin) {
          registerFail(selected.id);
          const r = attemptsRef.current[selected.id];
          const left = PIN_MAX - (r?.count || 0);
          setError(left > 0 ? `PIN incorrecto. ${left} intentos restantes.` : 'Cuenta bloqueada 10 min.');
          setPin(['', '', '', '']);
          document.getElementById('kpin-0')?.focus();
          setVerifying(false);
          return;
        }

        onSuccess({
          id: profile.id,
          full_name: profile.full_name,
          custom_role: profile.custom_role || profile.role,
          role: profile.role,
          permissions: profile.permissions || {},
          branch_id: profile.branch_id,
          company_id: profile.company_id,
        });
        return;
      }

      // RPC devolvió ok
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, custom_role, role, permissions, branch_id, company_id')
        .eq('id', selected.id)
        .maybeSingle();

      if (profile) {
        onSuccess({
          id: profile.id,
          full_name: profile.full_name,
          custom_role: profile.custom_role || profile.role,
          role: profile.role,
          permissions: profile.permissions || {},
          branch_id: profile.branch_id,
          company_id: profile.company_id,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }, [selected, pin, onSuccess]);

  // Auto-verificar cuando se completan los 4 dígitos
  useEffect(() => {
    if (pin.join('').length === 4 && selected) handleVerify();
  }, [pin]);

  const businessType = company?.config?.business_type || 'general';
  const brandColor = company?.config?.primary_color || '#3b82f6';

  const BUSINESS_ICONS: Record<string, string> = {
    salon: '💇', restaurante: '🍽️', veterinaria: '🐾', farmacia: '💊',
    odontologia: '🦷', tienda_tecnologia: '📱', ferreteria: '🔩',
    supermercado: '🛒', ropa: '👗', zapateria: '👟', general: '🏪',
  };
  const icon = BUSINESS_ICONS[businessType] || '🏪';

  if (loading) return (
    <div style={S.page}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <Spinner color={brandColor} />
        <p style={{ marginTop: 16 }}>Cargando...</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header del negocio */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        {company?.logo_url
          ? <img src={company.logo_url} alt="logo" style={{ height: 64, margin: '0 auto 12px', display: 'block', objectFit: 'contain' }} />
          : <div style={{ width: 72, height: 72, background: brandColor, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 12px' }}>{icon}</div>
        }
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, margin: 0 }}>{company?.name}</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Selecciona tu nombre e ingresa tu PIN</p>
      </div>

      {!selected ? (
        /* ── Lista de empleados ── */
        <div style={{ width: '100%', maxWidth: 420 }}>
          <p style={{ color: '#475569', fontSize: 13, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            ¿Quién eres?
          </p>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>👥</p>
              <p>No hay empleados configurados aún.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>El administrador debe agregar el equipo primero.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {members.map(m => (
                <button key={m.id} onClick={() => handleSelectMember(m)} style={S.memberCard}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 auto 8px', flexShrink: 0 }}>
                    {m.full_name.charAt(0).toUpperCase()}
                  </div>
                  <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, margin: 0 }}>{m.full_name.split(' ')[0]}</p>
                  <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0', textTransform: 'capitalize' }}>
                    {m.custom_role || m.role}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Ingreso PIN ── */
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          {/* Avatar seleccionado */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 auto 10px' }}>
              {selected.full_name.charAt(0).toUpperCase()}
            </div>
            <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 18 }}>{selected.full_name}</p>
            <p style={{ color: '#64748b', fontSize: 13, textTransform: 'capitalize', marginTop: 2 }}>
              {selected.custom_role || selected.role}
            </p>
          </div>

          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Ingresa tu PIN de 4 dígitos</p>

          {/* PIN inputs */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 20 }}>
            {[0, 1, 2, 3].map(i => (
              <input
                key={i} id={`kpin-${i}`}
                type="password" inputMode="numeric" maxLength={1}
                value={pin[i]}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Backspace' && !pin[i] && i > 0) document.getElementById(`kpin-${i - 1}`)?.focus(); }}
                disabled={verifying}
                style={{
                  width: 60, height: 68, textAlign: 'center', fontSize: 28, fontWeight: 800,
                  background: 'rgba(255,255,255,0.06)',
                  border: `2px solid ${pin[i] ? brandColor : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 14, color: '#f1f5f9', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {verifying && (
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              <Spinner color={brandColor} size={24} />
            </div>
          )}

          <button onClick={() => { setSelected(null); setPin(['', '', '', '']); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
            ← Cambiar de usuario
          </button>
        </div>
      )}
    </div>
  );
};

const Spinner: React.FC<{ color?: string; size?: number }> = ({ color = '#3b82f6', size = 32 }) => (
  <>
    <div style={{ width: size, height: size, border: `3px solid rgba(255,255,255,0.1)`, borderTop: `3px solid ${color}`, borderRadius: '50%', margin: '0 auto', animation: 'kspin 0.8s linear infinite' }} />
    <style>{`@keyframes kspin{to{transform:rotate(360deg)}}`}</style>
  </>
);

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0a0f1e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  memberCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '16px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  },
};

export default BranchKiosk;
