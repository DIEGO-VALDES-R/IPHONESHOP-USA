import React, { useState, useRef, useEffect } from 'react';
import { 
  Save, Building, Receipt, Shield, X, CreditCard, 
  Upload, Image as ImageIcon, Lock, KeyRound, 
  FileCode, Check, AlertTriangle, Palette 
} from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { DianEnvironment, DianSettings } from '../types';

const PLANS = [
  { id: 'BASIC', name: 'Plan Basico', price: 'Gratis', features: ['1 Usuario', '1 Sucursal', 'POS Basico', 'Hasta 100 Productos'], color: 'border-slate-200' },
  { id: 'PRO', name: 'Plan Profesional', price: '$29.99 / mes', features: ['5 Usuarios', '3 Sucursales', 'Facturacion Electronica', 'Reportes Avanzados', 'Soporte Prioritario'], color: 'border-blue-500 ring-2 ring-blue-500/20' },
  { id: 'ENTERPRISE', name: 'Plan Enterprise', price: '$99.99 / mes', features: ['Usuarios Ilimitados', 'Sucursales Ilimitadas', 'API Access', 'Gestor Dedicado', 'SLA 99.9%'], color: 'border-purple-200' }
];

const BUSINESS_TYPES = [
  { id: 'general',           label: '🏪 Tienda General' },
  { id: 'tienda_tecnologia', label: '📱 Tecnología / Celulares' },
  { id: 'restaurante',       label: '🍽️ Restaurante / Cafetería' },
  { id: 'ropa',              label: '👗 Ropa / Calzado' },
  { id: 'ferreteria',        label: '🔧 Ferretería / Construcción' },
  { id: 'farmacia',          label: '💊 Farmacia / Droguería' },
  { id: 'supermercado',      label: '🛒 Supermercado / Abarrotes' },
  { id: 'salon',             label: '💇 Salón de Belleza / Spa' },
  { id: 'otro',              label: '📦 Otro' },
];

const COLOR_PRESETS = [
  { label: 'Azul',    primary: '#3b82f6', secondary: '#6366f1' },
  { label: 'Verde',   primary: '#10b981', secondary: '#059669' },
  { label: 'Morado',  primary: '#8b5cf6', secondary: '#7c3aed' },
  { label: 'Rojo',    primary: '#ef4444', secondary: '#dc2626' },
  { label: 'Naranja', primary: '#f59e0b', secondary: '#d97706' },
  { label: 'Rosa',    primary: '#ec4899', secondary: '#db2777' },
  { label: 'Gris',    primary: '#475569', secondary: '#334155' },
  { label: 'Negro',   primary: '#0f172a', secondary: '#1e293b' },
];

const MASTER_KEY = 'admin123';

