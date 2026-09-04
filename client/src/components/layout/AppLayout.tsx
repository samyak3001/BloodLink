import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { EmergencyAlertToast } from '../notifications/EmergencyAlertToast';

export interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showSidebar = false,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-emergency-100 selection:text-emergency-900">
      {/* Top Navbar */}
      <Navbar
        showSidebarToggle={showSidebar}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Optional Dashboard Sidebar */}
        {showSidebar && (
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div className="space-y-8 flex-1">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <Footer />

      {/* Global Real-Time Emergency Socket Toast */}
      <EmergencyAlertToast />
    </div>
  );
};
