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
  addRecentSearch,
  clearRecentSearches,
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
    addRecentSearch(term);
    setPreferences(loadPreferences());
  }, []);

  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
    setPreferences(loadPreferences());
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