import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function WorkerPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    workerName: '', workerPhone: '', amount: '', commissionRate: '',
    periodStart: '', periodEnd: '', paymentDate: new Date().toISOString().split('T')[0], notes: ''
  });

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await api.get('/worker-payments');
      setPayments(data?.payments || data || []);
    } catch { setPayments([]); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.workerName.trim()) { toast.error('Worker name required'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await api.post('/worker-payments', { ...form, amount: parseFloat(form.amount), commissionRate: parseFloat(form.commissionRate) || 0 });
      toast.success('Payment recorded');
      setModalOpen(false);
      setForm({ workerName: '', workerPhone: '', amount: '', commissionRate: '', periodStart: '', periodEnd: '', paymentDate: new Date().toISOString().split('T')[0], notes: '' });
      fetchPayments();
    } catch (err) { toast.error(err?.message || 'Failed to record payment'); } finally { setSaving(false); }
  };

  const columns = [
    { key: 'workerName', header: 'Worker', render: (v, row) => (
      <div><p className="font-semibold text-gray-900">{v}</p><p className="text-xs text-gray-400">{row.workerPhone || ''}</p></div>
    )},
    { key: 'periodStart', header: 'Period', render: (v, row) => (
      v && row.periodEnd
        ? `${new Date(v).toLocaleDateString('en-GH')} — ${new Date(row.periodEnd).toLocaleDateString('en-GH')}`
        : v ? new Date(v).toLocaleDateString('en-GH') : '—'
    )},
    { key: 'amount', header: 'Amount Paid', render: v => <span className="font-bold text-orange-600">{GHS(v)}</span> },
    { key: 'commissionRate', header: 'Commission %', render: v => v ? `${v}%` : '—' },
    { key: 'paymentDate', header: 'Payment Date', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'notes', header: 'Notes', render: v => v || '—' },
    { key: 'recordedBy', header: 'Recorded By', render: v => <span className="text-xs text-gray-500">{v?.name || v?.username || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Worker Payments</h1>
          <p className="text-sm text-gray-500 mt-1">{payments.length} payment records</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>+ Record Payment</Button>
      </div>

      <Table columns={columns} data={payments} loading={loading} emptyMessage="No payment records found" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Worker Payment" size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>Record Payment</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Worker Name *" value={form.workerName} onChange={e => setForm({ ...form, workerName: e.target.value })} placeholder="Full name" required />
          </div>
          <Input label="Phone Number" value={form.workerPhone} onChange={e => setForm({ ...form, workerPhone: e.target.value })} placeholder="+233..." />
          <Input label="Amount (GH₵) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
          <Input label="Commission Rate (%)" type="number" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} placeholder="Optional" min="0" max="100" />
          <Input label="Payment Date" type="date" value={form.paymentDate} onChange={e => setForm({ ...form, paymentDate: e.target.value })} />
          <Input label="Period Start" type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
          <Input label="Period End" type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Optional notes" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
