import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Stat from '../../components/ui/Stat';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const getStatus = (debt) => {
  if ((debt.remaining || 0) <= 0) return 'Paid';
  if (debt.dueDate && new Date(debt.dueDate) < new Date()) return 'Overdue';
  return 'Active';
};

const statusVariant = { Active: 'info', Overdue: 'error', Paid: 'success' };

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [paying, setPaying] = useState(false);
  const [stats, setStats] = useState({ total: 0, overdue: 0 });

  useEffect(() => { fetchDebts(); }, []);

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/debts');
      const list = Array.isArray(data?.data) ? data.data : [];
      setDebts(list);
      const outstanding = list.filter(d => (d.remaining || 0) > 0);
      const overdue = outstanding.filter(d => d.dueDate && new Date(d.dueDate) < new Date());
      setStats({
        total: outstanding.reduce((s, d) => s + (d.remaining || 0), 0),
        overdue: overdue.length,
      });
    } catch { setDebts([]); } finally { setLoading(false); }
  };

  const openPayment = (debt) => {
    setSelectedDebt(debt);
    setPayForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
    setPayModal(true);
  };

  const handlePayment = async () => {
    const amt = parseFloat(payForm.amount || 0);
    if (!amt || amt <= 0) { toast.error('Enter valid payment amount'); return; }
    if (amt > (selectedDebt.remaining || 0)) { toast.error(`Amount exceeds remaining balance of ${GHS(selectedDebt.remaining)}`); return; }
    setPaying(true);
    try {
      await api.post(`/debts/${selectedDebt._id}/payment`, { amount: amt, date: payForm.date, note: payForm.note });
      toast.success('Payment recorded');
      setPayModal(false);
      fetchDebts();
    } catch (err) { toast.error(err?.message || 'Failed to record payment'); } finally { setPaying(false); }
  };

  const filtered = debts.filter(d => {
    if (!filter) return true;
    return getStatus(d).toLowerCase() === filter.toLowerCase();
  });

  const columns = [
    { key: 'customerName', header: 'Customer', render: (v, row) => (
      <div><p className="font-semibold text-gray-900">{v || row.customer?.name || '—'}</p><p className="text-xs text-gray-400">{row.customerPhone || row.customer?.phone || ''}</p></div>
    )},
    { key: 'totalAmount', header: 'Total Owed', render: v => GHS(v) },
    { key: 'amountPaid', header: 'Paid', render: v => <span className="text-green-600 font-medium">{GHS(v)}</span> },
    { key: 'remaining', header: 'Remaining', render: v => <span className="font-bold text-red-600">{GHS(v)}</span> },
    { key: 'dueDate', header: 'Due Date', render: v => {
      if (!v) return '—';
      const d = new Date(v);
      const isOverdue = d < new Date();
      return <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>{d.toLocaleDateString('en-GH')}</span>;
    }},
    { key: 'status', header: 'Status', render: (_, row) => {
      const s = getStatus(row);
      return <Badge variant={statusVariant[s]}>{s}</Badge>;
    }},
    { key: 'actions', header: 'Actions', render: (_, row) => {
      const s = getStatus(row);
      if (s === 'Paid') return <Badge variant="success">Paid</Badge>;
      return (
        <button onClick={() => openPayment(row)} className="px-2.5 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors">
          Record Payment
        </button>
      );
    }},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debts</h1>
          <p className="text-sm text-gray-500 mt-1">{debts.filter(d => (d.remaining || 0) > 0).length} outstanding debts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Stat title="Total Outstanding" value={GHS(stats.total)} icon="📋" color="red" />
        <Stat title="Overdue Debts" value={stats.overdue} icon="⚠️" color="yellow" />
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-2 flex-wrap">
        {['', 'Active', 'Overdue', 'Paid'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <Table columns={columns} data={filtered} loading={loading} emptyMessage="No debt records found" />

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment" size="sm"
        footer={<><Button variant="ghost" onClick={() => setPayModal(false)}>Cancel</Button><Button variant="primary" loading={paying} onClick={handlePayment}>Record Payment</Button></>}>
        {selectedDebt && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="font-semibold text-gray-900">{selectedDebt.customerName || selectedDebt.customer?.name}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-500">Remaining Balance</span>
                <span className="font-bold text-red-600">{GHS(selectedDebt.remaining)}</span>
              </div>
            </div>
            <Input label="Payment Amount (GH₵)" type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0.00" min="0.01" max={selectedDebt.remaining} step="0.01" required />
            <Input label="Payment Date" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
              <textarea value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Payment note..." />
            </div>
            {payForm.amount && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New Balance After Payment</span>
                  <span className="font-bold text-green-600">{GHS(Math.max(0, (selectedDebt.remaining || 0) - parseFloat(payForm.amount || 0)))}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
