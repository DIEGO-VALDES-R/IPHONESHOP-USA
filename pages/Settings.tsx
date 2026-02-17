import React, { useState, useRef } from 'react';
import { Save, Building, Receipt, Shield, Mail, Check, X, CreditCard, Upload, Image as ImageIcon, Lock, KeyRound, FileCode, CheckCircle, AlertTriangle } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { DianEnvironment, DianSettings } from '../types';

const PLANS = [
    {
        id: 'BASIC',
        name: 'Plan Básico',
        price: 'Gratis',
        features: ['1 Usuario', '1 Sucursal', 'POS Básico', 'Hasta 100 Productos'],
        color: 'bg-slate-100 border-slate-200'
    },
    {
        id: 'PRO',
        name: 'Plan Profesional',
        price: '$29.99 / mes',
        features: ['5 Usuarios', '3 Sucursales', 'Facturación Electrónica', 'Reportes Avanzados', 'Soporte Prioritario'],
        color: 'bg-blue-50 border-blue-200 ring-2 ring-blue-500'
    },
    {
        id: 'ENTERPRISE',
        name: 'Plan Enterprise',
        price: '$99.99 / mes',
        features: ['Usuarios Ilimitados', 'Sucursales Ilimitadas', 'API Access', 'Gestor de Cuenta Dedicado', 'SLA 99.9%'],
        color: 'bg-purple-50 border-purple-200'
    }
];

const MASTER_KEY = "admin123"; 

