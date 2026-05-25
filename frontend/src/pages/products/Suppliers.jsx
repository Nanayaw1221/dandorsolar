import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', contactPerson: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/suppliers');
      setSuppliers(data?.suppliers || data || []);
    } catch { setSuppliers([]); } finally { setLoading(false); }
  };

  const openAdd = () => { setEditItem(null); setForm({ name: '', phone: '', email: '', address: '', contactPerson: '' }); setModalOpen(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name || '', phone: item.phone || '', email: item.email || '', address: item.address || '', contactPerson: item.contactPerson || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Supplier name required'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/suppliers/${editItem._id}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier added');
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) { toast.error(err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${deleteId}`);
      toast.success('Supplier deleted');
      setDeleteId(null);
      fetchSuppliers();
    } catch (err) { toast.error(err?.message || 'Failed to delete'); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', header: 'Supplier Name', render: v => <span className="font-semibold text-gray-900">{v}</span> },
    { key: 'contactPerson', header: 'Contact Person', render: v => v || '—' },
    { key: 'phone', header: 'Phone', render: v => v || '—' },
    { key: 'email', header: 'Email', render: v => v || '—' },
    { key: 'address', header: 'Address', render: v => v ? <span className="text-xs text-gray-500 truncate block max-w-[180px]">{v}</span> : '—' },
    { key: 'actions', header: 'Actions', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row)} className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors">Edit</button>
        <button onClick={() => setDeleteId(row._id)} className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors">Delete</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">{suppliers.length} suppliers</p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Add Supplier</Button>
      </div>

      <Table columns={columns} data={suppliers} loading={loading} emptyMessage="No suppliers found" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Supplier' : 'Add Supplier'} size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Add Supplier'}</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Input label="Supplier Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company name" required /></div>
          <Input label="Contact Person" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="Name of contact" />
          <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+233..." />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Physical address" /></div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Supplier" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Delete this supplier? This will not affect existing purchases.</p>
      </Modal>
    </div>
  );
}
