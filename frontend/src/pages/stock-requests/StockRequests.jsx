import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const statusVariant = { Pending: 'warning', Approved: 'success', Rejected: 'error' };

export default function StockRequests() {
  const { user, hasMinLevel } = useAuth();
  const isCEO = hasMinLevel(3);
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [form, setForm] = useState({
    notes: '',
    items: [{ productId: '', productName: '', qty: 1, estimatedCost: 0 }],
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get('/stock-requests').catch(() => []),
        api.get('/products').catch(() => []),
      ]);
      setRequests(r?.requests || r || []);
      setProducts(p?.products || p || []);
    } catch { } finally { setLoading(false); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', qty: 1, estimatedCost: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: val };
      if (field === 'productId') {
        const prod = products.find(p => p._id === val);
        if (prod) { items[i].productName = prod.name; items[i].estimatedCost = prod.costPrice || 0; }
      }
      return { ...f, items };
    });
  };

  const total = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.estimatedCost) || 0), 0);

  const handleSave = async () => {
    if (form.items.some(i => !i.productId || !i.qty)) { toast.error('All items must have a product and quantity'); return; }
    setSaving(true);
    try {
      await api.post('/stock-requests', { ...form, totalAmount: total });
      toast.success('Stock request submitted');
      setModalOpen(false);
      setForm({ notes: '', items: [{ productId: '', productName: '', qty: 1, estimatedCost: 0 }] });
      fetchAll();
    } catch (err) { toast.error(err?.message || 'Failed to submit'); } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    setActioning(id + action);
    try {
      await api.put(`/stock-requests/${id}/${action}`);
      toast.success(`Request ${action}d`);
      fetchAll();
    } catch (err) { toast.error(err?.message || `Failed to ${action}`); } finally { setActioning(null); }
  };

  const columns = [
    { key: 'createdAt', header: 'Date', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'createdBy', header: 'Created By', render: v => v?.name || v?.username || '—' },
    { key: 'status', header: 'Status', render: v => <Badge variant={statusVariant[v] || 'default'}>{v || 'Pending'}</Badge> },
    { key: 'items', header: 'Items', render: v => <span className="text-orange-600 font-medium">{Array.isArray(v) ? v.length : 0} items</span> },
    { key: 'totalAmount', header: 'Est. Total', render: v => <span className="font-bold">{GHS(v)}</span> },
    { key: 'actions', header: 'Actions', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => { setViewItem(row); setViewModal(true); }} className="px-2.5 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors">View</button>
        {isCEO && row.status === 'Pending' && (
          <>
            <button
              onClick={() => handleAction(row._id, 'approve')}
              disabled={!!actioning}
              className="px-2.5 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors disabled:opacity-50"
            >
              {actioning === row._id + 'approve' ? '...' : 'Approve'}
            </button>
            <button
              onClick={() => handleAction(row._id, 'reject')}
              disabled={!!actioning}
              className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors disabled:opacity-50"
            >
              {actioning === row._id + 'reject' ? '...' : 'Reject'}
            </button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1>
          <p className="text-sm text-gray-500 mt-1">{requests.length} requests &bull; {requests.filter(r => r.status === 'Pending').length} pending</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>+ New Request</Button>
      </div>

      <Table columns={columns} data={requests} loading={loading} emptyMessage="No stock requests found" />

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Stock Request" size="xl"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>Submit Request</Button></>}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Items *</label>
            <Button variant="secondary" size="sm" onClick={addItem}>+ Add Item</Button>
          </div>
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
                <Input label={i === 0 ? "Est. Cost" : undefined} type="number" value={item.estimatedCost} onChange={e => updateItem(i, 'estimatedCost', e.target.value)} min="0" step="0.01" />
              </div>
              <div className="col-span-1 text-right text-xs font-semibold text-orange-600 pb-2">
                {GHS((parseFloat(item.qty) || 0) * (parseFloat(item.estimatedCost) || 0))}
              </div>
              <div className="col-span-1 pb-2">
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2 border-t">
            <span className="text-sm text-gray-500 mr-3">Est. Total:</span>
            <span className="font-black text-orange-600">{GHS(total)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Reason for request..." />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Stock Request Details" size="lg"
        footer={<Button variant="ghost" onClick={() => setViewModal(false)}>Close</Button>}>
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Requested by:</span> <span className="font-semibold">{viewItem.createdBy?.name || '—'}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{new Date(viewItem.createdAt).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={statusVariant[viewItem.status]}>{viewItem.status || 'Pending'}</Badge></div>
              <div><span className="text-gray-500">Est. Total:</span> <span className="font-bold text-orange-600">{GHS(viewItem.totalAmount)}</span></div>
            </div>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead><tr className="bg-orange-500 text-white"><th className="text-left px-3 py-2">Product</th><th className="text-center px-3 py-2">Qty</th><th className="text-right px-3 py-2">Est. Cost</th><th className="text-right px-3 py-2">Total</th></tr></thead>
              <tbody>
                {(viewItem.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2">{item.productName || item.product?.name || '—'}</td>
                    <td className="px-3 py-2 text-center">{item.qty}</td>
                    <td className="px-3 py-2 text-right">{GHS(item.estimatedCost)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{GHS((item.qty || 0) * (item.estimatedCost || 0))}</td>
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
