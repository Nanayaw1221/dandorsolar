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

const roleVariant = { 'Super Admin': 'purple', 'CEO': 'info', 'Manager': 'orange', 'Sales': 'success' };
const statusVariant = { active: 'success', inactive: 'error' };

export default function UserManagement() {
  const { user: currentUser, hasMinLevel } = useAuth();
  const isSuperAdmin = hasMinLevel(4);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', role: 'Sales', isActive: true });

  const availableRoles = isSuperAdmin
    ? ['Super Admin', 'CEO', 'Manager', 'Sales']
    : ['Manager', 'Sales'];

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/users');
      let list = data?.users || data || [];
      if (!isSuperAdmin) {
        list = list.filter(u => u.role === 'Manager' || u.role === 'Sales');
      }
      setUsers(list);
    } catch { setUsers([]); } finally { setLoading(false); }
  };

  const openAdd = () => { setEditItem(null); setForm({ username: '', name: '', email: '', password: '', role: 'Sales', isActive: true }); setModalOpen(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ username: item.username, name: item.name || '', email: item.email || '', password: '', role: item.role, isActive: item.isActive !== false });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) { toast.error('Username required'); return; }
    if (!editItem && !form.password.trim()) { toast.error('Password required for new user'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editItem && !payload.password) delete payload.password;
      if (editItem) {
        await api.put(`/users/${editItem._id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) { toast.error(err?.message || 'Failed to save user'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteId}`);
      toast.success('User deleted');
      setDeleteId(null);
      fetchUsers();
    } catch (err) { toast.error(err?.message || 'Failed to delete user'); } finally { setDeleting(false); }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) { toast.error('Enter new password'); return; }
    setResetting(true);
    try {
      await api.put(`/users/${resetId}/reset-password`, { password: newPassword });
      toast.success('Password reset successfully');
      setResetId(null);
      setNewPassword('');
    } catch (err) { toast.error(err?.message || 'Failed to reset password'); } finally { setResetting(false); }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { ...user, isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch (err) { toast.error(err?.message || 'Failed to update status'); }
  };

  const columns = [
    { key: 'username', header: 'Username', render: (v, row) => (
      <div><p className="font-semibold text-gray-900">{v}</p><p className="text-xs text-gray-400">{row.name}</p></div>
    )},
    { key: 'email', header: 'Email', render: v => v || '—' },
    { key: 'role', header: 'Role', render: v => <Badge variant={roleVariant[v] || 'default'}>{v}</Badge> },
    { key: 'isActive', header: 'Status', render: v => <Badge variant={v !== false ? 'success' : 'error'}>{v !== false ? 'Active' : 'Inactive'}</Badge> },
    { key: 'lastLogin', header: 'Last Login', render: v => v ? new Date(v).toLocaleString() : 'Never' },
    { key: 'actions', header: 'Actions', render: (_, row) => {
      if (row._id === currentUser?._id) return <span className="text-xs text-gray-400">Current User</span>;
      return (
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => openEdit(row)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium">Edit</button>
          <button onClick={() => { setResetId(row._id); setNewPassword(''); }} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100 font-medium">Reset Pwd</button>
          <button onClick={() => toggleActive(row)} className={`px-2 py-1 text-xs rounded font-medium ${row.isActive !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            {row.isActive !== false ? 'Deactivate' : 'Activate'}
          </button>
          {isSuperAdmin && <button onClick={() => setDeleteId(row._id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 font-medium">Delete</button>}
        </div>
      );
    }},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} users {!isSuperAdmin && '(Manager & Sales only)'}</p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Add User</Button>
      </div>

      <Table columns={columns} data={users} loading={loading} emptyMessage="No users found" />

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit User' : 'Add User'} size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Create User'}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Username *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username" required />
            <Input label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          <Input label={editItem ? "New Password (leave blank to keep)" : "Password *"} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editItem ? "Leave blank to keep current" : "Enter password"} />
          <Select label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-orange-500" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active (user can login)</label>
          </div>
        </div>
      </Modal>

      {/* Reset Password */}
      <Modal open={!!resetId} onClose={() => setResetId(null)} title="Reset Password" size="sm"
        footer={<><Button variant="ghost" onClick={() => setResetId(null)}>Cancel</Button><Button variant="primary" loading={resetting} onClick={handleResetPassword}>Reset Password</Button></>}>
        <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" required />
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete User" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Are you sure you want to delete this user? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