const Settings: React.FC = () => {
  const { company, updateCompanyConfig, saveDianSettings } = useDatabase();

  // Mantenemos el ID que aparece en tu captura de Supabase
  const safeCompany = company || {
    id: 'b44f2b8c-e792-4d15-a661-ecadc111fbcd', 
    name: 'iPhone Shop Usa', 
    nit: '14839897-2', 
    phone: '3161545554', 
    address: 'Calle 11 # 9-03', 
    email: 'iphoneshopcal@gmail.com',
    subscription_plan: 'PRO', 
    subscription_status: 'ACTIVE', 
    logo_url: '',
    primary_color: '#3b82f6', 
    secondary_color: '#6366f1', 
    business_type: 'general',
    config: { tax_rate: 0, invoice_prefix: 'POS' },
    dian_settings: null
  };

  const [formData, setFormData] = useState(safeCompany);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DIAN' | 'BRANDING'>('GENERAL');
  const [taxRate, setTaxRate] = useState<number>(safeCompany.config?.tax_rate ?? 0);
  const [primaryColor, setPrimaryColor] = useState(safeCompany.primary_color || '#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState(safeCompany.secondary_color || '#6366f1');
  const [businessType, setBusinessType] = useState(safeCompany.business_type || 'general');
  const [savingBranding, setSavingBranding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [dianForm, setDianForm] = useState<DianSettings>(safeCompany.dian_settings || {
    company_id: safeCompany.id, 
    software_id: '', 
    software_pin: '',
    resolution_number: '', 
    prefix: '', 
    current_number: 1,
    range_from: 1, 
    range_to: 10000, 
    technical_key: '',
    environment: DianEnvironment.TEST, 
    is_active: false
  });

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSecurityCheckOpen, setIsSecurityCheckOpen] = useState(false);
  const [inputMasterKey, setInputMasterKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LOGICA DE GUARDADO CORREGIDA PARA 'business_settings'
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeTab === 'GENERAL') {
        await updateCompanyConfig({
          ...formData,
          config: { ...(formData.config || {}), tax_rate: taxRate }
        });
        toast.success('Configuración General Guardada');
      } 
      else if (activeTab === 'DIAN') {
        // 1. Guardar en Contexto local
        saveDianSettings(dianForm);
        
        // 2. Persistir en la tabla real 'business_settings' según tu captura
        const { error } = await supabase
          .from('business_settings')
          .update({ 
            dian_environment: dianForm.environment,
            dian_software_id: dianForm.software_id,
            dian_pin: dianForm.software_pin,
            invoice_mode: dianForm.is_active ? 'electronic' : 'general',
            // Asegúrate de mapear otras columnas si existen en tu DB
          })
          .eq('id', safeCompany.id);

        if (error) throw error;
        toast.success('Configuración DIAN Sincronizada');
      }
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!safeCompany.id) return;
    setSavingBranding(true);
    try {
      const { error } = await supabase.from('business_settings').update({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        business_type: businessType,
      }).eq('id', safeCompany.id);
      if (error) throw error;
      updateCompanyConfig({ primary_color: primaryColor, secondary_color: secondaryColor, business_type: businessType } as any);
      toast.success('¡Personalización guardada!');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingBranding(false);
    }
  };

  const handlePlanChange = (planId: string) => {
    updateCompanyConfig({ subscription_plan: planId } as any);
    setIsSubscriptionModalOpen(false);
    toast.success(`Plan actualizado`);
  };

  const handleVerifyMasterKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMasterKey === MASTER_KEY) {
      toast.success('Acceso Autorizado');
      setIsSecurityCheckOpen(false);
      setInputMasterKey('');
      setIsSubscriptionModalOpen(true);
    } else {
      toast.error('Clave Maestra Incorrecta');
      setInputMasterKey('');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${safeCompany.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('company-logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);
      setFormData({ ...formData, logo_url: data.publicUrl });
      updateCompanyConfig({ logo_url: data.publicUrl } as any);
      toast.success('Logo actualizado');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const currentPlan = PLANS.find(p => p.id === safeCompany.subscription_plan) || PLANS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER CON TABS */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configuracion</h2>
          <p className="text-slate-500 text-sm">Administra los datos de tu empresa</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 flex-wrap gap-1">
          <button type="button" onClick={() => setActiveTab('GENERAL')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'GENERAL' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            General
          </button>
          <button type="button" onClick={() => setActiveTab('BRANDING')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'BRANDING' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Palette size={15} /> Marca
          </button>
          <button type="button" onClick={() => setActiveTab('DIAN')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'DIAN' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <FileCode size={16} /> Facturacion Electronica
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          
          {/* TAB GENERAL - COMPLETO */}
          {activeTab === 'GENERAL' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Building size={20} className="text-blue-600" /> Datos Generales
              </h3>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="relative w-20 h-20 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {formData.logo_url ? <img src={formData.logo_url} className="w-full h-full object-cover" alt="logo" /> : <ImageIcon className="text-slate-400" size={32} />}
                  {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 text-sm mb-1">Logotipo</h4>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                    className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 hover:bg-slate-50 transition-colors">
                    <Upload size={12} /> Subir Imagen
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIT / RUC</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.nit || ''} onChange={e => setFormData({ ...formData, nit: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">IVA por Defecto</label>
                  <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
                    <option value={0}>0% - Excluido de IVA</option>
                    <option value={5}>5% - Tarifa Reducida</option>
                    <option value={19}>19% - Tarifa General</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Se aplica a productos nuevos por defecto</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB BRANDING - COMPLETO */}
          {activeTab === 'BRANDING' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-8">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Palette size={20} className="text-blue-600" /> Personalización de Marca
              </h3>
              
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold">
                    {formData.logo_url ? <img src={formData.logo_url} className="w-8 h-8 object-contain" /> : (formData.name || 'M').charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">{formData.name || 'Mi Negocio'}</p>
                    <p className="text-white/70 text-xs">{BUSINESS_TYPES.find(b => b.id === businessType)?.label || 'Tienda'}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de negocio</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {BUSINESS_TYPES.map(bt => (
                    <button key={bt.id} type="button" onClick={() => setBusinessType(bt.id)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${businessType === bt.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Color de marca</label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_PRESETS.map(preset => (
                    <button key={preset.label} type="button" onClick={() => { setPrimaryColor(preset.primary); setSecondaryColor(preset.secondary); }}
                      className={`w-10 h-10 rounded-full border-4 transition-all ${primaryColor === preset.primary ? 'border-slate-800 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                      style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
                  ))}
                </div>
              </div>

              <button type="button" onClick={handleSaveBranding} disabled={savingBranding}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white transition-all shadow-md active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, opacity: savingBranding ? 0.7 : 1 }}>
                <Save size={18} /> {savingBranding ? 'Guardando...' : 'Guardar Personalización'}
              </button>
            </div>
          )}

          {/* TAB DIAN - COMPLETO CON SWITCH */}
          {activeTab === 'DIAN' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Receipt size={20} className="text-blue-600" /> Configuracion DIAN
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Habilitar</label>
                    <button type="button" onClick={() => setDianForm({ ...dianForm, is_active: !dianForm.is_active })}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${dianForm.is_active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                      <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" 
                      value={dianForm.environment} 
                      onChange={e => setDianForm({ ...dianForm, environment: e.target.value as DianEnvironment })}>
                      <option value={DianEnvironment.TEST}>Pruebas / Habilitacion</option>
                      <option value={DianEnvironment.PRODUCTION}>Produccion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prefijo (Ej. SETT)</label>
                    <input type="text" placeholder="Ej: SETT" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" value={dianForm.prefix} onChange={e => setDianForm({ ...dianForm, prefix: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ID Software (DIAN)</label>
                    <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm outline-none" value={dianForm.software_id} onChange={e => setDianForm({ ...dianForm, software_id: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">PIN Software</label>
                    <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" value={dianForm.software_pin} onChange={e => setDianForm({ ...dianForm, software_pin: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Clave Tecnica</label>
                    <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm outline-none" value={dianForm.technical_key} onChange={e => setDianForm({ ...dianForm, technical_key: e.target.value })} />
                  </div>
                </div>

                {/* AREA DE CERTIFICADO */}
                <div className="mt-6 border-t pt-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Certificado Digital (.p12)</label>
                  <div className="flex items-center gap-3">
                    <button type="button" className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-200 transition-colors">
                      <Upload size={16} /> Seleccionar
                    </button>
                    <span className="text-xs text-slate-400">Ningun archivo</span>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Certificado</label>
                    <input type="password" placeholder="Clave del archivo .p12" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-800 text-sm">Informacion Importante</h4>
                  <p className="text-xs text-blue-700 mt-1">Al activar PRODUCCION, todas las facturas seran enviadas a la DIAN. Complete las pruebas de habilitacion antes.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR DERECHO */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={100} /></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-blue-600 rounded-lg"><Shield size={24} /></div>
              <div>
                <h4 className="font-bold">{currentPlan.name}</h4>
                <p className="text-xs text-slate-400">Estado: {safeCompany.subscription_status || 'ACTIVE'}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-300 mb-6 relative z-10">
              <div className="flex gap-2 items-center text-xs"><Check size={12} className="text-green-400" /><span>5 Usuarios</span></div>
              <div className="flex gap-2 items-center text-xs"><Check size={12} className="text-green-400" /><span>3 Sucursales</span></div>
              <div className="flex gap-2 items-center text-xs"><Check size={12} className="text-green-400" /><span>Facturacion Electronica</span></div>
            </div>
            <button type="button" onClick={() => setIsSecurityCheckOpen(true)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg font-bold flex items-center justify-center gap-2 relative z-10 transition-colors">
              <Lock size={16} /> Gestionar Suscripcion
            </button>
          </div>

          {activeTab !== 'BRANDING' && (
            <button type="submit" disabled={isSaving} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70">
              <Save size={20} /> {isSaving ? 'Guardando...' : activeTab === 'GENERAL' ? 'Guardar Cambios' : 'Guardar Config. DIAN'}
            </button>
          )}
        </div>
      </form>

      {/* MODAL DE SEGURIDAD (PASSWORD ADMIN) */}
      {isSecurityCheckOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-6 text-white text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3"><Lock size={32} className="text-blue-400" /></div>
              <h3 className="font-bold text-lg">Acceso Restringido</h3>
              <p className="text-xs text-slate-400">Requiere autorizacion para cambiar planes.</p>
            </div>
            <form onSubmit={handleVerifyMasterKey} className="p-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clave Maestra</label>
              <div className="relative mb-4">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" autoFocus className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ingrese clave..." value={inputMasterKey} onChange={e => setInputMasterKey(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsSecurityCheckOpen(false); setInputMasterKey(''); }} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Verificar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE SUSCRIPCION (PLANES) */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-2xl text-slate-800">Planes de Suscripcion</h3>
                <p className="text-slate-500 text-sm">Actualiza tu capacidad de operacion</p>
              </div>
              <button onClick={() => setIsSubscriptionModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map(plan => {
                  const isCurrent = safeCompany.subscription_plan === plan.id;
                  return (
                    <div key={plan.id} className={`bg-white rounded-xl p-6 border flex flex-col transition-all hover:shadow-lg ${isCurrent ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg' : 'border-slate-200'}`}>
                      <div className="mb-4">
                        <h4 className="font-bold text-lg text-slate-800">{plan.name}</h4>
                        <div className="text-2xl font-bold text-slate-900 mt-2">{plan.price}</div>
                      </div>
                      <div className="flex-1 space-y-3 mb-6">
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-600"><Check size={16} className="text-green-500 flex-shrink-0" /><span>{feature}</span></div>
                        ))}
                      </div>
                      <button disabled={isCurrent} onClick={() => handlePlanChange(plan.id)}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:translate-y-0.5 transition-all'}`}>
                        {isCurrent ? <><Check size={18} /> Plan Actual</> : <><CreditCard size={18} /> Seleccionar</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;