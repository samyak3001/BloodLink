import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeartPulse, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ConnectionStatus } from '../shared/ConnectionStatus';
import { NotificationBell } from '../notifications/NotificationBell';
import { Button } from '../ui/Button';

interface NavbarProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  showSidebarToggle = false,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Platform Home', path: '/' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'System Overview', path: '/#overview' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-soft-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Sidebar Toggle + Brand */}
        <div className="flex items-center space-x-3">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 md:hidden"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-emergency-600 flex items-center justify-center text-white shadow-soft group-hover:scale-105 transition-transform">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Blood<span className="text-emergency-600">Link</span>
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emergency-50 text-emergency-700 border border-emergency-200 uppercase tracking-wider">
                Emergency Engine
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                location.pathname === link.path
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Controls & User Menu */}
        <div className="flex items-center space-x-2.5">
          <ConnectionStatus />
          <NotificationBell />

          {user ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                  {user.name}
                </span>
                <span className="text-[10px] font-semibold text-clinical-600 uppercase tracking-wider">
                  {user.role}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                title="Sign out"
                className="text-slate-500 hover:text-emergency-600 p-2"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile menu hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
          {!user && (
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" fullWidth>
                  Sign In
                </Button>
              </Link>
              <Link to="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" fullWidth>
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
