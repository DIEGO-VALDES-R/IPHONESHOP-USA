import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Edit2, Trash2, X, Check, Mail,
  Shield, Lock, Eye, EyeOff, Copy, AlertTriangle,
  UserCheck, UserX, Building2, ChevronDown
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useDatabase } from '../contexts/DatabaseContext';
import RefreshButton from '../components/RefreshButton';
import { useAccessControl } from '../hooks/useAccessControl';
import { toast } from 'react-hot-toast';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  custom_role: string | null;
  permissions: Record<string, boolean>;
  branch_id: string | null;
  is_active: boolean;
  pin: string | null;
  pin_hash: string | null;
  created_at: string;
}

interface Branch { id: string; name: string; }

interface Invitation {
  id: string;
  email: string;
  custom_role: string;
  branch_id: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
}

const ROLES_BY_TYPE: Record<string, { id: string; label: string; icon: string; defaultPerms: Record<string, boolean> }[]> = {
  default: [
    { id: 'cajero',      label: 'Cajero',       icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'vendedor',    label: 'Vendedor',      icon: '🛍️', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',  label: 'Supervisor',    icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: true,  can_delete_invoices: false } },
    { id: 'bodeguero',   label: 'Bodeguero',     icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',       label: 'Administrador', icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: true,  can_delete_invoices: true  } },
  ],
  tienda_tecnologia: [
    { id: 'cajero',            label: 'Cajero',            icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'tecnico_reparador', label: 'Técnico Reparador', icon: '🔧', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: true,  can_delete_invoices: false } },
    { id: 'vendedor',          label: 'Vendedor',          icon: '📱', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',        label: 'Supervisor',        icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: true,  can_delete_invoices: false } },
    { id: 'bodeguero',         label: 'Bodeguero',         icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',             label: 'Administrador',     icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: true,  can_delete_invoices: true  } },
  ],
  restaurante: [
    { id: 'cajero',    label: 'Cajero',        icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'mesero',    label: 'Mesero',        icon: '🍽️', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'cocina',    label: 'Cocina',        icon: '👨‍🍳', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false, can_view_kitchen: true } },
    { id: 'domicilios',label: 'Domiciliario',  icon: '🛵', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',label: 'Supervisor',    icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',     label: 'Administrador', icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  ropa: [
    { id: 'cajero',    label: 'Cajero',        icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'vendedor',  label: 'Vendedor',      icon: '👗', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'bodeguero', label: 'Bodeguero',     icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',label: 'Supervisor',    icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',     label: 'Administrador', icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  salon: [
    { id: 'estilista',    label: 'Estilista',       icon: '💇', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'cajero',       label: 'Cajero/Recepción',icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'manicurista',  label: 'Manicurista',     icon: '💅', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'esteticista',  label: 'Esteticista',     icon: '🧖', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',   label: 'Supervisor',      icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  odontologia: [
    { id: 'odontologo',   label: 'Odontólogo',      icon: '🦷', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'higienista',   label: 'Higienista',      icon: '🧹', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'recepcion',    label: 'Recepción',        icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',   label: 'Supervisor',      icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  veterinaria: [
    { id: 'veterinario',  label: 'Veterinario',     icon: '🐾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'auxiliar',     label: 'Auxiliar Clínico',icon: '🩺', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'recepcion',    label: 'Recepción',        icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'peluquero',    label: 'Peluquero Mascotas',icon: '✂️',defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  farmacia: [
    { id: 'farmaceutico', label: 'Farmacéutico',    icon: '💊', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'cajero',       label: 'Cajero',          icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'regente',      label: 'Regente',         icon: '🔬', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'bodeguero',    label: 'Bodeguero',       icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  ferreteria: [
    { id: 'vendedor',     label: 'Vendedor',        icon: '🔩', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'cajero',       label: 'Cajero',          icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'bodeguero',    label: 'Bodeguero',       icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',   label: 'Supervisor',      icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  supermercado: [
    { id: 'cajero',       label: 'Cajero',          icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'repositor',    label: 'Repositor',       icon: '🛒', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'bodeguero',    label: 'Bodeguero',       icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'supervisor',   label: 'Supervisor',      icon: '👁️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
  zapateria: [
    { id: 'vendedor',     label: 'Vendedor',        icon: '👟', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'cajero',       label: 'Cajero',          icon: '🧾', defaultPerms: { can_sell: true,  can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: true,  can_view_repairs: false, can_delete_invoices: false } },
    { id: 'zapatero',     label: 'Zapatero/Reparador',icon: '🧵',defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: false, can_manage_team: false, can_open_cash: false, can_view_repairs: true,  can_delete_invoices: false } },
    { id: 'bodeguero',    label: 'Bodeguero',       icon: '📦', defaultPerms: { can_sell: false, can_refund: false, can_view_reports: false, can_manage_inventory: true,  can_manage_team: false, can_open_cash: false, can_view_repairs: false, can_delete_invoices: false } },
    { id: 'admin',        label: 'Administrador',   icon: '⚙️', defaultPerms: { can_sell: true,  can_refund: true,  can_view_reports: true,  can_manage_inventory: true,  can_manage_team: true,  can_open_cash: true,  can_view_repairs: false, can_delete_invoices: true  } },
  ],
};

const PERMISSION_LABELS: Record<string, string> = {
  can_sell:             '🛒 Realizar ventas',
  can_refund:           '↩️ Hacer devoluciones',
  can_view_reports:     '📊 Ver reportes',
  can_manage_inventory: '📦 Gestionar inventario',
  can_manage_team:      '👥 Gestionar equipo',
  can_open_cash:        '💰 Abrir/cerrar caja',
  can_view_repairs:     '🔧 Ver reparaciones',
  can_delete_invoices:  '🗑️ Eliminar facturas',
};

const getRolesForType = (type: string) => ROLES_BY_TYPE[type] || ROLES_BY_TYPE.default;
const getRoleBadge = (roleId: string, type: string) => {
  const roles = getRolesForType(type);
  return roles.find(r => r.id === roleId) || { id: roleId, label: roleId, icon: '👤', defaultPerms: {} };
};

const hashPin = async (pin: string): Promise<string> => {
  const { data, error } = await supabase.rpc('hash_pin', { input_pin: pin });
  if (error) throw new Error('Error al hashear PIN: ' + error.message);
  return data as string;
};

const Team: React.FC = () => {
  const { company, companyId, userRole } = useDatabase();
  const { checkAccess } = useAccessControl();
  const businessType = (company as any)?.business_type || 'default';
  const plan = company?.subscription_plan || 'BASIC';
  const isEnterprise = plan === 'ENTERPRISE';
  // Las sucursales hijas (negocio_padre_id != null) heredan el privilegio de equipo
  // del padre sin importar su propio plan almacenado.
  const isBranchChild = !!(company as any)?.negocio_padre_id;
  const isPro = plan === 'PRO' || isEnterprise || isBranchChild;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Nuevo empleado (creación directa con PIN) ──────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState('cajero');
  const [addPerms, setAddPerms] = useState<Record<string, boolean>>({});
  const [addPin, setAddPin] = useState('');
  const [addBranch, setAddBranch] = useState('');
  const [addShowPin, setAddShowPin] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── Edición de miembro ──────────────────────────────────────────────────
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editPin, setEditPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Eliminar ────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Link kiosk ──────────────────────────────────────────────────────────
  const kioskLink = companyId ? `${window.location.origin}/#/kiosk/${companyId}` : '';

  const roles = getRolesForType(businessType);

  useEffect(() => {
    if (companyId) { loadMembers(); loadBranches(); }
  }, [companyId]);

  const loadMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('company_id', companyId).order('created_at');
    if (error) toast.error('Error cargando equipo');
    setMembers((data || []) as any);
    setLoading(false);
  };

  const loadBranches = async () => {
    const { data } = await supabase.from('branches').select('id, name').eq('company_id', companyId).eq('is_active', true);
    setBranches(data || []);
  };

  const handleRoleSelect = (roleId: string) => {
    setAddRole(roleId);
    const found = roles.find(r => r.id === roleId);
    setAddPerms(found?.defaultPerms || {});
  };

  // ── Crear empleado directamente con PIN (sin email/invitación) ──────────
  const handleAddMember = async () => {
    if (!addName.trim()) { toast.error('Ingresa el nombre del empleado'); return; }
    if (!addPin || addPin.length !== 4 || !/^\d{4}$/.test(addPin)) {
      toast.error('El PIN debe ser exactamente 4 dígitos numéricos'); return;
    }
    setAdding(true);
    try {
      // Verificar que el PIN no esté en uso en esta empresa
      const { data: existing } = await supabase
        .from('profiles').select('id, full_name').eq('company_id', companyId).eq('pin', addPin);
      if (existing && existing.length > 0) {
        toast.error(`El PIN ${addPin} ya lo usa ${existing[0].full_name}. Elige otro.`);
        setAdding(false);
        return;
      }

      // Insertar perfil sin auth uid (empleado de kiosk — no tiene cuenta Supabase)
      // Usamos un UUID generado en cliente para el id
      const newId = crypto.randomUUID();
      const { error } = await supabase.from('profiles').insert({
        id: newId,
        company_id: companyId,
        branch_id: addBranch || branches[0]?.id || null,
        role: 'STAFF',
        custom_role: addRole,
        permissions: addPerms,
        full_name: addName.trim(),
        email: null,
        pin: addPin,
        pin_hash: null,
        is_active: true,
      });
      if (error) throw error;

      toast.success(`✅ ${addName.trim()} agregado al equipo con PIN ${addPin}`);
      setShowAddModal(false);
      setAddName(''); setAddRole('cajero'); setAddPerms({}); setAddPin(''); setAddBranch('');
      loadMembers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditRole(m.custom_role || m.role);
    setEditBranch(m.branch_id || '');
    setEditPerms(m.permissions || {});
    setEditPin('');
    setShowPin(false);
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    if (!isPro) { toast.error('La gestión de equipo requiere plan PRO o ENTERPRISE 🔒'); return; }
    if (editPin && (editPin.length !== 4 || !/^\d{4}$/.test(editPin))) {
      toast.error('El PIN debe ser exactamente 4 dígitos numéricos'); return;
    }
    setSaving(true);
    try {
      let updateData: Record<string, any> = {
        custom_role: editRole,
        branch_id: editBranch || null,
        permissions: editPerms,
      };
      if (editPin) {
        try {
          const pinHash = await hashPin(editPin);
          updateData.pin_hash = pinHash;
        } catch { /* si no hay función RPC, guardamos solo en pin */ }
        updateData.pin = editPin; // guardamos también en claro para el kiosk
      } else if (!editPin && !editMember.pin_hash && !editMember.pin) {
        updateData.pin_hash = null;
        updateData.pin = null;
      }
      const { error } = await supabase.from('profiles').update(updateData).eq('id', editMember.id);
      if (error) throw error;
      toast.success('Miembro actualizado');
      setEditMember(null);
      loadMembers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: TeamMember) => {
    const { error } = await supabase.from('profiles').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(m.is_active ? 'Usuario desactivado' : 'Usuario activado');
    loadMembers();
  };

  const handleDeleteMember = async () => {
    if (!confirmDelete) return;
    if (!isPro) { toast.error('La gestión de equipo requiere plan PRO o ENTERPRISE 🔒'); return; }
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', confirmDelete.id);
      if (error) throw error;
      toast.success(`${confirmDelete.full_name || confirmDelete.email} eliminado del equipo`);
      setConfirmDelete(null);
      loadMembers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/#/invitacion/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success('Enlace copiado');
  };

  const handleDeleteInvitation = async (id: string) => {
    await supabase.from('user_invitations').delete().eq('id', id);
    loadInvitations();
    toast.success('Invitación eliminada');
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={36} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Gestión de Equipo</h2>
          <p className="text-slate-500 mb-6">Esta función está disponible en los planes <span className="font-bold text-blue-600">PRO</span> y <span className="font-bold text-purple-600">ENTERPRISE</span>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Equipo</h2>
          <p className="text-slate-500 text-sm">Crea empleados con PIN — ingresan por el link kiosk de la sucursal</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshButton onRefresh={loadMembers} />
          {/* Link kiosk para compartir */}
          <button
            onClick={() => { navigator.clipboard.writeText(kioskLink).then(() => toast.success('🔗 Link kiosk copiado')); }}
            className="flex items-center gap-2 px-3 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg font-bold hover:bg-violet-100 text-xs">
            🔗 Link de entrada
          </button>
          <button onClick={() => { setAddName(''); setAddRole('cajero'); setAddPerms(roles.find(r => r.id === 'cajero')?.defaultPerms || {}); setAddPin(''); setAddBranch(''); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm shadow-sm">
            <Plus size={16} /> Agregar empleado
          </button>
        </div>
      </div>

      {/* Info box link kiosk */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-violet-800">🖥️ Link de ingreso para tu equipo</p>
          <p className="text-xs text-violet-600 mt-0.5 font-mono break-all">{kioskLink}</p>
          <p className="text-xs text-violet-500 mt-1">Comparte este link con tu equipo. Cada uno selecciona su nombre y digita su PIN para ingresar.</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(kioskLink).then(() => toast.success('✓ Copiado')); }}
          className="flex-shrink-0 px-4 py-2 bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-700 text-xs whitespace-nowrap">
          📋 Copiar link
        </button>
      </div>

      {/* Tabla de miembros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando equipo...
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin empleados aún</p>
            <p className="text-xs mt-1">Agrega tu primer empleado con el botón de arriba</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nombre', 'Rol', 'PIN', 'Permisos', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(m => {
                const roleDef = getRoleBadge(m.custom_role || m.role, businessType);
                const hasPin = !!(m.pin || m.pin_hash);
                return (
                  <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${!m.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(m.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{m.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {roleDef.icon} {roleDef.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasPin
                        ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">🔢 Configurado</span>
                        : <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">Sin PIN</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(m.permissions || {}).filter(([, v]) => v).slice(0, 3).map(([k]) => (
                          <span key={k} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                            {PERMISSION_LABELS[k]?.split(' ')[1] || k}
                          </span>
                        ))}
                        {Object.values(m.permissions || {}).filter(Boolean).length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">Sin permisos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.is_active ? <><Check size={10} /> Activo</> : <><X size={10} /> Inactivo</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleActive(m)} className={`p-1.5 rounded-lg ${m.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}>
                          {m.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => setConfirmDelete(m)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL CONFIRMAR ELIMINAR ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-red-600 p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Eliminar usuario</h3>
                <p className="text-xs text-red-200">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-sm mb-1">¿Eliminar permanentemente a:</p>
              <p className="font-bold text-slate-900 mb-1">{confirmDelete.full_name || '—'}</p>
              <p className="text-xs text-slate-500 mb-4">{confirmDelete.email}</p>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-5">
                <p className="text-xs text-red-700">⚠️ El usuario perderá acceso inmediatamente y no podrá iniciar sesión.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50 text-sm">
                  Cancelar
                </button>
                <button onClick={handleDeleteMember} disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                  <Trash2 size={15} /> {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR EMPLEADO (PIN directo) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white">Agregar empleado</h3>
                <p className="text-xs text-slate-400">Asigna nombre, rol y PIN de acceso</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-300" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo *</label>
                <input value={addName} onChange={e => setAddName(e.target.value)}
                  placeholder="Ej: Laura Martínez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Rol / Función *</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button key={r.id} type="button" onClick={() => handleRoleSelect(r.id)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium text-left transition-all flex items-center gap-2 ${addRole === r.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <span className="text-lg">{r.icon}</span> {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sede */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><Building2 size={14} /> Sede asignada</span>
                  </label>
                  <select value={addBranch} onChange={e => setAddBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white">
                    <option value="">— Sede principal —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* Permisos */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Permisos</label>
                <div className="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!addPerms[key]} onChange={e => setAddPerms({ ...addPerms, [key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* PIN */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-sm font-bold text-blue-800 mb-1">🔢 PIN de acceso (4 dígitos) *</label>
                <p className="text-xs text-blue-600 mb-3">Con este PIN el empleado ingresa al sistema desde el link kiosk de la sucursal. Debe ser único.</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <input key={i} id={`apin-${i}`}
                        type={addShowPin ? 'text' : 'password'} inputMode="numeric" maxLength={1}
                        value={addPin[i] || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          const arr = addPin.split(''); arr[i] = val;
                          setAddPin(arr.join('').slice(0, 4));
                          if (val && i < 3) document.getElementById(`apin-${i + 1}`)?.focus();
                        }}
                        onKeyDown={e => { if (e.key === 'Backspace' && !addPin[i] && i > 0) document.getElementById(`apin-${i - 1}`)?.focus(); }}
                        className="w-12 h-14 text-center text-xl font-black border-2 rounded-lg outline-none focus:border-blue-500 bg-white"
                        style={{ borderColor: addPin[i] ? '#3b82f6' : '#e2e8f0' }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setAddShowPin(!addShowPin)}
                    className="p-2 text-slate-400 hover:text-slate-600">
                    {addShowPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {addPin.length === 4 && (
                    <button type="button" onClick={() => setAddPin('')}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold">Borrar</button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={handleAddMember} disabled={adding}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  <UserCheck size={16} /> {adding ? 'Guardando...' : 'Agregar empleado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR MIEMBRO ── */}
      {editMember && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white">{editMember.full_name || '—'}</h3>
                <p className="text-xs text-slate-400">Editar rol, permisos y PIN</p>
              </div>
              <button onClick={() => setEditMember(null)} className="p-2 hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-300" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button key={r.id} type="button"
                      onClick={() => { setEditRole(r.id); setEditPerms(r.defaultPerms); }}
                      className={`p-3 rounded-lg border-2 text-sm font-medium text-left transition-all flex items-center gap-2 ${editRole === r.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <span className="text-lg">{r.icon}</span> {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><Building2 size={14} /> Sede asignada</span>
                  </label>
                  <select value={editBranch} onChange={e => setEditBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white">
                    <option value="">— Sede principal —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Permisos individuales</label>
                <div className="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!editPerms[key]} onChange={e => setEditPerms({ ...editPerms, [key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Lock size={13} /> PIN de acceso (4 dígitos)
                  {(editMember.pin || editMember.pin_hash) && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded ml-1">🔒 Configurado</span>}
                </label>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} value={editPin}
                    onChange={e => setEditPin(e.target.value.slice(0, 4).replace(/\D/g, ''))}
                    placeholder={(editMember.pin || editMember.pin_hash) ? 'Dejar vacío para mantener el actual' : 'Nuevo PIN'}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono tracking-widest" />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditMember(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={handleSaveEdit} disabled={saving}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  <Check size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;