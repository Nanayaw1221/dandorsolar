import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/pos/POS';
import Products from './pages/products/Products';
import Categories from './pages/products/Categories';
import Suppliers from './pages/products/Suppliers';
import Purchases from './pages/purchases/Purchases';
import Expenses from './pages/expenses/Expenses';
import Debts from './pages/debts/Debts';
import WorkerPayments from './pages/workers/WorkerPayments';
import StockRequests from './pages/stock-requests/StockRequests';
import CreditAgreements from './pages/credit/CreditAgreements';
import Reports from './pages/reports/Reports';
import Financial from './pages/financial/Financial';
import UserManagement from './pages/users/UserManagement';
import Settings from './pages/settings/Settings';
import AuditLogs from './pages/audit/AuditLogs';
import Backup from './pages/backup/Backup';

const ROLE_LEVELS = { 'Sales': 1, 'Manager': 2, 'CEO': 3, 'Super Admin': 4 };

function ProtectedRoute({ children, minLevel = 1, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const level = ROLE_LEVELS[user.role] || 0;

  if (level < minLevel) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />

        <Route path="expenses" element={
          <ProtectedRoute minLevel={1}>
            <Expenses />
          </ProtectedRoute>
        } />

        <Route path="debts" element={
          <ProtectedRoute minLevel={2}>
            <Debts />
          </ProtectedRoute>
        } />

        <Route path="stock-requests" element={
          <ProtectedRoute minLevel={2}>
            <StockRequests />
          </ProtectedRoute>
        } />

        <Route path="credit-agreements" element={
          <ProtectedRoute minLevel={2}>
            <CreditAgreements />
          </ProtectedRoute>
        } />

        <Route path="products" element={
          <ProtectedRoute minLevel={3}>
            <Products />
          </ProtectedRoute>
        } />

        <Route path="categories" element={
          <ProtectedRoute minLevel={3}>
            <Categories />
          </ProtectedRoute>
        } />

        <Route path="suppliers" element={
          <ProtectedRoute minLevel={3}>
            <Suppliers />
          </ProtectedRoute>
        } />

        <Route path="purchases" element={
          <ProtectedRoute minLevel={3}>
            <Purchases />
          </ProtectedRoute>
        } />

        <Route path="worker-payments" element={
          <ProtectedRoute minLevel={3}>
            <WorkerPayments />
          </ProtectedRoute>
        } />

        <Route path="reports" element={
          <ProtectedRoute minLevel={3}>
            <Reports />
          </ProtectedRoute>
        } />

        <Route path="financial" element={
          <ProtectedRoute minLevel={3}>
            <Financial />
          </ProtectedRoute>
        } />

        <Route path="users" element={
          <ProtectedRoute minLevel={3}>
            <UserManagement />
          </ProtectedRoute>
        } />

        <Route path="audit-logs" element={
          <ProtectedRoute minLevel={3}>
            <AuditLogs />
          </ProtectedRoute>
        } />

        <Route path="backup" element={
          <ProtectedRoute minLevel={3}>
            <Backup />
          </ProtectedRoute>
        } />

        <Route path="settings" element={
          <ProtectedRoute minLevel={4}>
            <Settings />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', fontSize: '14px' },
            success: {
              style: { background: '#10B981', color: 'white' },
              iconTheme: { primary: 'white', secondary: '#10B981' },
            },
            error: {
              style: { background: '#EF4444', color: 'white' },
              iconTheme: { primary: 'white', secondary: '#EF4444' },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
