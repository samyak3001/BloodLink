import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setError('Please enter both administrator email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await login({ email: trimmedEmail, password });

      if (user && user.role !== 'ADMIN') {
        logout();
        setError('Access denied. This portal is strictly restricted to platform administrators.');
        toast.error('Unauthorized access attempt. Administrator credentials required.', 'Access Denied');
        return;
      }

      toast.success('Welcome back, Administrator.', 'Session Authenticated');
      navigate('/admin/analytics');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid administrator email or password.';
      setError(message);
      toast.error(message, 'Authentication Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-soft">
          <ShieldCheck className="h-6 w-6 text-emergency-500" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emergency-600">BloodLink</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrator Portal</h1>
        </div>
        <p className="text-xs text-slate-500">
          Authorized administrators only. All access is logged and audited.
        </p>
      </div>

      <Card className="border-slate-300 shadow-soft-md">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-base text-slate-900">Administrator Sign In</CardTitle>
          <CardDescription>
            Secure access to verification, user management, and platform analytics
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-emergency-50 border border-emergency-200 text-xs text-emergency-700 font-medium leading-relaxed">
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="admin@bloodlink.org"
              leftIcon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isLoading}
              leftIcon={<LogIn className="h-4 w-4" />}
              className="bg-slate-900 hover:bg-slate-800 text-white focus-visible:ring-slate-900"
            >
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center text-[11px] text-slate-400">
        Need donor or hospital login?{' '}
        <Link to="/login" className="font-semibold text-slate-600 hover:text-slate-900">
          Public Sign In
        </Link>
      </div>
    </div>
  );
};
