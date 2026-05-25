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
import Stat from '../../components/ui/Stat';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const CATEGORIES = ['Rent', 'Utilities', 'Transport', 'Salaries', 'Maintenance', 'Marketing', 'Office Supplies', 'Other'];

const catVariant = { Rent: 'info', Utilities: 'warning', Transport: 'default', Salaries: 'orange', Maintenance: 'purple', Marketing: 'success', Other: 'default' };

export default function Expenses() {
  const { user, hasMinLevel } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [stats, setStats] = useState({ totalMonth: 0, myMonth: 0 });
  const [form, setForm] = useState({ category: 'Other', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchExpenses(); }, [filterStart, filterEnd]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStart) params.append('startDate', filterStart);
      if (filterEnd) params.append('endDate', filterEnd);
      const data = await api.get(`/expenses?${params}`);
      const list = data?.expenses || data || [];
      setExpenses(list);
      const now = new Date();
      const thisMonth = list.filter(e => {
        const d = new Date(e.date || e.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      setStats({
        totalMonth: thisMonth.reduce((s, e) => s + (e.amount || 0), 0),
        myMonth: thisMonth.filter(e => e.createdBy?._id === user?._id || e.userId === user?._id).reduce((s, e) => s + (e.amount || 0), 0),
      });
    } catch { setExpenses([]); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!form.description.trim()) { toast.error('Description required'); return; }
    setSaving(true);
    try {
      await api.post('/expenses', { ...form, amount: parseFloat(form.amount) });
      toast.success('Expense recorded');
      setModalOpen(false);
      setForm({ category: 'Other', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    } catch (err) { toast.error(err?.message || 'Failed to record expense'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/expenses/${deleteId}`);
      toast.success('Expense deleted');
      setDeleteId(null);
      fetchExpenses();
    } catch (err) { toast.error(err?.message || 'Failed to delete'); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'date', header: 'Date', render: v => v ? new Date(v).toLocaleDateString('en-GH') : '—' },
    { key: 'category', header: 'Category', render: v => <Badge variant={catVariant[v] || 'default'}>{v}</Badge> },
    { key: 'amount', header: 'Amount', render: v => <span className="font-bold text-red-600">{GHS(v)}</span> },
    { key: 'description', header: 'Description', render: v => <span className="text-gray-700">{v}</span> },
    { key: 'createdBy', header: 'Recorded By', render: (v, row) => <span className="text-xs text-gray-500">{v?.name || v?.username || '—'}</span> },
    ...(hasMinLevel(2) ? [{ key: 'actions', header: 'Actions', render: (_, row) => (
      <button onClick={() => setDeleteId(row._id)} className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors">Delete</button>
    )}] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">{expenses.length} expense records</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>+ Add Expense</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Stat title="Total This Month" value={GHS(stats.totalMonth)} icon="💸" color="red" />
        <Stat title="My Expenses This Month" value={GHS(stats.myMonth)} icon="👤" color="orange" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <Input label="From Date" type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="max-w-[160px]" />
        <Input label="To Date" type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="max-w-[160px]" />
        <Button variant="ghost" size="md" onClick={() => { setFilterStart(''); setFilterEnd(''); }}>Clear</Button>
      </div>

      <Table columns={columns} data={expenses} loading={loading} emptyMessage="No expenses found" />

      {/* Add Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Expense" size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>Record Expense</Button></>}>
        <div className="space-y-4">
          <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Amount (GH₵)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="What was this expense for?" />
          </div>
          <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Expense" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Are you sure you want to delete this expense record?</p>
      </Modal>
    </div>
  );
}