const Settings: React.FC = () => {
  const { company, updateCompanyConfig, saveDianSettings } = useDatabase();
  const [formData, setFormData] = useState(company);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DIAN'>('GENERAL');
  
  // DIAN Settings State
  const [dianForm, setDianForm] = useState<DianSettings>(company.dian_settings || {
      company_id: company.id,
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

  // Modals State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSecurityCheckOpen, setIsSecurityCheckOpen] = useState(false);
  const [inputMasterKey, setInputMasterKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'GENERAL') {
        updateCompanyConfig(formData);
    } else {
        saveDianSettings(dianForm);
    }
  };

  const handlePlanChange = (planId: 'BASIC' | 'PRO' | 'ENTERPRISE') => {
      setTimeout(() => {
          updateCompanyConfig({ subscription_plan: planId });
          setIsSubscriptionModalOpen(false);
          toast.success(`Plan actualizado a ${PLANS.find(p => p.id === planId)?.name}`);
      }, 500);
  };

  const handleVerifyMasterKey = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputMasterKey === MASTER_KEY) {
          toast.success("Acceso Autorizado");
          setIsSecurityCheckOpen(false);
          setInputMasterKey('');
          setIsSubscriptionModalOpen(true);
      } else {
          toast.error("Clave Maestra Incorrecta");
          setInputMasterKey('');
      }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileName = `logo-${company.id}-${Math.random()}`;
      setIsUploading(true);
      try {
          const { error } = await supabase.storage.from('company-logos').upload(fileName, file);
          if (error) {
              const fakeUrl = URL.createObjectURL(file);
              setFormData({ ...formData, logo_url: fakeUrl });
              updateCompanyConfig({ logo_url: fakeUrl });
              toast.success("Logo actualizado (Modo Local)");
          } else {
              const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);
              setFormData({ ...formData, logo_url: data.publicUrl });
              updateCompanyConfig({ logo_url: data.publicUrl });
              toast.success("Logo subido a la nube correctamente");
          }
      } catch (error) {
          toast.error("Error al subir la imagen");
      } finally {
          setIsUploading(false);
      }
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     if(e.target.files && e.target.files.length > 0) {
         setDianForm({...dianForm, certificate_url: e.target.files[0].name});
         toast.success("Certificado .p12 cargado temporalmente");
     }
  };

  const currentPlan = PLANS.find(p => p.id === company.subscription_plan) || PLANS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
            <p className="text-slate-500">Administra los datos de tu empresa</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200">
            <button 
                onClick={() => setActiveTab('GENERAL')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'GENERAL' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
                General
            </button>
            <button 
                onClick={() => setActiveTab('DIAN')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'DIAN' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
                <FileCode size={16} /> Facturación Electrónica
            </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Settings Area */}
        <div className="md:col-span-2 space-y-6">
          
          {activeTab === 'GENERAL' ? (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                    <Building size={20} className="text-blue-600" />
                    Datos Generales
                </h3>
                
                {/* Logo Section */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="relative w-20 h-20 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {formData.logo_url ? <img src={formData.logo_url} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-400" size={32} />}
                        {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-700 text-sm mb-1">Logotipo</h4>
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-md font-medium">Subir Imagen</button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial</label>
                        <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NIT / RUC</label>
                        <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                        <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                        <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                </div>
              </div>
          ) : (
              // DIAN SETTINGS
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <Receipt size={20} className="text-blue-600" />
                            Configuración Técnica DIAN
                        </h3>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-700">Habilitar Facturación</label>
                            <button 
                                type="button"
                                onClick={() => setDianForm({...dianForm, is_active: !dianForm.is_active})}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${dianForm.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${dianForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
                             <select 
                                className="w-full px-3 py-2 border rounded-lg bg-slate-50"
                                value={dianForm.environment}
                                onChange={e => setDianForm({...dianForm, environment: e.target.value as DianEnvironment})}
                             >
                                 <option value={DianEnvironment.TEST}>Pruebas / Habilitación</option>
                                 <option value={DianEnvironment.PRODUCTION}>Producción</option>
                             </select>
                        </div>
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Prefijo (Ej. SETT)</label>
                             <input type="text" className="w-full px-3 py-2 border rounded-lg" value={dianForm.prefix} onChange={e => setDianForm({...dianForm, prefix: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-1">ID Software (De la DIAN)</label>
                             <input type="text" className="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={dianForm.software_id} onChange={e => setDianForm({...dianForm, software_id: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-1">PIN Software</label>
                             <input type="password" className="w-full px-3 py-2 border rounded-lg font-mono text-sm" value={dianForm.software_pin} onChange={e => setDianForm({...dianForm, software_pin: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Clave Técnica (Resolución)</label>
                             <input type="text" className="w-full px-3 py-2 border rounded-lg font-mono text-sm" value={dianForm.technical_key} onChange={e => setDianForm({...dianForm, technical_key: e.target.value})} />
                        </div>
                        <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                            <h4 className="font-bold text-slate-700 mb-3">Certificado Digital (.p12)</h4>
                            <div className="flex gap-4 items-center">
                                <button type="button" onClick={() => certInputRef.current?.click()} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                                    <Upload size={16}/> Seleccionar Archivo
                                </button>
                                <span className="text-sm text-slate-500 italic">{dianForm.certificate_url || 'Ningún archivo seleccionado'}</span>
                                <input ref={certInputRef} type="file" accept=".p12" className="hidden" onChange={handleCertUpload} />
                            </div>
                            <div className="mt-3">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Certificado</label>
                                <input type="password" className="w-full px-3 py-2 border rounded-lg" value={dianForm.certificate_password || ''} onChange={e => setDianForm({...dianForm, certificate_password: e.target.value})} />
                            </div>
                        </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
                      <AlertTriangle className="text-blue-600 flex-shrink-0" />
                      <div>
                          <h4 className="font-bold text-blue-800 text-sm">Información Importante</h4>
                          <p className="text-xs text-blue-700 mt-1">
                              Al activar el entorno de PRODUCCIÓN, todas las facturas generadas serán enviadas automáticamente a la DIAN. Asegúrese de haber completado las pruebas de habilitación exitosamente (Set de Pruebas).
                          </p>
                      </div>
                  </div>
              </div>
          )}

        </div>

        {/* Right Sidebar - Actions & Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={100} /></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
               <div className="p-2 bg-blue-600 rounded-lg"><Shield size={24} /></div>
               <div>
                 <h4 className="font-bold">{currentPlan.name}</h4>
                 <p className="text-xs text-slate-400">Estado: {company.subscription_status || 'ACTIVE'}</p>
               </div>
             </div>
             <div className="space-y-2 text-sm text-slate-300 mb-6 relative z-10">
               <div className="flex justify-between">
                 <span>Plan Actual</span>
                 <span className="text-white font-bold">{currentPlan.price}</span>
               </div>
               <div className="border-t border-slate-700 my-2 pt-2">
                   {currentPlan.features.slice(0, 3).map((f, i) => (
                       <div key={i} className="flex gap-2 items-center text-xs mb-1"><Check size={12} className="text-green-400" /><span>{f}</span></div>
                   ))}
               </div>
             </div>
             <button type="button" onClick={() => setIsSecurityCheckOpen(true)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 relative z-10">
               <Lock size={16} /> Gestionar Suscripción
             </button>
             <p className="text-[10px] text-slate-500 text-center mt-2 relative z-10">* Requiere Clave Maestra (Demo: {MASTER_KEY})</p>
          </div>
          
          <button type="submit" className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-900/10 flex items-center justify-center gap-2">
            <Save size={20} />
            {activeTab === 'GENERAL' ? 'Guardar Cambios' : 'Guardar Configuración DIAN'}
          </button>
        </div>
      </form>

      {/* Security Check Modal */}
      {isSecurityCheckOpen && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="bg-slate-900 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3"><Lock size={32} className="text-blue-400" /></div>
                    <h3 className="font-bold text-lg">Acceso Restringido</h3>
                    <p className="text-xs text-slate-400">Esta zona requiere autorización del administrador.</p>
                </div>
                <form onSubmit={handleVerifyMasterKey} className="p-6">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clave Maestra</label>
                        <div className="relative">
                            <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="password" autoFocus className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ingrese clave..." value={inputMasterKey} onChange={e => setInputMasterKey(e.target.value)} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Clave Demo: {MASTER_KEY}</p>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => { setIsSecurityCheckOpen(false); setInputMasterKey(''); }} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Verificar</button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* Subscription Modal (Same as before) */}
      {isSubscriptionModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                 <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-2xl text-slate-800">Planes de Suscripción</h3>
                        <p className="text-slate-500 text-sm">Escoge el plan ideal para tu negocio</p>
                    </div>
                    <button onClick={() => setIsSubscriptionModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-500" /></button>
                 </div>
                 <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map(plan => {
                            const isCurrent = company.subscription_plan === plan.id;
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
                                    <button disabled={isCurrent} onClick={() => handlePlanChange(plan.id as any)} className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20'}`}>
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