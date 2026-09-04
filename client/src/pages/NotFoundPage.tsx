import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <div className="h-16 w-16 rounded-3xl bg-emergency-50 text-emergency-600 flex items-center justify-center mx-auto shadow-soft">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404 — Page Not Found</h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          The requested emergency resource, dashboard, or endpoint does not exist or has been moved.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/">
          <Button variant="primary" leftIcon={<Home className="h-4 w-4" />}>
            Return to BloodLink Home
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
};
