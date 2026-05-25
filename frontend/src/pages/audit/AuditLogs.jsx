import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';

const actionVariant = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'error',
  LOGIN: 'orange', LOGOUT: 'default', VIEW: 'default',
};

export default function AuditLogs() {
  const { user, hasMinLevel } = useAuth();
  const isSuperAdmin = hasMinLevel(4);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user: '', action: '', module: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { fetchLogs(); }, [filters, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
      if (filters.user) params.append('user', filters.user);
      if (filters.action) params.append('action', filters.action);
      if (filters.module) params.append('module', filters.module);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      const data = await api.get(`/audit-logs?${params}`);
      let list = data?.logs || data?.data || data || [];
      // CEO sees all except Super Admin actions
      if (!isSuperAdmin) {
        list = list.filter(l => l.userRole !== 'Super Admin');
      }
      setLogs(list);
      setTotal(data?.total || list.length);
    } catch { setLogs([]); } finally { setLoading(false); }
  };

  const modules = ['Sales', 'Products', 'Expenses', 'Debts', 'Users', 'Settings', 'Auth', 'Purchases', 'Stock Requests', 'Credit'];
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW'];

  const columns = [
    { key: 'createdAt', header: 'Timestamp', render: v => v ? (
      <div>
        <p className="text-xs font-medium text-gray-900">{new Date(v).toLocaleDateString('en-GH')}</p>
        <p className="text-xs text-gray-400">{new Date(v).toLocaleTimeString()}</p>
      </div>
    ) : '—' },
    { key: 'user', header: 'User', render: (v, row) => (
      <div>
        <p className="text-sm font-medium text-gray-900">{v?.name || v?.username || row.username || '—'}</p>
        <p className="text-xs text-gray-400">{row.userRole}</p>
      </div>
    )},
    { key: 'action', header: 'Action', render: v => <Badge variant={actionVariant[v] || 'default'}>{v}</Badge> },
    { key: 'module', header: 'Module', render: v => <span className="text-xs font-medium text-gray-600">{v}</span> },
    { key: 'description', header: 'Description', render: v => <span className="text-xs text-gray-500 max-w-[300px] block truncate">{v || '—'}</span> },
    { key: 'ipAddress', header: 'IP Address', render: v => <span className="font-mono text-xs text-gray-400">{v || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">{total} log entries {!isSuperAdmin && '(excluding Super Admin actions)'}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            value={filters.user}
            onChange={e => { setFilters(f => ({ ...f, user: e.target.value })); setPage(1); }}
            placeholder="Search user..."
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filters.module} onChange={e => { setFilters(f => ({ ...f, module: e.target.value })); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="date" value={filters.startDate} onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <input type="date" value={filters.endDate} onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div className="mt-2">
          <button onClick={() => { setFilters({ user: '', action: '', module: '', startDate: '', endDate: '' }); setPage(1); }}
            className="text-sm text-gray-500 hover:text-orange-600 transition-colors">
            Clear filters
          </button>
        </div>
      </div>

      <Table columns={columns} data={logs} loading={loading} emptyMessage="No audit logs found" />

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)} - {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
            <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
