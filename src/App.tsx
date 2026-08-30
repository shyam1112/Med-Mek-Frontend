import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import Layout from './components/layout/Layout';
import { Box, CircularProgress } from '@mui/material';

// Auth pages
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminPanel from './pages/admin/AdminPanel';

// App pages
import Dashboard from './pages/dashboard/Dashboard';
import MedicineList from './pages/medicines/MedicineList';
import MedicineForm from './pages/medicines/MedicineForm';
import Inventory from './pages/inventory/Inventory';
import SupplierList from './pages/suppliers/SupplierList';
import PurchaseList from './pages/purchases/PurchaseList';
import CustomerList from './pages/customers/CustomerList';
import DoctorList from './pages/doctors/DoctorList';
import Billing from './pages/billing/Billing';
import SalesList from './pages/sales/SalesList';
import ExpiryAlerts from './pages/expiry/ExpiryAlerts';
import Reports from './pages/reports/Reports';
import Profile from './pages/profile/Profile';

const Spinner = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

// Protected route for pharmacy users (must be approved)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Protected route for super admin
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, adminLoading } = useAdminAuth();
  if (adminLoading) return <Spinner />;
  if (!admin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const { admin, adminLoading } = useAdminAuth();

  if (loading || adminLoading) return <Spinner />;

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Admin routes */}
      <Route path="/admin" element={admin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminPanel /></AdminRoute>} />

      {/* Pharmacy app routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="medicines" element={<MedicineList />} />
        <Route path="medicines/new" element={<MedicineForm />} />
        <Route path="medicines/:id/edit" element={<MedicineForm />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="purchases" element={<PurchaseList />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="doctors" element={<DoctorList />} />
        <Route path="billing" element={<Billing />} />
        <Route path="sales" element={<SalesList />} />
        <Route path="expiry" element={<ExpiryAlerts />} />
        <Route path="reports/:type" element={<Reports />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={3500}
      >
        <BrowserRouter>
          <AuthProvider>
            <AdminAuthProvider>
              <AppRoutes />
            </AdminAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
