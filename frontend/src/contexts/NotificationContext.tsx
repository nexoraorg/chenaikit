/**
 * NotificationContext
 *
 * Provides application-wide notification state and actions:
 *  - In-memory notification list (max 100)
 *  - Unread count
 *  - Per-category filtering
 *  - Mark-as-read / mark-all-read / dismiss
 *  - User preferences (per-type toggles, email, push, quiet hours)
 *  - Real-time delivery via optional WebSocket alerts integration
 *  - Browser push notifications
 *  - localStorage persistence for history and preferences
 *  - Quiet-hours enforcement
 *  - Sound alerts for urgent notifications
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  createNotificationId,
  countUnread,
  isCategoryEnabled,
  isQuietHours,
  fireBrowserNotification,
  playSoundAlert,
  saveNotificationsToStorage,
  loadNotificationsFromStorage,
  savePreferencesToStorage,
  loadPreferencesFromStorage,
} from '../utils/notificationUtils';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'system'
  | 'transaction'
  | 'credit_score'
  | 'fraud'
  | 'account'
  | 'announcement';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type: NotificationType;
  read: boolean;
  timestamp: Date;
  /** Optional action the user can invoke from the notification item */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Whether this notification should trigger a sound / browser push */
  urgent?: boolean;
  /** Arbitrary extra metadata */
  data?: unknown;
}

export interface NotificationPreferences {
  // Per-category in-app toggles
  systemAlerts: boolean;
  transactionAlerts: boolean;
  creditScoreUpdates: boolean;
  fraudAlerts: boolean;
  accountNotifications: boolean;
  announcements: boolean;
  // Delivery channel toggles
  emailNotifications: boolean;
  pushNotifications: boolean;
  mobilePush: boolean;
  // Sound
  soundEnabled: boolean;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM" 24-hour
  quietHoursEnd: string;   // "HH:MM" 24-hour
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  systemAlerts: true,
  transactionAlerts: true,
  creditScoreUpdates: true,
  fraudAlerts: true,
  accountNotifications: true,
  announcements: true,
  emailNotifications: true,
  pushNotifications: true,
  mobilePush: false,
  soundEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

// ─── New-notification options (ID and timestamp are auto-generated) ───────────

export type AddNotificationOptions = Omit<Notification, 'id' | 'read' | 'timestamp'>;

// ─── Context value type ───────────────────────────────────────────────────────

export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  /** Add a new notification. Returns the generated ID. */
  addNotification: (options: AddNotificationOptions) => string;
  /** Mark a single notification as read */
  markAsRead: (id: string) => void;
  /** Mark a single notification as unread */
  markAsUnread: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Remove a single notification from history */
  dismissNotification: (id: string) => void;
  /** Remove all notifications */
  clearAll: () => void;
  /** Update user preferences */
  updatePreferences: (partial: Partial<NotificationPreferences>) => void;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type State = {
  notifications: Notification[];
  preferences: NotificationPreferences;
};

type Action =
  | { type: 'ADD'; notification: Notification }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_UNREAD'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'UPDATE_PREFERENCES'; partial: Partial<NotificationPreferences> };

const MAX_NOTIFICATIONS = 100;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD': {
      const updated = [action.notification, ...state.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      );
      return { ...state, notifications: updated };
    }
    case 'MARK_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      };
    case 'MARK_UNREAD':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: false } : n
        ),
      };
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case 'DISMISS':
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.id),
      };
    case 'CLEAR_ALL':
      return { ...state, notifications: [] };
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.partial },
      };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  // Hydrate from localStorage on first mount
  const initialState = useMemo<State>(() => {
    const storedPrefs = loadPreferencesFromStorage();
    const storedNotifications = loadNotificationsFromStorage();
    return {
      notifications: storedNotifications,
      preferences: { ...DEFAULT_PREFERENCES, ...storedPrefs },
    };
  }, []);

  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist notifications whenever they change
  const notificationsRef = useRef(state.notifications);
  notificationsRef.current = state.notifications;

  useEffect(() => {
    saveNotificationsToStorage(state.notifications);
  }, [state.notifications]);

  // Persist preferences whenever they change
  useEffect(() => {
    savePreferencesToStorage(state.preferences);
  }, [state.preferences]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const addNotification = useCallback(
    (options: AddNotificationOptions): string => {
      const { category, urgent } = options;
      const prefs = state.preferences; // fresh read via closure over state

      // 1. Category filter
      if (!isCategoryEnabled(category, prefs)) return '';

      // 2. Quiet hours — suppress non-urgent notifications
      if (!urgent && isQuietHours(prefs)) return '';

      const notification: Notification = {
        ...options,
        id: createNotificationId(),
        read: false,
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD', notification });

      // 3. Sound alert (if enabled and not in quiet hours)
      if (prefs.soundEnabled && !isQuietHours(prefs)) {
        playSoundAlert(urgent);
      }

      // 4. Browser push notification
      if (prefs.pushNotifications) {
        fireBrowserNotification(notification);
      }

      return notification.id;
    },
    [state.preferences]
  );

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', id });
  }, []);

  const markAsUnread = useCallback((id: string) => {
    dispatch({ type: 'MARK_UNREAD', id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_READ' });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const updatePreferences = useCallback(
    (partial: Partial<NotificationPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', partial });
    },
    []
  );

  // ── Derived values ─────────────────────────────────────────────────────────

  const unreadCount = useMemo(
    () => countUnread(state.notifications),
    [state.notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: state.notifications,
      unreadCount,
      preferences: state.preferences,
      addNotification,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
    }),
    [
      state.notifications,
      unreadCount,
      state.preferences,
      addNotification,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// ─── Consumer hook ────────────────────────────────────────────────────────────

export const useNotificationContext = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider'
    );
  }
  return ctx;
};

export default NotificationContext;
