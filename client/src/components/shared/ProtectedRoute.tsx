import React, { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  fallbackUrl?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-clinical-600" />
        <p className="text-xs text-slate-500 font-medium">Verifying authorization...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white border border-slate-200 rounded-2xl shadow-soft text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-emergency-50 text-emergency-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Authentication Required</h2>
        <p className="text-xs text-slate-600">
          You must be signed in with a verified account to access this section of BloodLink.
        </p>
        <Link to="/login" className="inline-block px-4 py-2 bg-clinical-600 hover:bg-clinical-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-soft">
          Sign In
        </Link>
      </div>
    );
  }

  // Role check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white border border-slate-200 rounded-2xl shadow-soft text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600">
          Your account role (<span className="font-semibold">{user.role}</span>) does not have
          permission to view this resource. Requires: {allowedRoles.join(' or ')}.
        </p>
        <Link to="/" className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors shadow-soft">
          Return to Platform Home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
