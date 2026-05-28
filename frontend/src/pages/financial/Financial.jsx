import { useState, useEffect } from 'react';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function Financial() {
  const [activeTab, setActiveTab] = useState('balance-sheet');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await api.get(`/financial/${activeTab}`);
      setData(result?.data || result);
    } catch {
      setData(null);
    } finally { setLoading(false); }
  };

  const tabs = [
    { id: 'balance-sheet', label: 'Balance Sheet', icon: '⚖️' },
    { id: 'cash-flow', label: 'Cash Flow', icon: '💧' },
    { id: 'trial-balance', label: 'Trial Balance', icon: '📊' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Statements</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button variant="secondary" onClick={window.print}>🖨️ Print</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'balance-sheet' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Assets" accent>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Current Assets</p>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Cash & Cash Equivalents</span><span className="font-medium">{GHS(data?.cash)}</span></div>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Accounts Receivable (Debts)</span><span className="font-medium">{GHS(data?.receivables)}</span></div>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Inventory (Stock Value)</span><span className="font-medium">{GHS(data?.inventory)}</span></div>
                  <div className="flex justify-between py-2 text-sm font-bold border-t border-gray-200 mt-2"><span>Total Current Assets</span><span className="text-green-600">{GHS((data?.cash || 0) + (data?.receivables || 0) + (data?.inventory || 0))}</span></div>
                </div>
              </Card>

              <Card title="Liabilities & Equity" accent>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Liabilities</p>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Accounts Payable</span><span className="font-medium text-red-600">{GHS(data?.payables)}</span></div>
                  <div className="flex justify-between py-2 text-sm font-bold border-t border-gray-200 mt-2"><span>Total Liabilities</span><span className="text-red-600">{GHS(data?.payables)}</span></div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Equity</p>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Retained Earnings</span><span className="font-medium">{GHS(data?.equity)}</span></div>
                  <div className="flex justify-between py-2 text-sm font-bold border-t border-gray-200 mt-2"><span>Total L & E</span><span className="text-blue-600">{GHS((data?.payables || 0) + (data?.equity || 0))}</span></div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'cash-flow' && (
            <Card title="Cash Flow Statement" accent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Operating Activities</h4>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Cash from Sales</span><span className="text-green-600 font-medium">+{GHS(data?.salesCash)}</span></div>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Cash Paid for Expenses</span><span className="text-red-500 font-medium">-{GHS(data?.expensesCash)}</span></div>
                  <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">Cash Paid for Purchases</span><span className="text-red-500 font-medium">-{GHS(data?.purchasesCash)}</span></div>
                  <div className="flex justify-between py-2 font-bold border-t mt-2 text-sm"><span>Net Operating Cash Flow</span><span className={data?.operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>{GHS(data?.operatingCashFlow)}</span></div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex justify-between text-lg font-black"><span>Net Cash Flow</span><span className={data?.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>{GHS(data?.netCashFlow)}</span></div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'trial-balance' && (
            <Card title="Trial Balance" accent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-orange-500 text-white">
                    <th className="text-left px-4 py-2.5">Account</th>
                    <th className="text-right px-4 py-2.5">Debit</th>
                    <th className="text-right px-4 py-2.5">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.entries || [
                    { account: 'Sales Revenue', debit: 0, credit: data?.totalSales || 0 },
                    { account: 'Cost of Goods Sold', debit: data?.totalCOGS || 0, credit: 0 },
                    { account: 'Operating Expenses', debit: data?.totalExpenses || 0, credit: 0 },
                    { account: 'Inventory', debit: data?.inventoryValue || 0, credit: 0 },
                    { account: 'Accounts Receivable', debit: data?.receivables || 0, credit: 0 },
                  ]).map((e, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2">{e.account}</td>
                      <td className="px-4 py-2 text-right">{e.debit > 0 ? GHS(e.debit) : '—'}</td>
                      <td className="px-4 py-2 text-right">{e.credit > 0 ? GHS(e.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-4 py-2">TOTALS</td>
                    <td className="px-4 py-2 text-right text-orange-600">{GHS(data?.totalDebit)}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{GHS(data?.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
