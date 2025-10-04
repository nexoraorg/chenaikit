import React, { Suspense, ReactNode } from 'react';
import { useLayout } from '../hooks/useLayout';

export const Layout = ({ children, navigation, sidebar }: { children: ReactNode, navigation: ReactNode, sidebar: ReactNode }) => {
  const { isSidebarOpen, isMobile } = useLayout();

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="h-16 bg-slate-900" />}>
        {navigation}
      </Suspense>

      <Suspense fallback={null}>
        {sidebar}
      </Suspense>

      <main
        className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen && !isMobile ? 'ml-64' : 'ml-0'
        }`}
        role="main"
      >
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
