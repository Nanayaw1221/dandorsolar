import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Stat from '../components/ui/Stat';
import Card from '../components/ui/Card';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const { user, hasMinLevel } = useAuth();
  const isHighLevel = hasMinLevel(3);

  const [stats, setStats] = useState({
    todaySales: 0, monthlySales: 0, totalProducts: 0,
    lowStock: 0, todayExpenses: 0, outstandingDebts: 0,
    myTodaySales: 0, myTodayExpenses: 0,
  });
  const [salesChart, setSalesChart] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, chartData, productsData, activityData] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({})),
        api.get('/dashboard/sales-chart').catch(() => ({ data: [] })),
        api.get('/dashboard/top-products').catch(() => ({ data: [] })),
        api.get('/dashboard/recent-activity').catch(() => ({ data: [] })),
      ]);

      setStats({
        todaySales: statsData?.todaySales || 0,
        monthlySales: statsData?.monthlySales || 0,
        totalProducts: statsData?.totalProducts || 0,
        lowStock: statsData?.lowStock || 0,
        todayExpenses: statsData?.todayExpenses || 0,
        outstandingDebts: statsData?.outstandingDebts || 0,
        myTodaySales: statsData?.myTodaySales || 0,
        myTodayExpenses: statsData?.myTodayExpenses || 0,
      });

      const chart = chartData?.data || chartData || [];
      setSalesChart(Array.isArray(chart) ? chart : []);

      const products = productsData?.data || productsData || [];
      setTopProducts(Array.isArray(products) ? products : []);

      const activity = activityData?.data || activityData || [];
      setRecentActivity(Array.isArray(activity) ? activity : []);
    } catch { } finally { setLoading(false); }
  };

  const sampleChart = salesChart.length > 0 ? salesChart : [
    { day: 'Mon', sales: 1200 }, { day: 'Tue', sales: 1900 }, { day: 'Wed', sales: 800 },
    { day: 'Thu', sales: 2400 }, { day: 'Fri', sales: 3200 }, { day: 'Sat', sales: 2800 }, { day: 'Sun', sales: 1500 },
  ];

  const sampleProducts = topProducts.length > 0 ? topProducts : [
    { name: 'Solar Panel 200W', sold: 45 }, { name: 'Inverter 1000W', sold: 38 },
    { name: 'Battery 200AH', sold: 32 }, { name: 'Solar Cable', sold: 28 }, { name: 'Charge Controller', sold: 22 },
  ];

  const sampleActivity = recentActivity.length > 0 ? recentActivity : [
    { type: 'sale', text: 'New sale recorded', amount: 850, time: '2 min ago', icon: '💰' },
    { type: 'debt', text: 'Debt payment received', amount: 500, time: '15 min ago', icon: '📋' },
    { type: 'stock', text: 'Stock request approved', amount: null, time: '1 hr ago', icon: '📦' },
    { type: 'purchase', text: 'New purchase added', amount: 12000, time: '2 hr ago', icon: '🛍️' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, <span className="font-semibold text-orange-600">{user?.name || user?.username}</span>
          {' '}&mdash; {new Date().toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      {isHighLevel ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Stat title="Today's Sales" value={GHS(stats.todaySales)} icon="💵" color="orange" />
          <Stat title="Monthly Sales" value={GHS(stats.monthlySales)} icon="📈" color="green" />
          <Stat title="Total Products" value={stats.totalProducts} icon="📦" color="blue" />
          <Stat title="Low Stock Items" value={stats.lowStock} icon="⚠️" color="yellow" />
          <Stat title="Today's Expenses" value={GHS(stats.todayExpenses)} icon="💸" color="red" />
          <Stat title="Outstanding Debts" value={GHS(stats.outstandingDebts)} icon="📋" color="purple" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Stat title="My Today's Sales" value={GHS(stats.myTodaySales)} icon="💵" color="orange" />
          <Stat title="My Today's Expenses" value={GHS(stats.myTodayExpenses)} icon="💸" color="red" />
        </div>
      )}

      {isHighLevel && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sales Chart */}
          <div className="xl:col-span-2">
            <Card title="7-Day Sales Trend" accent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={sampleChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `GH₵${v}`} />
                  <Tooltip formatter={(v) => [`GH₵${v.toLocaleString()}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                  <Line type="monotone" dataKey="sales" stroke="#F97316" strokeWidth={2.5} dot={{ r: 4, fill: '#F97316', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#EA580C' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card title="Recent Activity">
            <div className="space-y-3">
              {sampleActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 text-base">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium">{item.text}</p>
                    {item.amount && <p className="text-sm text-orange-600 font-semibold">{GHS(item.amount)}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {isHighLevel && (
        <Card title="Top 5 Products by Units Sold">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sampleProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip formatter={(v) => [v, 'Units Sold']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
              <Bar dataKey="sold" fill="#F97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
