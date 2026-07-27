import React from 'react';
import Header from '@/components/layout/Header.jsx';
import Sidebar from '@/components/layout/Sidebar.jsx';

const MainLayout = ({ children }) => (
  <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
    <Sidebar />
    <div className="flex flex-col flex-1 min-w-0">
      <Header />
      <main
        className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin animate-fade-in"
        id="main-content"
        role="main"
        aria-label="Main content"
      >
        <div className="mx-auto max-w-7xl space-y-0">
          {children}
        </div>
      </main>
    </div>
  </div>
);

export default MainLayout;
