import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const emptyProduct = { name: '', barcode: '', category_id: '', supplier_id: '', quantity: 0, low_stock_level: 5, cost_price: 0, selling_price: 0, image_url: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
        api.get('/suppliers').catch(() => ({ data: [] })),
      ]);
      setProducts(Array.isArray(p?.data) ? p.data : []);
      setCategories(Array.isArray(c?.data) ? c.data : []);
      setSuppliers(Array.isArray(s?.data) ? s.data : []);
    } catch { } finally { setLoading(false); }
  };

  const openAdd = () => { setEditProduct(null); setForm(emptyProduct); setModalOpen(true); };
  const openEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name || '',
      barcode: product.barcode || '',
      category_id: product.category_id?._id || product.category_id || '',
      supplier_id: product.supplier_id?._id || product.supplier_id || '',
      quantity: product.quantity || 0,
      low_stock_level: product.low_stock_level || 5,
      cost_price: product.cost_price || 0,
      selling_price: product.selling_price || 0,
      image_url: product.image_url || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name required'); return; }
    setSaving(true);
    try {
      if (editProduct) {
        await api.put(`/products/${editProduct._id}`, form);
        toast.success('Product updated');
      } else {
        await api.post('/products', form);
        toast.success('Product added');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) { toast.error(err?.message || 'Failed to save product'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteId}`);
      toast.success('Product deleted');
      setDeleteId(null);
      fetchAll();
    } catch (err) { toast.error(err?.message || 'Failed to delete'); } finally { setDeleting(false); }
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search);
    const catId = p.category_id?._id || p.category_id || '';
    const matchCat = !filterCategory || catId === filterCategory;
    const minStock = p.low_stock_level || 5;
    const matchStock = !filterStock ||
      (filterStock === 'low' && (p.quantity || 0) <= minStock && (p.quantity || 0) > 0) ||
      (filterStock === 'out' && (p.quantity || 0) === 0) ||
      (filterStock === 'ok' && (p.quantity || 0) > minStock);
    return matchSearch && matchCat && matchStock;
  });

  const lowStockItems = products.filter(p => (p.quantity || 0) <= (p.low_stock_level || 5));
  const margin = (p) => p.cost_price > 0 ? (((p.selling_price - p.cost_price) / p.cost_price) * 100).toFixed(1) : '—';

  const columns = [
    { key: 'image_url', header: '', render: v => v
      ? <img src={v} alt="product" className="w-10 h-10 object-cover rounded-lg border border-gray-200" />
      : <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-400 text-lg">☀️</div>
    },
    { key: 'barcode', header: 'Barcode', render: v => <span className="text-xs text-gray-500 font-mono">{v || '—'}</span> },
    { key: 'name', header: 'Product Name', render: (v) => <p className="font-medium text-gray-900">{v}</p> },
    { key: 'category_id', header: 'Category', render: (v) => {
      const cat = categories.find(c => c._id === (v?._id || v));
      return <Badge variant="info">{cat?.name || '—'}</Badge>;
    }},
    { key: 'quantity', header: 'Stock', render: (v, row) => {
      const qty = v || 0;
      const min = row.low_stock_level || 5;
      const variant = qty === 0 ? 'error' : qty <= min ? 'warning' : 'success';
      return <Badge variant={variant}>{qty} units</Badge>;
    }},
    { key: 'cost_price', header: 'Cost Price', render: v => GHS(v) },
    { key: 'selling_price', header: 'Sell Price', render: v => <span className="font-semibold text-orange-600">{GHS(v)}</span> },
    { key: '_id', header: 'Margin%', render: (_, row) => (
      <span className="text-green-600 font-medium">{margin(row)}%</span>
    )},
    { key: 'actions', header: 'Actions', render: (_, row) => (
      <div className="flex items-center gap-1">
        <button onClick={() => openEdit(row)} className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">Edit</button>
        <button onClick={() => setDeleteId(row._id)} className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium">Delete</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} products &bull; {lowStockItems.length} low stock</p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Add Product</Button>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800">Low Stock Alert</p>
            <p className="text-sm text-yellow-700">{lowStockItems.length} products running low: {lowStockItems.slice(0, 3).map(p => p.name).join(', ')}{lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ''}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={filterStock} onChange={e => setFilterStock(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
          <option value="">All Stock</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <Table columns={columns} data={filtered} loading={loading} emptyMessage="No products found" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProduct ? 'Edit Product' : 'Add New Product'} size="lg"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editProduct ? 'Save Changes' : 'Add Product'}</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Input label="Product Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Solar Panel 200W" required /></div>
          <Input label="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or enter barcode" />
          <Select label="Category" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select Category</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Supplier" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Select Supplier</option>
            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
          <Input label="Initial Stock Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="0" />
          <Input label="Min Stock Level (Alert)" type="number" value={form.low_stock_level} onChange={e => setForm({ ...form, low_stock_level: parseInt(e.target.value) || 0 })} min="0" />
          <Input label="Cost Price (GH₵)" type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
          <Input label="Selling Price (GH₵)" type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
          {form.cost_price > 0 && form.selling_price > 0 && (
            <div className="sm:col-span-2 bg-green-50 rounded-lg p-3 text-sm text-green-700">
              Margin: <span className="font-bold">{(((form.selling_price - form.cost_price) / form.cost_price) * 100).toFixed(1)}%</span>
              {' '}&bull; Profit per unit: <span className="font-bold">{GHS(form.selling_price - form.cost_price)}</span>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Image</label>
            <input
              type="file" accept="image/*"
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
                const reader = new FileReader();
                reader.onloadend = () => setForm(f => ({ ...f, image_url: reader.result }));
                reader.readAsDataURL(file);
              }}
            />
            {form.image_url && (
              <div className="mt-2 relative inline-block">
                <img src={form.image_url} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                <button onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">✕</button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Product" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Are you sure you want to delete this product? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
