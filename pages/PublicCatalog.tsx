import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShoppingCart, MessageCircle, Phone, Share2, ChevronDown, X, Tag, Package, Star, ExternalLink } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  image_url?: string;
  stock_quantity: number;
  tax_rate: number;
  type: string;
}

interface CatalogCompany {
  id: string;
  name: string;
  nit?: string;
  phone?: string;
  logo_url?: string;
  address?: string;
  catalog_whatsapp?: string;
  catalog_message?: string;
  config?: { currency_symbol?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(n: number, symbol = '$') {
  return symbol + new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(n);
}

function buildWhatsAppLink(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('57') ? clean : '57' + clean;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ─── Product Card ─────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: CatalogProduct;
  company: CatalogCompany;
  onDetail: (p: CatalogProduct) => void;
  currency: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, company, onDetail, currency }) => {
  const outOfStock = product.type !== 'SERVICE' && product.stock_quantity <= 0;
  const phone = company.catalog_whatsapp || company.phone || '';

  const waMessage = (company.catalog_message || '¡Hola! Me interesa este producto:') +
    `\n\n*${product.name}*` +
    (product.brand ? `\nMarca: ${product.brand}` : '') +
    `\nPrecio: ${formatMoney(product.price, currency)}` +
    (outOfStock ? '\n⚠️ (consultar disponibilidad)' : '') +
    `\n\nVi el catálogo de ${company.name}`;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col ${outOfStock ? 'opacity-70' : ''}`}>
      {/* Image */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden cursor-pointer" onClick={() => onDetail(product)}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-slate-200" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Agotado</span>
          </div>
        )}
        {product.brand && (
          <span className="absolute top-2 left-2 bg-white/90 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {product.brand}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{product.category || 'General'}</p>
        <h3 className="font-bold text-slate-800 text-sm mt-0.5 leading-tight line-clamp-2 cursor-pointer hover:text-indigo-600"
          onClick={() => onDetail(product)}>{product.name}</h3>
        {product.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="font-black text-lg text-indigo-600">{formatMoney(product.price, currency)}</span>
        </div>

        {/* WhatsApp button */}
        {phone && (
          <a href={buildWhatsAppLink(phone, waMessage)} target="_blank" rel="noopener noreferrer"
            className={`mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${outOfStock ? 'bg-slate-100 text-slate-400 pointer-events-none' : 'bg-[#25D366] hover:bg-[#1fba59] text-white active:scale-95'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            {outOfStock ? 'Consultar' : 'Pedir por WhatsApp'}
          </a>
        )}
      </div>
    </div>
  );
};

