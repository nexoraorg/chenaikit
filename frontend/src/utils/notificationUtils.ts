/**
 * Utility helpers for the notification center.
 *
 * Responsibilities:
 *  - Generating stable notification IDs
 *  - Computing unread counts
 *  - Checking quiet-hours windows
 *  - Requesting / checking browser push-notification permission
 *  - Firing browser push notifications
 *  - Persisting / loading history from localStorage
 *  - Sound alert helpers
 */

import type { Notification, NotificationCategory, NotificationPreferences } from '../contexts/NotificationContext';

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;
export const createNotificationId = (): string =>
  `notif-${Date.now()}-${++_counter}`;

// ─── Unread count ─────────────────────────────────────────────────────────────

export const countUnread = (notifications: Notification[]): number =>
  notifications.filter((n) => !n.read).length;

// ─── Category labels ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: 'System',
  transaction: 'Transaction',
  credit_score: 'Credit Score',
  fraud: 'Fraud Alert',
  account: 'Account',
  announcement: 'Announcement',
};

// ─── Severity / type → MUI color ─────────────────────────────────────────────

export type NotificationSeverity = 'error' | 'warning' | 'info' | 'success';

export const severityForNotification = (n: Notification): NotificationSeverity => {
  if (n.category === 'fraud') return 'error';
  if (n.category === 'system' && n.type === 'error') return 'error';
  if (n.type === 'warning') return 'warning';
  if (n.type === 'success') return 'success';
  return 'info';
};

// ─── Quiet-hours check ────────────────────────────────────────────────────────

/**
 * Returns `true` if the *current local time* falls inside the quiet-hours
 * window defined in `preferences`.
 *
 * Both `quietHoursStart` and `quietHoursEnd` are `"HH:MM"` strings (24-hour).
 * Crosses-midnight ranges are handled correctly (e.g. `"22:00"` – `"07:00"`).
 */
export const isQuietHours = (preferences: NotificationPreferences): boolean => {
  if (!preferences.quietHoursEnabled) return false;

  const now = new Date();
  const [sh, sm] = preferences.quietHoursStart.split(':').map(Number);
  const [eh, em] = preferences.quietHoursEnd.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes <= endMinutes) {
    // Same-day window e.g. 09:00 – 17:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Cross-midnight window e.g. 22:00 – 07:00
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

// ─── Category-level preference check ─────────────────────────────────────────

/**
 * Returns `true` if in-app notifications for a given category are enabled in
 * the user's preferences.
 */
export const isCategoryEnabled = (
  category: NotificationCategory,
  preferences: NotificationPreferences
): boolean => {
  const map: Record<NotificationCategory, boolean> = {
    system: preferences.systemAlerts,
    transaction: preferences.transactionAlerts,
    credit_score: preferences.creditScoreUpdates,
    fraud: preferences.fraudAlerts,
    account: preferences.accountNotifications,
    announcement: preferences.announcements,
  };
  return map[category] ?? true;
};

// ─── Browser push-notification helpers ───────────────────────────────────────

export const isBrowserNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export type BrowserPermission = NotificationPermission | 'unsupported';

export const getBrowserPermission = (): BrowserPermission => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Requests browser push-notification permission.
 * Resolves with `'granted'`, `'denied'`, or `'default'`.
 */
export const requestBrowserPermission = async (): Promise<BrowserPermission> => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
};

/**
 * Fires a browser push notification when the page is in the background.
 * Silently skips if permission is not granted.
 */
export const fireBrowserNotification = (notification: Notification): void => {
  if (!isBrowserNotificationSupported()) return;
  if (getBrowserPermission() !== 'granted') return;

  const categoryLabel = CATEGORY_LABELS[notification.category] ?? 'Notification';
  try {
    const n = new window.Notification(notification.title, {
      body: notification.message,
      tag: notification.id,
      // icon: '/notification-icon.png', // add once assets exist
      data: { notificationId: notification.id },
    });
    // Auto-close after 5 s to avoid cluttering the notification centre OS-side
    setTimeout(() => n.close(), 5000);
    // Suppress "unused variable" lint warning
    void categoryLabel;
  } catch {
    // Browser may block even when permission is granted in some contexts
  }
};

// ─── Sound alerts ─────────────────────────────────────────────────────────────

/**
 * Plays a short audio beep for urgent notifications.
 * Uses the Web Audio API so no asset file is required.
 */
export const playSoundAlert = (urgent = false): void => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = urgent ? 880 : 660; // A5 for urgent, E5 for normal
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext may be unavailable in test environments
  }
};

// ─── localStorage persistence ─────────────────────────────────────────────────

const HISTORY_KEY = 'chenaikit_notification_history';
const PREFS_KEY = 'chenaikit_notification_preferences';
const MAX_HISTORY = 100;

export const saveNotificationsToStorage = (notifications: Notification[]): void => {
  try {
    // Keep only the most recent MAX_HISTORY notifications to cap storage usage
    const toSave = notifications.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded)
  }
};

export const loadNotificationsFromStorage = (): Notification[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: Notification[] = JSON.parse(raw);
    // Rehydrate Date strings → Date objects
    return parsed.map((n) => ({
      ...n,
      timestamp: new Date(n.timestamp),
    }));
  } catch {
    return [];
  }
};

export const savePreferencesToStorage = (prefs: NotificationPreferences): void => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // no-op
  }
};

export const loadPreferencesFromStorage = (): Partial<NotificationPreferences> => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<NotificationPreferences>;
  } catch {
    return {};
  }
};

// ─── Relative-time formatting ─────────────────────────────────────────────────

/**
 * Returns a human-readable relative timestamp string like
 * "just now", "5 minutes ago", "2 hours ago", "3 days ago".
 */
export const formatRelativeTime = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  if (diffHrs < 24) return diffHrs === 1 ? '1 hour ago' : `${diffHrs} hours ago`;
  if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

  return date.toLocaleDateString();
};
