/**
 * useNotifications
 *
 * Primary consumer hook for the notification center.
 *
 * Provides:
 *  - Full notification list with optional category filtering
 *  - Unread count (total and per-category)
 *  - All CRUD actions from NotificationContext
 *  - Helper to add typed notifications by category
 *  - Browser-permission request helper
 */

import { useCallback, useMemo } from 'react';
import {
  useNotificationContext,
  type Notification,
  type NotificationCategory,
  type NotificationPreferences,
  type AddNotificationOptions,
} from '../contexts/NotificationContext';
import {
  requestBrowserPermission,
  getBrowserPermission,
  isBrowserNotificationSupported,
  type BrowserPermission,
} from '../utils/notificationUtils';

export interface UseNotificationsReturn {
  // State
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;

  // Filtered views (pass a category to filter, or undefined for all)
  getByCategory: (category: NotificationCategory) => Notification[];
  unreadByCategory: (category: NotificationCategory) => number;

  // Actions
  addNotification: (options: AddNotificationOptions) => string;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (partial: Partial<NotificationPreferences>) => void;

  // Category-specific convenience helpers
  addSystemAlert: (title: string, message: string, type?: Notification['type'], urgent?: boolean) => string;
  addTransactionAlert: (title: string, message: string, type?: Notification['type'], urgent?: boolean) => string;
  addFraudAlert: (title: string, message: string) => string;
  addCreditScoreUpdate: (title: string, message: string) => string;
  addAccountNotification: (title: string, message: string, type?: Notification['type']) => string;
  addAnnouncement: (title: string, message: string) => string;

  // Browser push
  browserPermission: BrowserPermission;
  isBrowserPushSupported: boolean;
  requestPushPermission: () => Promise<BrowserPermission>;
}

const useNotifications = (): UseNotificationsReturn => {
  const ctx = useNotificationContext();

  const {
    notifications,
    unreadCount,
    preferences,
    addNotification,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearAll,
    updatePreferences,
  } = ctx;

  // ── Filtered views ─────────────────────────────────────────────────────────

  const getByCategory = useCallback(
    (category: NotificationCategory): Notification[] =>
      notifications.filter((n) => n.category === category),
    [notifications]
  );

  const unreadByCategory = useCallback(
    (category: NotificationCategory): number =>
      notifications.filter((n) => n.category === category && !n.read).length,
    [notifications]
  );

  // ── Category helpers ───────────────────────────────────────────────────────

  const addSystemAlert = useCallback(
    (
      title: string,
      message: string,
      type: Notification['type'] = 'warning',
      urgent = false
    ): string =>
      addNotification({ title, message, category: 'system', type, urgent }),
    [addNotification]
  );

  const addTransactionAlert = useCallback(
    (
      title: string,
      message: string,
      type: Notification['type'] = 'info',
      urgent = false
    ): string =>
      addNotification({ title, message, category: 'transaction', type, urgent }),
    [addNotification]
  );

  const addFraudAlert = useCallback(
    (title: string, message: string): string =>
      addNotification({
        title,
        message,
        category: 'fraud',
        type: 'error',
        urgent: true,
      }),
    [addNotification]
  );

  const addCreditScoreUpdate = useCallback(
    (title: string, message: string): string =>
      addNotification({
        title,
        message,
        category: 'credit_score',
        type: 'info',
      }),
    [addNotification]
  );

  const addAccountNotification = useCallback(
    (
      title: string,
      message: string,
      type: Notification['type'] = 'info'
    ): string =>
      addNotification({ title, message, category: 'account', type }),
    [addNotification]
  );

  const addAnnouncement = useCallback(
    (title: string, message: string): string =>
      addNotification({ title, message, category: 'announcement', type: 'info' }),
    [addNotification]
  );

  // ── Browser push ───────────────────────────────────────────────────────────

  const browserPermission = useMemo(
    () => getBrowserPermission(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // read once on mount — updated by requestPushPermission
  );

  const isBrowserPushSupported = useMemo(
    () => isBrowserNotificationSupported(),
    []
  );

  const requestPushPermission = useCallback(
    async (): Promise<BrowserPermission> => requestBrowserPermission(),
    []
  );

  return {
    notifications,
    unreadCount,
    preferences,
    getByCategory,
    unreadByCategory,
    addNotification,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearAll,
    updatePreferences,
    addSystemAlert,
    addTransactionAlert,
    addFraudAlert,
    addCreditScoreUpdate,
    addAccountNotification,
    addAnnouncement,
    browserPermission,
    isBrowserPushSupported,
    requestPushPermission,
  };
};

export default useNotifications;
