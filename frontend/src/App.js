import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@/App.css';

import AuthPage from '@/pages/AuthPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import AddFoodPage from '@/pages/AddFoodPage';
import ProgressPage from '@/pages/ProgressPage';
import SettingsPage from '@/pages/SettingsPage';
import BottomNav from '@/components/BottomNav';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.onboarding_completed) return <Navigate to="/" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && user.onboarding_completed) return <Navigate to="/" replace />;
  if (user && !user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#88C425] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const showNav = user && user.onboarding_completed;

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
        <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/add-food" element={<ProtectedRoute><AddFoodPage /></ProtectedRoute>} />
        <Route path="/add-food/:mealType" element={<ProtectedRoute><AddFoodPage /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
