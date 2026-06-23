import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  loadPreferences,
  savePreferences,
  clearPreferences,
  type UserPreferences,
} from '../utils/persistence';
import { storageClear } from '../utils/storage';

interface PersistenceContextType {
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  clearAllData: () => void;
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const PersistenceContext = createContext<PersistenceContextType | undefined>(undefined);

export const PersistenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...partial };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const clearAllData = useCallback(() => {
    clearPreferences();
    storageClear('local');
    storageClear('session');
    setPreferences({});
  }, []);

  const handleAddRecentSearch = useCallback((term: string) => {
    setPreferences((prev) => {
      const searches = prev.recentSearches ?? [];
      const filtered = searches.filter((s) => s !== term);
      const updated = { ...prev, recentSearches: [term, ...filtered].slice(0, 10) };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const handleClearRecentSearches = useCallback(() => {
    setPreferences((prev) => {
      const updated = { ...prev, recentSearches: [] };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      preferences,
      updatePreferences,
      clearAllData,
      addRecentSearch: handleAddRecentSearch,
      clearRecentSearches: handleClearRecentSearches,
    }),
    [preferences, updatePreferences, clearAllData, handleAddRecentSearch, handleClearRecentSearches]
  );

  return (
    <PersistenceContext.Provider value={contextValue}>
      {children}
    </PersistenceContext.Provider>
  );
};

export const usePersistenceContext = (): PersistenceContextType => {
  const context = useContext(PersistenceContext);
  if (!context) {
    throw new Error('usePersistenceContext must be used within a PersistenceProvider');
  }
  return context;
};