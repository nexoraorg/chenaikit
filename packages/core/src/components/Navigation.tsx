import React, { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

export const Navigation = ({ children }: { children: ReactNode }) => {
  const { isMobileMenuOpen, toggleMobileMenu } = useLayout();

  return (
    <nav className="bg-slate-900 text-white fixed top-0 left-0 right-0 z-50 shadow-lg">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          {children}
        </div>
      </div>

      <div
        className={`lg:hidden bg-slate-800 overflow-hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen' : 'max-h-0'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="px-4 py-2 space-y-1">
          <a href="#docs" className="block py-2 px-3 hover:bg-slate-700 rounded-lg transition-colors">Documentation</a>
          <a href="#api" className="block py-2 px-3 hover:bg-slate-700 rounded-lg transition-colors">API Reference</a>
          <a href="#examples" className="block py-2 px-3 hover:bg-slate-700 rounded-lg transition-colors">Examples</a>
          <a href="https://github.com" className="block py-2 px-3 hover:bg-slate-700 rounded-lg transition-colors">GitHub</a>
        </div>
      </div>
    </nav>
  );
};
