import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, X, Package, Upload, Image as ImageIcon } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { productService, Product } from '../services/productService';
import { useCompany } from '../hooks/useCompany';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const EMPTY_PRODUCT = {
  company_id: '', name: '', sku: '', category: '', brand: '',
  description: '', price: 0, cost: 0, tax_rate: 19,
  stock_min: 5, stock_quantity: 0, type: 'STANDARD' as const, is_active: true,
  image_url: '',
};

// Helper: convierte 0 a string vacío para mostrar placeholder en inputs numéricos
const numVal = (val: number | undefined | null, fallback = 0): string => {
  const v = val ?? fallback;
  return v === 0 ? '' : String(v);
};

const Inventory: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { companyId } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try { setProducts(await productService.getAll(companyId)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [companyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_PRODUCT, company_id: companyId || '' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p } as any);
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validar tipo — incluye HEIF/HEIC
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif', 'image/avif',
    ];
    const isValidByType = validTypes.includes(file.type.toLowerCase());
    const isValidByExt = /\.(jpg|jpeg|png|webp|gif|heic|heif|avif)$/i.test(file.name);
    if (!isValidByType && !isValidByExt) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WEBP, HEIF, AVIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5MB'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${companyId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setForm((prev: any) => ({ ...prev, image_url: data.publicUrl }));
      toast.success('Imagen subida correctamente');
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.sku) { toast.error('Nombre y SKU son requeridos'); return; }
    setSaving(true);
    try {
      if (editing?.id) {
        await productService.update(editing.id, form);
        toast.success('Producto actualizado');
      } else {
        await productService.create({ ...form, company_id: companyId! });
        toast.success('Producto creado');
      }
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try { await productService.delete(id); toast.success('Eliminado'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const filtered = products.filter(p => {
    if (p.type !== 'SERVICE' && (p.stock_quantity ?? 0) <= 0) return false;
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  // Helper para actualizar campos de texto/select
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setForm((prev: any) => ({ ...prev, [k]: val }));
  };

  // Helper para campos numéricos con campo vacío permitido
  const handleNumChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm((prev: any) => ({
      ...prev,
      [key]: raw === '' ? 0 : parseFloat(raw) || 0,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
          <p className="text-slate-500">Gestión de productos y stock</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, SKU o categoría..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Cargando productos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No hay productos. Crea el primero.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Foto','Producto','SKU','Categoría','Precio','Costo','Stock','Tipo',''].map(h => (
                <th key={h} className="px-4 py-4 font-semibold text-slate-700">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {(p as any).image_url ? (
                      <img src={(p as any).image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Package size={16} className="text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-slate-500">{p.category || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(p.price)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatMoney(p.cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${(p.stock_quantity||0) <= (p.stock_min||5) ? 'text-red-600' : 'text-green-600'}`}>
                      {p.stock_quantity ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{p.type}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(p.id!)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-bold">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">

                {/* FOTO DEL PRODUCTO */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Foto del Producto</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                      {(form as any).image_url ? (
                        <img src={(form as any).image_url} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={28} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-blue-400 transition-all disabled:opacity-50"
                      >
                        {uploading ? (
                          <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Subiendo...</>
                        ) : (
                          <><Upload size={16} /> Subir imagen</>
                        )}
                      </button>
                      {(form as any).image_url && (
                        <button
                          type="button"
                          onClick={() => setForm((prev: any) => ({ ...prev, image_url: '' }))}
                          className="w-full px-4 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg border border-red-200"
                        >
                          Quitar imagen
                        </button>
                      )}
                      <p className="text-xs text-slate-400">JPG, PNG, WEBP, HEIF · Max 5MB</p>
                    </div>
                  </div>
                  {/* Input acepta HEIC/HEIF también */}
                  <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleImageUpload} />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                  <input value={form.name} onChange={f('name')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                  <input value={form.sku} onChange={f('sku')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select value={form.type} onChange={f('type')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="STANDARD">Estándar</option>
                    <option value="SERIALIZED">Serializado</option>
                    <option value="SERVICE">Servicio</option>
                  </select>
                </div>

                {/* PRECIO VENTA — sin 0 fijo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta</label>
                  <input
                    type="number"
                    min="0"
                    value={numVal(form.price)}
                    onChange={handleNumChange('price')}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* COSTO — sin 0 fijo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo</label>
                  <input
                    type="number"
                    min="0"
                    value={numVal(form.cost)}
                    onChange={handleNumChange('cost')}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                  <input value={form.category || ''} onChange={f('category')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <input value={(form as any).brand || ''} onChange={f('brand')} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* STOCK INICIAL — sin 0 fijo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={numVal(form.stock_quantity)}
                    onChange={handleNumChange('stock_quantity')}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* STOCK MÍNIMO — sin 5 fijo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={numVal(form.stock_min, 5)}
                    onChange={handleNumChange('stock_min')}
                    placeholder="5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                  <textarea value={form.description || ''} onChange={f('description')} rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Cancelar</button>
              <button onClick={handleSave} disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;