// ─── Product Detail Modal ─────────────────────────────────────────────────────
interface DetailModalProps {
  product: CatalogProduct;
  company: CatalogCompany;
  currency: string;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ product, company, currency, onClose }) => {
  const phone = company.catalog_whatsapp || company.phone || '';
  const outOfStock = product.type !== 'SERVICE' && product.stock_quantity <= 0;

  const waMessage = (company.catalog_message || '¡Hola! Me interesa este producto:') +
    `\n\n*${product.name}*` +
    (product.description ? `\n${product.description}` : '') +
    (product.brand ? `\nMarca: ${product.brand}` : '') +
    `\nPrecio: ${formatMoney(product.price, currency)}` +
    `\n\nVi el catálogo de ${company.name}`;

  const shareProduct = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: product.name, text: `${product.name} — ${formatMoney(product.price, currency)}`, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{product.category}</p>
          <div className="flex gap-2">
            <button onClick={shareProduct} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Share2 size={16} /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
          </div>
        </div>

        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-video object-cover" />
        ) : (
          <div className="w-full aspect-video bg-slate-50 flex items-center justify-center">
            <Package size={56} className="text-slate-200" />
          </div>
        )}

        <div className="p-5 space-y-4">
          {product.brand && <span className="inline-block text-xs bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">{product.brand}</span>}
          <h2 className="text-xl font-black text-slate-800">{product.name}</h2>
          {product.description && <p className="text-slate-500 text-sm leading-relaxed">{product.description}</p>}

          <div className="flex items-center justify-between py-3 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Precio</p>
              <p className="text-3xl font-black text-indigo-600">{formatMoney(product.price, currency)}</p>
              {product.tax_rate > 0 && <p className="text-xs text-slate-400">IVA {product.tax_rate}% incluido</p>}
            </div>
            {outOfStock ? (
              <span className="bg-red-100 text-red-600 text-sm font-bold px-3 py-1.5 rounded-xl">Agotado</span>
            ) : product.type !== 'SERVICE' && (
              <span className="bg-emerald-100 text-emerald-600 text-sm font-bold px-3 py-1.5 rounded-xl">Disponible</span>
            )}
          </div>

          {phone && (
            <a href={buildWhatsAppLink(phone, waMessage)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366] hover:bg-[#1fba59] text-white rounded-2xl font-black text-base transition-all active:scale-95 shadow-lg shadow-green-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Pedir por WhatsApp
            </a>
          )}
          {!phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-center">
              Contacta al negocio para más información
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Catalog Page ────────────────────────────────────────────────────────
const PublicCatalog: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<CatalogCompany | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [detailProduct, setDetailProduct] = useState<CatalogProduct | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: comp, error: compErr }, { data: prods, error: prodsErr }] = await Promise.all([
        supabase.from('companies').select('id,name,nit,phone,logo_url,address,catalog_whatsapp,catalog_message,config').eq('id', companyId).single(),
        supabase.from('products').select('id,name,description,price,category,brand,image_url,stock_quantity,tax_rate,type').eq('company_id', companyId).eq('is_active', true).order('category').order('name'),
      ]);
      if (compErr || !comp) { setError('Catálogo no encontrado o no disponible'); setLoading(false); return; }
      setCompany(comp);
      setProducts(prods || []);
    } catch (e) {
      setError('Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  };

  const currency = company?.config?.currency_symbol || '$';
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map(p => p.category || 'General').filter(Boolean)))], [products]);

  const filtered = useMemo(() => products.filter(p => {
    const matchCat = activeCategory === 'Todos' || (p.category || 'General') === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [products, activeCategory, search]);

  const catalogUrl = window.location.href;
  const shareMessage = `🛍️ Mira el catálogo de *${company?.name}*:\n${catalogUrl}`;
  const phone = company?.catalog_whatsapp || company?.phone || '';

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `Catálogo ${company?.name}`, url: catalogUrl });
    } else {
      navigator.clipboard.writeText(catalogUrl);
      setShowShare(true);
      setTimeout(() => setShowShare(false), 2500);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Cargando catálogo...</p>
      </div>
    </div>
  );

  // ── Error ──
  if (error || !company) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <Package size={48} className="mx-auto text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-700 mb-2">Catálogo no disponible</h2>
        <p className="text-slate-400 text-sm">{error || 'Este catálogo no existe o no está habilitado.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
                  {company.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-black text-slate-800 text-base leading-tight">{company.name}</h1>
                {company.address && <p className="text-xs text-slate-400">{company.address}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {phone && (
                <a href={buildWhatsAppLink(phone, `¡Hola ${company.name}! Vi su catálogo en línea.`)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1fba59]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contactar
                </a>
              )}
              <button onClick={handleShare} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 relative">
                <Share2 size={17} />
                {showShare && (
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">¡Link copiado!</span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors"
              placeholder={`Buscar en ${company.name}...`}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Category tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-4xl mx-auto px-4 py-5">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No se encontraron productos</p>
            {search && <p className="text-sm mt-1">Prueba con otra búsqueda</p>}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} company={company} onDetail={setDetailProduct} currency={currency} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-slate-300">
        Powered by <a href="https://posmaster.app" className="font-bold hover:text-indigo-400">POSmaster</a>
      </div>

      {/* Detail Modal */}
      {detailProduct && (
        <DetailModal product={detailProduct} company={company} currency={currency} onClose={() => setDetailProduct(null)} />
      )}
    </div>
  );
};

export default PublicCatalog;
