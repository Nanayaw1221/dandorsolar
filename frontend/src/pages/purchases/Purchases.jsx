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

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: '', purchaseDate: new Date().toISOString().split('T')[0],
    invoiceNo: '', notes: '',
    items: [{ productId: '', productName: '', qty: 1, costPrice: 0 }],
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, s, pr] = await Promise.all([
        api.get('/purchases').catch(() => []),
        api.get('/suppliers').catch(() => []),
        api.get('/products').catch(() => []),
      ]);
      setPurchases(Array.isArray(p?.data) ? p.data : []);
      setSuppliers(Array.isArray(s?.data) ? s.data : []);
      setProducts(Array.isArray(pr?.data) ? pr.data : []);
    } catch { } finally { setLoading(false); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', qty: 1, costPrice: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: val };
      if (field === 'productId') {
        const prod = products.find(p => p._id === val);
        if (prod) items[i].productName = prod.name;
        if (prod) items[i].costPrice = prod.costPrice || 0;
      }
      return { ...f, items };
    });
  };

  const total = form.items.reduce((sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.costPrice) || 0), 0);

  const handleSave = async () => {
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.items.some(i => !i.productId || !i.qty)) { toast.error('All items must have a product and quantity'); return; }
    setSaving(true);
    try {
      await api.post('/purchases', { ...form, total });
      toast.success('Purchase recorded and stock updated');
      setModalOpen(false);
      setForm({ supplierId: '', purchaseDate: new Date().toISOString().split('T')[0], invoiceNo: '', notes: '', items: [{ productId: '', productName: '', qty: 1, costPrice: 0 }] });
      fetchAll();
    } catch (err) { toast.error(err?.message || 'Failed to record purchase'); } finally { setSaving(false); }
  };

  const columns = [
    { key: 'invoiceNo', header: 'Invoice #', render: v => <span className="font-mono text-xs font-semibold">{v || '—'}</span> },
    { key: 'supplier', header: 'Supplier', render: (v, row) => {
      const sup = suppliers.find(s => s._id === (row.supplierId || v?._id));
      return <span className="font-medium">{sup?.name || v?.name || '—'}</span>;
    }},
    { key: 'purchaseDate', header: 'Date', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'items', header: 'Items', render: v => <span className="text-orange-600 font-medium">{Array.isArray(v) ? v.length : 0} items</span> },
    { key: 'total', header: 'Total', render: v => <span className="font-bold text-gray-900">{GHS(v)}</span> },
    { key: 'createdBy', header: 'Recorded By', render: v => v?.name || v?.username || '—' },
    { key: 'actions', header: 'Actions', render: (_, row) => (
      <button onClick={() => { setViewItem(row); setViewModal(true); }} className="px-2.5 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors">View</button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500 mt-1">{purchases.length} purchase records</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>+ Record Purchase</Button>
      </div>

      <Table columns={columns} data={purchases} loading={loading} emptyMessage="No purchases recorded yet" />

      {/* Add Purchase Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record New Purchase" size="xl"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>Record Purchase</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Supplier *" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required>
              <option value="">Select Supplier</option>
              {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
            <Input label="Invoice Number" value={form.invoiceNo} onChange={e => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Supplier invoice #" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <Button variant="secondary" size="sm" onClick={addItem}>+ Add Item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                  <div className="col-span-5">
                    <Select label={i === 0 ? "Product" : undefined} value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input label={i === 0 ? "Qty" : undefined} type="number" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} min="1" />
                  </div>
                  <div className="col-span-3">
                    <Input label={i === 0 ? "Cost Price" : undefined} type="number" value={item.costPrice} onChange={e => updateItem(i, 'costPrice', e.target.value)} min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="col-span-1 text-right text-sm font-semibold text-orange-600 pb-2">
                    {GHS((parseFloat(item.qty) || 0) * (parseFloat(item.costPrice) || 0))}
                  </div>
                  <div className="col-span-1 pb-2">
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-gray-200">
              <div className="text-right">
                <span className="text-sm text-gray-500 mr-3">Total:</span>
                <span className="text-xl font-black text-orange-600">{GHS(total)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Optional notes" />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Purchase Details" size="lg"
        footer={<Button variant="ghost" onClick={() => setViewModal(false)}>Close</Button>}>
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Invoice:</span> <span className="font-semibold">{viewItem.invoiceNo || '—'}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{viewItem.purchaseDate ? new Date(viewItem.purchaseDate).toLocaleDateString() : '—'}</span></div>
              <div><span className="text-gray-500">Supplier:</span> <span className="font-semibold">{viewItem.supplier?.name || suppliers.find(s => s._id === viewItem.supplierId)?.name || '—'}</span></div>
              <div><span className="text-gray-500">Total:</span> <span className="font-bold text-orange-600">{GHS(viewItem.total)}</span></div>
            </div>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead><tr className="bg-orange-500 text-white"><th className="text-left px-3 py-2">Product</th><th className="text-center px-3 py-2">Qty</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Total</th></tr></thead>
              <tbody>
                {(viewItem.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2">{item.productName || item.product?.name || '—'}</td>
                    <td className="px-3 py-2 text-center">{item.qty}</td>
                    <td className="px-3 py-2 text-right">{GHS(item.costPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{GHS((item.qty || 0) * (item.costPrice || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewItem.notes && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewItem.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
