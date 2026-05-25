import { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function Reports() {
  const [activeReport, setActiveReport] = useState('daily-sales');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { fetchReport(); }, [activeReport, dateRange]);

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      const params = `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      const result = await api.get(`/reports/${activeReport}${params}`);
      setData(result);
    } catch (err) {
      // Show empty state
    } finally { setLoading(false); }
  };

  const downloadCSV = (rows, filename) => {
    if (!rows || rows.length === 0) { toast.error('No data to export'); return; }
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    { id: 'daily-sales', label: 'Daily Sales', icon: '📅' },
    { id: 'pl-statement', label: 'P&L Statement', icon: '💹' },
    { id: 'debtors', label: 'Debtors Report', icon: '📋' },
    { id: 'stock-valuation', label: 'Stock Valuation', icon: '📦' },
    { id: 'top-products', label: 'Top Products', icon: '🏆' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Business intelligence and financial reports</p>
      </div>

      {/* Report Selector */}
      <div className="flex flex-wrap gap-2">
        {reports.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeReport === r.id ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50 hover:text-orange-600'}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={dateRange.startDate} onChange={e => setDateRange(d => ({ ...d, startDate: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={dateRange.endDate} onChange={e => setDateRange(d => ({ ...d, endDate: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <Button variant="primary" size="md" onClick={fetchReport}>Generate</Button>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Daily Sales */}
          {activeReport === 'daily-sales' && (
            <Card title="Daily Sales Report" action={
              <Button variant="secondary" size="sm" onClick={() => downloadCSV(data?.sales || [], 'daily-sales.csv')}>⬇ CSV</Button>
            }>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Sales</p>
                  <p className="text-xl font-black text-orange-600">{GHS(data?.totalSales || 0)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-xl font-black text-green-600">{data?.transactionCount || 0}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Avg. Sale</p>
                  <p className="text-xl font-black text-blue-600">{GHS(data?.averageSale || 0)}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-orange-500 text-white"><th className="text-left px-3 py-2">Salesperson</th><th className="text-right px-3 py-2">Transactions</th><th className="text-right px-3 py-2">Total Sales</th></tr></thead>
                <tbody>
                  {(data?.byUser || []).map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2 font-medium">{row.name || row.username}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600">{GHS(row.total)}</td>
                    </tr>
                  ))}
                  {(!data?.byUser || data.byUser.length === 0) && (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-400">No sales data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {/* P&L Statement */}
          {activeReport === 'pl-statement' && (
            <Card title="Profit & Loss Statement" action={
              <Button variant="secondary" size="sm" onClick={() => downloadCSV([data || {}], 'pl-statement.csv')}>⬇ CSV</Button>
            }>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 pb-1 border-b">Revenue</h4>
                  <div className="flex justify-between py-2"><span>Gross Sales</span><span className="font-semibold">{GHS(data?.grossSales)}</span></div>
                  <div className="flex justify-between py-2 text-red-500"><span>Sales Discounts</span><span>-{GHS(data?.discounts)}</span></div>
                  <div className="flex justify-between py-2 font-bold border-t"><span>Net Revenue</span><span className="text-green-600">{GHS(data?.netRevenue)}</span></div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 pb-1 border-b">Cost of Goods Sold</h4>
                  <div className="flex justify-between py-2"><span>Cost of Sales</span><span className="font-semibold text-red-600">-{GHS(data?.cogs)}</span></div>
                  <div className="flex justify-between py-2 font-bold border-t"><span>Gross Profit</span><span className={data?.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{GHS(data?.grossProfit)}</span></div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 pb-1 border-b">Operating Expenses</h4>
                  {(data?.expenses || []).map((exp, i) => (
                    <div key={i} className="flex justify-between py-1.5"><span className="text-gray-600">{exp.category}</span><span className="text-red-500">-{GHS(exp.total)}</span></div>
                  ))}
                  <div className="flex justify-between py-2 font-bold border-t"><span>Total Expenses</span><span className="text-red-600">-{GHS(data?.totalExpenses)}</span></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between font-black text-lg">
                    <span>Net Profit</span>
                    <span className={data?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{GHS(data?.netProfit)}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Debtors */}
          {activeReport === 'debtors' && (
            <Card title="Debtors Report" action={
              <Button variant="secondary" size="sm" onClick={() => downloadCSV(data?.debtors || [], 'debtors.csv')}>⬇ CSV</Button>
            }>
              <table className="w-full text-sm">
                <thead><tr className="bg-orange-500 text-white"><th className="text-left px-3 py-2">Customer</th><th className="text-right px-3 py-2">Phone</th><th className="text-right px-3 py-2">Total Owed</th><th className="text-right px-3 py-2">Paid</th><th className="text-right px-3 py-2">Remaining</th><th className="text-right px-3 py-2">Due Date</th></tr></thead>
                <tbody>
                  {(data?.debtors || []).map((d, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2 font-medium">{d.customerName}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{d.customerPhone}</td>
                      <td className="px-3 py-2 text-right">{GHS(d.totalAmount)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{GHS(d.amountPaid)}</td>
                      <td className="px-3 py-2 text-right font-bold text-red-600">{GHS(d.remaining)}</td>
                      <td className="px-3 py-2 text-right">{d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {(!data?.debtors || data.debtors.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No active debtors</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {/* Stock Valuation */}
          {activeReport === 'stock-valuation' && (
            <Card title="Stock Valuation Report" action={
              <Button variant="secondary" size="sm" onClick={() => downloadCSV(data?.products || [], 'stock-valuation.csv')}>⬇ CSV</Button>
            }>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Cost Value</p>
                  <p className="text-xl font-black text-blue-600">{GHS(data?.totalCostValue)}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Selling Value</p>
                  <p className="text-xl font-black text-orange-600">{GHS(data?.totalSellingValue)}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-orange-500 text-white"><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Stock</th><th className="text-right px-3 py-2">Cost/Unit</th><th className="text-right px-3 py-2">Sell/Unit</th><th className="text-right px-3 py-2">Cost Value</th><th className="text-right px-3 py-2">Sell Value</th></tr></thead>
                <tbody>
                  {(data?.products || []).map((p, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-right"><Badge variant={p.quantity <= 5 ? 'error' : p.quantity <= 10 ? 'warning' : 'success'}>{p.quantity}</Badge></td>
                      <td className="px-3 py-2 text-right">{GHS(p.costPrice)}</td>
                      <td className="px-3 py-2 text-right">{GHS(p.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right">{GHS(p.quantity * p.costPrice)}</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600">{GHS(p.quantity * p.sellingPrice)}</td>
                    </tr>
                  ))}
                  {(!data?.products || data.products.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No stock data available</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {/* Top Products */}
          {activeReport === 'top-products' && (
            <Card title="Top Products by Sales" action={
              <Button variant="secondary" size="sm" onClick={() => downloadCSV(data?.products || [], 'top-products.csv')}>⬇ CSV</Button>
            }>
              {data?.products && data.products.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.products.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `GH₵${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [GHS(v), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#F97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-400">No sales data for this period</div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
