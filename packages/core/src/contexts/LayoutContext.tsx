import React, { createContext, useState, useEffect, ReactNode } from 'react';

export interface LayoutContextType {
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const LayoutContext = createContext<LayoutContextType | null>(null);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const savedState = (window as any).layoutState || {};
    if (savedState.isSidebarOpen !== undefined) {
      setIsSidebarOpen(savedState.isSidebarOpen);
    }

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    (window as any).layoutState = { isSidebarOpen };
  }, [isSidebarOpen]);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <LayoutContext.Provider value={{
      isSidebarOpen,
      isMobileMenuOpen,
      isMobile,
      toggleSidebar,
      toggleMobileMenu,
      closeMobileMenu
    }}>
      {children}
    </LayoutContext.Provider>
  );
};
