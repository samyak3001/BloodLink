import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  History,
  FilePlus2,
  Users,
  Bell,
  Settings,
  Shield,
  Activity,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, className }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Role-specific links
  const getNavLinks = () => {
    if (!user) {
      return [
        { label: 'Platform Home', path: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
      ];
    }

    if (user.role === 'DONOR') {
      return [
        { label: 'Donor Dashboard', path: '/donor/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Emergency Requests', path: '/donor/requests', icon: <Activity className="h-4 w-4" /> },
        { label: 'Donation History', path: '/donor/history', icon: <History className="h-4 w-4" /> },
        { label: 'My Notifications', path: '/donor/notifications', icon: <Bell className="h-4 w-4" /> },
        { label: 'Donor Profile', path: '/donor/profile', icon: <Building2 className="h-4 w-4" /> },
        { label: 'Settings & Privacy', path: '/settings', icon: <Shield className="h-4 w-4" /> },
      ];
    }

    if (user.role === 'HOSPITAL') {
      return [
        { label: 'Hospital Dashboard', path: '/hospital/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'New Emergency Request', path: '/hospital/requests/new', icon: <FilePlus2 className="h-4 w-4" /> },
        { label: 'Active Requests', path: '/hospital/requests', icon: <Activity className="h-4 w-4" /> },
        { label: 'Hospital Notifications', path: '/hospital/notifications', icon: <Bell className="h-4 w-4" /> },
        { label: 'Hospital Profile', path: '/hospital/profile', icon: <Building2 className="h-4 w-4" /> },
        { label: 'Settings & Privacy', path: '/settings', icon: <Settings className="h-4 w-4" /> },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        { label: 'Admin Analytics', path: '/admin/analytics', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Emergency Requests', path: '/admin/requests', icon: <Activity className="h-4 w-4" /> },
        { label: 'User Directory', path: '/admin/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Hospital Verification', path: '/admin/hospitals', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: <History className="h-4 w-4" /> },
        { label: 'Settings & Privacy', path: '/settings', icon: <Settings className="h-4 w-4" /> },
      ];
    }

    return [];
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-150"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed md:static top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="p-4 flex flex-col h-full">
          {/* Mobile Close Header */}
          <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-100 md:hidden">
            <span className="text-sm font-bold text-slate-800">Navigation Menu</span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Info Capsule */}
          {user && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100/80 flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-clinical-100 text-clinical-700 flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {user.role} Account
                </p>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={cn(
                    'flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-clinical-50 text-clinical-700 shadow-soft-sm font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <span className={isActive ? 'text-clinical-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 font-medium">
            BloodLink Emergency v1.0
          </p>
        </div>
      </aside>
    </>
  );
};
