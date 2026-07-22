// ─── usePersistence ───────────────────────────────────────────────────────────
// Convenience hook for accessing persistence state and actions.

import { usePersistenceContext } from '../contexts/PersistenceContext';

const usePersistence = () => {
  return usePersistenceContext();
};

export default usePersistence;