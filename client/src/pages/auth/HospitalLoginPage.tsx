import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Building2, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';

export const HospitalLoginPage: React.FC = () => {
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

    if (!email.trim() || !password.trim()) {
      setError('Please enter both facility email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await login({ email: email.trim(), password });

      if (user && user.role !== 'HOSPITAL') {
        logout();
        setError('This portal is reserved for verified hospital facilities. Donors should sign in through the donor portal.');
        toast.error('Access restricted to hospital healthcare facilities.', 'Role Restriction');
        return;
      }

      toast.success('Hospital verified. Welcome to BloodLink emergency network!', 'Authentication Successful');
      navigate('/hospital/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid hospital email or password.';
      setError(message);
      toast.error(message, 'Authentication Error');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Account Auto-Fill for verified hospitals
  const fillDemoAccount = (demoEmail: string, demoLabel: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);
    toast.info(`Hospital credentials for ${demoLabel} populated. Click "Sign In" to proceed.`, 'Demo Auto-Fill');
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-clinical-600 text-white flex items-center justify-center mx-auto shadow-soft">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hospital Sign In</h1>
        <p className="text-xs text-slate-500">
          Enter your authorized credentials to access your facility portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Healthcare Facility Portal</CardTitle>
          <CardDescription>Verified facilities can dispatch and track real-time emergency requests</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-emergency-50 border border-emergency-200 text-xs text-emergency-700 font-medium leading-relaxed">
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="facility@hospital.org"
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
                  className="text-xs font-semibold text-clinical-600 hover:text-clinical-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Sign In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 bg-slate-50/80 p-4">
          <div className="w-full text-center text-xs text-slate-500">
            Don't have a hospital account?{' '}
            <Link to="/register?role=HOSPITAL" className="font-bold text-clinical-600 hover:text-clinical-700">
              Register here
            </Link>
          </div>

          {/* Quick Demo Hospital Credentials */}
          <div className="w-full pt-2 border-t border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Hospital Demo Credentials
              </span>
              <span className="text-[10px] text-slate-400">One-click fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillDemoAccount('metro.hospital@bloodlink.org', 'Metro General Hospital')}
                className="text-[11px] py-1.5"
                leftIcon={<Building2 className="h-3 w-3 text-clinical-600" />}
              >
                Metro Hospital
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillDemoAccount('city.care@bloodlink.org', 'City Care Clinic')}
                className="text-[11px] py-1.5"
                leftIcon={<Building2 className="h-3 w-3 text-clinical-600" />}
              >
                City Care
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
