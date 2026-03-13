import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Save, Package, Tag, ChevronDown, AlertCircle, Edit3, BarChart2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  product_id: string;
  company_id: string;
  attribute1_name?: string;
  attribute1_value?: string;
  attribute2_name?: string;
  attribute2_value?: string;
  attribute3_name?: string;
  attribute3_value?: string;
  display_name: string;
  sku: string;
  barcode?: string;
  price_override?: number;
  cost_override?: number;
  stock_quantity: number;
  stock_min: number;
  is_active: boolean;
  image_url?: string;
}

interface ProductForVariants {
  id: string;
  name: string;
  price: number;
  cost: number;
  sku: string;
  company_id: string;
  has_variants?: boolean;
}

const COMMON_ATTRS = {
  'Color':     ['Negro', 'Blanco', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Gris', 'Rosado', 'Morado', 'Naranja', 'Café', 'Beige'],
  'Talla':     ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40'],
  'Talla Pie': ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
  'Capacidad': ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
  'Material':  ['Algodón', 'Poliéster', 'Cuero', 'Sintético', 'Lino', 'Denim'],
};

// ─── Variant Row Editor ───────────────────────────────────────────────────────
interface VariantRowProps {
  variant: Partial<ProductVariant> & { _key: string };
  attrNames: string[];
  product: ProductForVariants;
  onChange: (key: string, field: string, value: any) => void;
  onDelete: (key: string) => void;
  formatMoney: (n: number) => string;
  isSaved: boolean;
}

const VariantRow: React.FC<VariantRowProps> = ({ variant, attrNames, product, onChange, onDelete, formatMoney, isSaved }) => {
  const inputCls = 'w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-800';
  const suggestions1 = attrNames[0] ? (COMMON_ATTRS[attrNames[0] as keyof typeof COMMON_ATTRS] || []) : [];
  const suggestions2 = attrNames[1] ? (COMMON_ATTRS[attrNames[1] as keyof typeof COMMON_ATTRS] || []) : [];

  return (
    <tr className={`border-b border-slate-50 ${!variant.is_active ? 'opacity-50' : ''}`}>
      {/* Atributo 1 */}
      {attrNames[0] && (
        <td className="px-2 py-2">
          {suggestions1.length > 0 ? (
            <select className={inputCls} value={variant.attribute1_value || ''}
              onChange={e => onChange(variant._key, 'attribute1_value', e.target.value)}>
              <option value="">— {attrNames[0]} —</option>
              {suggestions1.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom">Otro...</option>
            </select>
          ) : (
            <input className={inputCls} placeholder={attrNames[0]}
              value={variant.attribute1_value || ''}
              onChange={e => onChange(variant._key, 'attribute1_value', e.target.value)} />
          )}
        </td>
      )}
      {/* Atributo 2 */}
      {attrNames[1] && (
        <td className="px-2 py-2">
          {suggestions2.length > 0 ? (
            <select className={inputCls} value={variant.attribute2_value || ''}
              onChange={e => onChange(variant._key, 'attribute2_value', e.target.value)}>
              <option value="">— {attrNames[1]} —</option>
              {suggestions2.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom">Otro...</option>
            </select>
          ) : (
            <input className={inputCls} placeholder={attrNames[1]}
              value={variant.attribute2_value || ''}
              onChange={e => onChange(variant._key, 'attribute2_value', e.target.value)} />
          )}
        </td>
      )}
      {/* Atributo 3 */}
      {attrNames[2] && (
        <td className="px-2 py-2">
          <input className={inputCls} placeholder={attrNames[2]}
            value={variant.attribute3_value || ''}
            onChange={e => onChange(variant._key, 'attribute3_value', e.target.value)} />
        </td>
      )}
      <td className="px-2 py-2"><input className={inputCls} placeholder="SKU-VAR" value={variant.sku || ''}
        onChange={e => onChange(variant._key, 'sku', e.target.value)} /></td>
      <td className="px-2 py-2">
        <input className={inputCls + ' text-right'} type="number" min="0" step="1"
          value={variant.stock_quantity ?? 0}
          onChange={e => onChange(variant._key, 'stock_quantity', parseInt(e.target.value) || 0)} />
      </td>
      <td className="px-2 py-2">
        <input className={inputCls + ' text-right'} type="number" min="0"
          placeholder={formatMoney(product.price)}
          value={variant.price_override ?? ''}
          onChange={e => onChange(variant._key, 'price_override', e.target.value === '' ? null : parseFloat(e.target.value))} />
      </td>
      <td className="px-2 py-2">
        <input className={inputCls + ' text-right'} type="number" min="0"
          placeholder={formatMoney(product.cost)}
          value={variant.cost_override ?? ''}
          onChange={e => onChange(variant._key, 'cost_override', e.target.value === '' ? null : parseFloat(e.target.value))} />
      </td>
      <td className="px-2 py-2 text-center">
        <button onClick={() => onDelete(variant._key)}
          className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface VariantManagerProps {
  product: ProductForVariants;
  onClose: () => void;
  onSaved: () => void;
  formatMoney: (n: number) => string;
}

export const VariantManager: React.FC<VariantManagerProps> = ({ product, onClose, onSaved, formatMoney }) => {
  const [savedVariants, setSavedVariants] = useState<ProductVariant[]>([]);
  const [rows, setRows] = useState<(Partial<ProductVariant> & { _key: string; _saved?: boolean })[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attribute config
  const [numAttrs, setNumAttrs] = useState(1);
  const [attrNames, setAttrNames] = useState<string[]>(['Color', '', '']);

  useEffect(() => {
    loadVariants();
  }, []);

  const loadVariants = async () => {
    setLoading(true);
    const { data } = await supabase.from('product_variants')
      .select('*').eq('product_id', product.id).order('created_at');
    const variants = data || [];
    setSavedVariants(variants);

    if (variants.length > 0) {
      // Infer attr names from existing variants
      const names = [
        variants[0].attribute1_name || '',
        variants[0].attribute2_name || '',
        variants[0].attribute3_name || '',
      ];
      const count = names.filter(Boolean).length || 1;
      setAttrNames([names[0] || 'Color', names[1] || '', names[2] || '']);
      setNumAttrs(count);
      setRows(variants.map(v => ({ ...v, _key: v.id, _saved: true })));
    }
    setLoading(false);
  };

  const addRow = () => {
    const key = `new-${Date.now()}`;
    // Auto-generate SKU suggestion
    const baseSku = product.sku + '-V' + (rows.length + 1).toString().padStart(2, '0');
    setRows(prev => [...prev, {
      _key: key, _saved: false,
      product_id: product.id, company_id: product.company_id,
      attribute1_name: attrNames[0] || undefined,
      attribute2_name: attrNames[1] || undefined,
      attribute3_name: attrNames[2] || undefined,
      sku: baseSku, stock_quantity: 0, stock_min: 0, is_active: true,
    }]);
  };

  const updateRow = (key: string, field: string, value: any) => {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
  };

  const deleteRow = async (key: string) => {
    const row = rows.find(r => r._key === key);
    if (row?._saved && row.id) {
      if (!window.confirm('¿Eliminar esta variante? Se perderá su stock.')) return;
      await supabase.from('product_variants').delete().eq('id', row.id);
      toast.success('Variante eliminada');
    }
    setRows(prev => prev.filter(r => r._key !== key));
  };

  // Generate all combinations for quick-fill
  const generateCombinations = () => {
    const attr1 = COMMON_ATTRS[attrNames[0] as keyof typeof COMMON_ATTRS];
    const attr2 = numAttrs >= 2 ? COMMON_ATTRS[attrNames[1] as keyof typeof COMMON_ATTRS] : null;
    if (!attr1) { toast.error('Usa un atributo con valores predefinidos (Color, Talla, etc.)'); return; }

    const combos: string[][] = [];
    attr1.slice(0, 6).forEach(v1 => {
      if (attr2 && numAttrs >= 2) {
        attr2.slice(0, 5).forEach(v2 => combos.push([v1, v2]));
      } else {
        combos.push([v1]);
      }
    });

    const newRows = combos.map((combo, i) => ({
      _key: `gen-${Date.now()}-${i}`, _saved: false,
      product_id: product.id, company_id: product.company_id,
      attribute1_name: attrNames[0], attribute1_value: combo[0],
      attribute2_name: numAttrs >= 2 ? attrNames[1] : undefined,
      attribute2_value: combo[1] || undefined,
      sku: `${product.sku}-${combo.join('-').replace(/\s/g,'')}`,
      stock_quantity: 0, stock_min: 0, is_active: true,
    }));
    setRows(prev => [...prev, ...newRows]);
    toast.success(`${newRows.length} variantes generadas`);
  };

  const handleSave = async () => {
    const invalid = rows.filter(r => !r.sku?.trim() || (attrNames[0] && !r.attribute1_value?.trim()));
    if (invalid.length > 0) { toast.error('Completa SKU y atributos en todas las filas'); return; }

    setSaving(true);
    try {
      for (const row of rows) {
        const payload = {
          product_id: product.id,
          company_id: product.company_id,
          attribute1_name: attrNames[0] || null,
          attribute1_value: row.attribute1_value || null,
          attribute2_name: numAttrs >= 2 ? attrNames[1] : null,
          attribute2_value: numAttrs >= 2 ? row.attribute2_value || null : null,
          attribute3_name: numAttrs >= 3 ? attrNames[2] : null,
          attribute3_value: numAttrs >= 3 ? row.attribute3_value || null : null,
          sku: row.sku!.trim(),
          barcode: row.barcode || null,
          price_override: row.price_override ?? null,
          cost_override: row.cost_override ?? null,
          stock_quantity: row.stock_quantity ?? 0,
          stock_min: row.stock_min ?? 0,
          is_active: row.is_active ?? true,
        };

        if (row._saved && row.id) {
          await supabase.from('product_variants').update(payload).eq('id', row.id);
        } else {
          const { error } = await supabase.from('product_variants').insert(payload);
          if (error) throw error;
        }
      }

      // Mark product as has_variants = true
      await supabase.from('products').update({ has_variants: true }).eq('id', product.id);

      toast.success(`✅ ${rows.length} variante(s) guardadas`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  const totalStock = rows.reduce((s, r) => s + (r.stock_quantity || 0), 0);
  const activeAttrs = attrNames.slice(0, numAttrs);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Tag size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Variantes de producto</h2>
              <p className="text-xs text-slate-400 mt-0.5">{product.name} · SKU base: {product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Attribute config */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Configurar atributos</p>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setNumAttrs(n)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${numAttrs === n ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-300'}`}>
                    {n} atributo{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].slice(0, numAttrs).map(i => (
                <div key={i}>
                  <label className="text-xs text-indigo-600 mb-1 block font-semibold">Atributo {i + 1}</label>
                  <select
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400"
                    value={attrNames[i]}
                    onChange={e => setAttrNames(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}>
                    <option value="">— Elige tipo —</option>
                    {Object.keys(COMMON_ATTRS).map(k => <option key={k} value={k}>{k}</option>)}
                    <option value="Talla Ropa">Talla Ropa</option>
                    <option value="Versión">Versión</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900">
                <Plus size={13} /> Agregar variante
              </button>
              <button onClick={generateCombinations}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200">
                ⚡ Generar combinaciones
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-semibold">{rows.length} variantes</span>
              <span>·</span>
              <span>Stock total: <strong className="text-slate-800">{totalStock}</strong> unidades</span>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No hay variantes aún</p>
              <p className="text-xs mt-1">Usa "Agregar variante" o "Generar combinaciones"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide">
                    {activeAttrs.map((a, i) => (
                      <th key={i} className="text-left px-2 py-2">{a || `Atributo ${i + 1}`}</th>
                    ))}
                    <th className="text-left px-2 py-2">SKU</th>
                    <th className="text-right px-2 py-2">Stock</th>
                    <th className="text-right px-2 py-2">Precio</th>
                    <th className="text-right px-2 py-2">Costo</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <VariantRow key={row._key} variant={row} attrNames={activeAttrs}
                      product={product} onChange={updateRow} onDelete={deleteRow}
                      formatMoney={formatMoney} isSaved={!!row._saved} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Precio y Costo vacíos = usar el del producto padre ({formatMoney(product.price)} / {formatMoney(product.cost)}).
                El stock de las variantes reemplaza al stock del producto padre.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 text-sm hover:bg-slate-200 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving || rows.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-60">
            <Save size={15} /> {saving ? 'Guardando...' : `Guardar ${rows.length} variante(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Variant Selector (POS) ───────────────────────────────────────────────────
interface VariantSelectorProps {
  product: ProductForVariants;
  onSelect: (variant: ProductVariant) => void;
  onClose: () => void;
  formatMoney: (n: number) => string;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({ product, onSelect, onClose, formatMoney }) => {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('product_variants')
      .select('*').eq('product_id', product.id).eq('is_active', true).order('created_at')
      .then(({ data }) => { setVariants(data || []); setLoading(false); });
  }, []);

  // Group by first attribute for visual layout
  const attr1Values = [...new Set(variants.map(v => v.attribute1_value).filter(Boolean))];
  const hasAttr2 = variants.some(v => v.attribute2_value);

  const getVariant = (a1: string, a2?: string) =>
    variants.find(v => v.attribute1_value === a1 && (!hasAttr2 || v.attribute2_value === a2));

  const attr2Values = [...new Set(variants.map(v => v.attribute2_value).filter(Boolean))];

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Elige una variante</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando variantes...</div>
          ) : !hasAttr2 ? (
            /* Single attribute — simple list */
            <div className="grid grid-cols-2 gap-2">
              {variants.map(v => {
                const outOfStock = v.stock_quantity <= 0;
                const price = v.price_override ?? product.price;
                return (
                  <button key={v.id} onClick={() => !outOfStock && onSelect(v)}
                    disabled={outOfStock}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${outOfStock ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95'}`}>
                    <p className="font-bold text-slate-800 text-sm">{v.display_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{v.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-indigo-600">{formatMoney(price)}</span>
                      <span className={`text-xs font-semibold ${outOfStock ? 'text-red-400' : v.stock_quantity <= 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {outOfStock ? 'Agotado' : `${v.stock_quantity} uds`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Two attributes — matrix layout */
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-slate-400 font-semibold">
                      {variants[0]?.attribute1_name} \ {variants[0]?.attribute2_name}
                    </th>
                    {attr2Values.map(a2 => (
                      <th key={a2} className="text-center p-2 font-bold text-slate-600">{a2}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attr1Values.map(a1 => (
                    <tr key={a1} className="border-t border-slate-50">
                      <td className="p-2 font-bold text-slate-700">{a1}</td>
                      {attr2Values.map(a2 => {
                        const v = getVariant(a1!, a2!);
                        if (!v) return <td key={a2} className="p-2 text-center text-slate-200">—</td>;
                        const outOfStock = v.stock_quantity <= 0;
                        const price = v.price_override ?? product.price;
                        return (
                          <td key={a2} className="p-1">
                            <button onClick={() => !outOfStock && onSelect(v)}
                              disabled={outOfStock}
                              className={`w-full p-2 rounded-lg border-2 text-center transition-colors ${outOfStock ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95'}`}>
                              <p className={`text-xs font-bold ${outOfStock ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {outOfStock ? 'Agotado' : `${v.stock_quantity} uds`}
                              </p>
                              {!outOfStock && <p className="text-[10px] text-indigo-600 font-semibold">{formatMoney(price)}</p>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VariantManager;
