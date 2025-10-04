import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Menu } from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

export const Sidebar = ({ children }: { children: ReactNode }) => {
  const { isSidebarOpen, toggleSidebar, isMobile } = useLayout();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobile && isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        const isToggleButton = (e.target as HTMLElement).closest('[aria-label="Toggle sidebar"]');
        if (!isToggleButton) {
          toggleSidebar();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isSidebarOpen, toggleSidebar]);

  useEffect(() => {
    if (isMobile && isSidebarOpen) {
      const focusableElements = sidebarRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      
      if (focusableElements?.length) {
        (focusableElements[0] as HTMLElement)?.focus();
      }
    }
  }, [isMobile, isSidebarOpen]);

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`fixed top-16 left-0 bottom-0 bg-white border-r border-slate-200 z-40 w-64 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar navigation"
        aria-hidden={!isSidebarOpen}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 className="font-semibold text-slate-800">Navigation</h2>
            <button
              onClick={toggleSidebar}
              className="p-1 hover:bg-slate-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close sidebar"
            >
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </aside>

      {!isSidebarOpen && !isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed top-20 left-4 p-2 bg-white border border-slate-200 rounded-lg shadow-lg hover:bg-slate-50 transition-all duration-200 z-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open sidebar"
        >
          <Menu size={20} className="text-slate-600" />
        </button>
      )}
    </>
  );
};

export const SidebarSection = ({ title, defaultExpanded = false, children }: { title: string, defaultExpanded?: boolean, children: ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isExpanded}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>{title}</span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 mt-1' : 'max-h-0'
        }`}
      >
        <div className="space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
};
