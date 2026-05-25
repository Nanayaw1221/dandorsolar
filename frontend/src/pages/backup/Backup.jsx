import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchBackups(); }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await api.get('/backups');
      setBackups(data?.backups || data || []);
    } catch { setBackups([]); } finally { setLoading(false); }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const result = await api.post('/backups/create');
      // If API returns data, download it
      if (result?.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Backup created successfully');
      fetchBackups();
    } catch (err) {
      toast.error(err?.message || 'Failed to create backup');
    } finally { setCreating(false); }
  };

  const downloadBackup = async (backup) => {
    try {
      const result = await api.get(`/backups/${backup._id}/download`);
      if (result) {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${backup.filename || backup._id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup downloaded');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to download backup');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-sm text-gray-500 mt-1">Manage system backups</p>
        </div>
        <Button variant="primary" loading={creating} onClick={handleCreateBackup}>
          💾 Create Backup
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">ℹ️</span>
        <div>
          <p className="font-semibold text-blue-800">About Backups</p>
          <p className="text-sm text-blue-700 mt-1">
            Backups export all data (products, sales, expenses, debts, users) as a JSON file.
            Store backups securely. To restore, contact your system administrator.
          </p>
        </div>
      </div>

      {/* Backup History */}
      <Card title="Backup History">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💾</p>
            <p className="text-gray-500">No backups created yet.</p>
            <p className="text-sm text-gray-400 mt-1">Click "Create Backup" to make your first backup.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup, i) => (
              <div key={backup._id || i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-orange-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-xl">💾</div>
                  <div>
                    <p className="font-medium text-gray-900">{backup.filename || `backup_${i + 1}.json`}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : '—'}</span>
                      {backup.size && <span className="text-xs text-gray-400">{formatSize(backup.size)}</span>}
                      {backup.createdBy && <span className="text-xs text-gray-400">by {backup.createdBy.name || backup.createdBy.username}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Complete</Badge>
                  <button onClick={() => downloadBackup(backup)} className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium transition-colors">
                    ⬇ Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
