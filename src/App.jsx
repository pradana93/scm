import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Shipments from '@/pages/Shipments';
import Admin from '@/pages/Admin';
import Report from '@/pages/Report';
import SuperAdmin from '@/pages/SuperAdmin';
import Stock from '@/pages/Stock';
import Production from '@/pages/Production';
import Penerimaan from '@/pages/Penerimaan';
import AppLayout from '@/components/shipping/AppLayout';
import FeatureRoute from '@/components/FeatureRoute';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<FeatureRoute featureKey="dashboard"><Dashboard /></FeatureRoute>} />
          <Route path="/pengiriman" element={<FeatureRoute featureKey="pengiriman"><Shipments /></FeatureRoute>} />
          <Route path="/admin" element={<FeatureRoute featureKey="master_data"><Admin /></FeatureRoute>} />
          <Route path="/produksi" element={<FeatureRoute featureKey="production"><Production /></FeatureRoute>} />
          <Route path="/penerimaan" element={<FeatureRoute featureKey="penerimaan"><Penerimaan /></FeatureRoute>} />
          <Route path="/report" element={<FeatureRoute featureKey="report"><Report /></FeatureRoute>} />
          <Route path="/stok" element={<FeatureRoute featureKey="stock"><Stock /></FeatureRoute>} />
          <Route path="/super-admin" element={<SuperAdmin />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App