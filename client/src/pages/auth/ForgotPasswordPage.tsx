import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { forgotPasswordApi } from '../../api/authApi';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your account email address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await forgotPasswordApi({ email });
      setIsSubmitted(true);
      if (res.devResetToken) {
        setDevResetToken(res.devResetToken);
      }
      toast.success('Password recovery token generated.', 'Recovery Dispatched');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process password recovery request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Reset Your Password
        </h1>
        <p className="text-xs text-slate-500">
          Enter your registered email to receive secure recovery instructions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password Recovery</CardTitle>
          <CardDescription>
            Cryptographic one-time token authorization
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isSubmitted ? (
            <div className="space-y-4 text-center py-4">
              <div className="h-12 w-12 rounded-full bg-vitality-50 text-vitality-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Recovery Instructions Dispatched</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If an account exists for <strong>{email}</strong>, recovery instructions have been prepared.
                </p>
              </div>

              {devResetToken && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                  <p className="font-semibold text-slate-700">Development Mode Token:</p>
                  <code className="block p-2 bg-white rounded border border-slate-200 text-[11px] font-mono break-all text-clinical-700">
                    {devResetToken}
                  </code>
                  <Link to={`/reset-password?token=${devResetToken}`}>
                    <Button size="sm" variant="clinical" fullWidth className="mt-1">
                      Proceed to Reset Password
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-emergency-50 border border-emergency-200 text-xs text-emergency-700">
                  {error}
                </div>
              )}

              <Input
                label="Registered Email Address"
                type="email"
                placeholder="doctor@hospital.org"
                leftIcon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Send Recovery Instructions
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center bg-slate-50/80 p-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};
