import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.get('/categories');
      setCategories(data?.categories || data || []);
    } catch { setCategories([]); } finally { setLoading(false); }
  };

  const openAdd = () => { setEditItem(null); setForm({ name: '', description: '' }); setModalOpen(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, description: item.description || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Category name required'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/categories/${editItem._id}`, form);
        toast.success('Category updated');
      } else {
        await api.post('/categories', form);
        toast.success('Category added');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) { toast.error(err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteId}`);
      toast.success('Category deleted');
      setDeleteId(null);
      fetchCategories();
    } catch (err) { toast.error(err?.message || 'Failed to delete'); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', header: 'Category Name', render: v => <span className="font-semibold text-gray-900">{v}</span> },
    { key: 'description', header: 'Description', render: v => v || <span className="text-gray-400">—</span> },
    { key: 'productCount', header: 'Products', render: v => <span className="font-medium text-orange-600">{v || 0}</span> },
    { key: 'createdAt', header: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
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
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">{categories.length} categories</p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Add Category</Button>
      </div>

      <Table columns={columns} data={categories} loading={loading} emptyMessage="No categories found" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Category' : 'Add Category'} size="sm"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Add Category'}</Button></>}>
        <div className="space-y-4">
          <Input label="Category Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Solar Panels" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Optional description" />
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Category" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Delete this category? Products in this category will become uncategorized.</p>
      </Modal>
    </div>
  );
}
