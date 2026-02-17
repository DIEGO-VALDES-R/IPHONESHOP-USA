import React, { useState } from 'react';
import { Edit, Trash2, Plus, Filter, Download, X, Save, Search, Barcode } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { Product, ProductType } from '../types';

const Inventory: React.FC = () => {
  const { formatMoney } = useCurrency();
  const { products, addProduct, updateProduct, deleteProduct } = useDatabase();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', price: 0, cost: 0, stock_quantity: 0, type: ProductType.STANDARD, category: 'General'
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', price: 0, cost: 0, stock_quantity: 0, type: ProductType.STANDARD, category: 'General' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
    } else {
      addProduct(formData as any);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este producto?')) {
      deleteProduct(id);
    }
  };

  // Scanner Logic for Inventory
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm) {
        // Exact match finds the product to edit
        const exactMatch = products.find(p => p.sku.toLowerCase() === searchTerm.toLowerCase());
        if (exactMatch) {
            handleOpenEdit(exactMatch);
            setSearchTerm('');
        }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
          <p className="text-slate-500">Gestión de productos, precios y stock</p>
        </div>
        <div className="flex gap-2">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Escanear Código / Buscar..." 
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Barcode size={16} />
            </div>
           </div>
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm transition-colors"
          >
            <Plus size={16} />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Producto</th>
                <th className="px-6 py-4 font-semibold text-slate-700">SKU</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Precio Venta</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Stock</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Tipo</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">{product.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">{product.sku}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{formatMoney(product.price)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      product.stock_quantity > 5 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {product.stock_quantity} un.
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      product.type === 'SERIALIZED' 
                        ? 'bg-amber-100 text-amber-800' 
                        : product.type === 'SERVICE'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {product.type === 'SERIALIZED' ? 'IMEI' : product.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleOpenEdit(product)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Código</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    placeholder="Puede usar lector"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option>General</option>
                    <option>Smartphones</option>
                    <option>Laptops</option>
                    <option>Accesorios</option>
                    <option>Servicios</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta (COP)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo (COP)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.cost}
                    onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Producto</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as ProductType})}
                  >
                    <option value={ProductType.STANDARD}>Estándar</option>
                    <option value={ProductType.SERIALIZED}>Serializado (IMEI)</option>
                    <option value={ProductType.SERVICE}>Servicio</option>
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                   <input 
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.stock_quantity}
                      onChange={e => setFormData({...formData, stock_quantity: Number(e.target.value)})}
                      disabled={formData.type === ProductType.SERVICE}
                   />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center gap-2"
                >
                  <Save size={18} />
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;