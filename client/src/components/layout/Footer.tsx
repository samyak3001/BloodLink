import React from 'react';
import { HeartPulse, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 rounded-lg bg-emergency-600 flex items-center justify-center text-white">
                <HeartPulse className="h-4 w-4" />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                Blood<span className="text-emergency-600">Link</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Real-time emergency blood donor & hospital matching platform bridging medical facilities with eligible local donors when every second counts.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Platform
            </h5>
            <ul className="space-y-1.5 text-xs text-slate-500">
              <li>
                <Link to="/" className="hover:text-clinical-600 transition-colors">
                  System Overview
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-clinical-600 transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-clinical-600 transition-colors">
                  Register as Donor / Hospital
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Disclaimer Notice */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Medical Disclaimer
            </h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              BloodLink is strictly an emergency coordination engine. Donor screening is self-reported; final medical eligibility and cross-matching are conducted exclusively on-site by certified healthcare professionals.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} BloodLink Platform. Built for Production Healthcare Coordination.</p>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              Emergency Ready
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
