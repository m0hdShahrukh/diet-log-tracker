import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Leaf, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (regForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(regForm.name, regForm.email, regForm.password);
      toast.success('Account created!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] justify-center align-middle flex-col" data-testid="auth-page">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#88C425] to-[#76AD1B] flex items-center justify-center mb-6 shadow-lg">
          <Leaf className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          DietLog
        </h1>
        <p className="text-slate-500 text-base font-medium text-center max-w-xs">
          Track your meals, hit your goals, and feel your best every day.
        </p>
      </div>

      {/* Auth Forms */}
      <div className="px-6 pb-10 max-w-md mx-auto w-full">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full bg-slate-100 rounded-2xl h-12 p-1">
            <TabsTrigger
              value="login"
              data-testid="login-tab"
              className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold text-sm"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="register"
              data-testid="register-tab"
              className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold text-sm"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6 animate-slide-up">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Email</Label>
                <Input
                  data-testid="login-email"
                  type="email"
                  placeholder="you@email.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Password</Label>
                <Input
                  data-testid="login-password"
                  type="password"
                  placeholder="Enter password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <Button
                data-testid="login-submit"
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-6 animate-slide-up">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Name</Label>
                <Input
                  data-testid="register-name"
                  placeholder="Your name"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Email</Label>
                <Input
                  data-testid="register-email"
                  type="email"
                  placeholder="you@email.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Password</Label>
                <Input
                  data-testid="register-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-sm mb-1.5 block">Confirm Password</Label>
                <Input
                  data-testid="register-confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={regForm.confirmPassword}
                  onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                  className="h-12 rounded-xl bg-white border-slate-200 focus:ring-2 focus:ring-[#88C425]/30"
                  required
                />
              </div>
              <Button
                data-testid="register-submit"
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                {loading ? 'Creating account...' : 'Create Account'}
                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
