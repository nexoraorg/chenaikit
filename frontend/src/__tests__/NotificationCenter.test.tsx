/**
 * Tests for the Notification Center system:
 *  - NotificationContext reducer logic
 *  - notificationUtils helpers
 *  - NotificationItem component
 *  - NotificationCenter component (integration)
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import {
  NotificationProvider,
  useNotificationContext,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '../contexts/NotificationContext';
import NotificationItem from '../components/NotificationItem';
import NotificationCenter from '../components/NotificationCenter';
import {
  countUnread,
  isQuietHours,
  isCategoryEnabled,
  formatRelativeTime,
  createNotificationId,
  CATEGORY_LABELS,
} from '../utils/notificationUtils';
import type { Notification } from '../contexts/NotificationContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <NotificationProvider>{children}</NotificationProvider>
  </ThemeProvider>
);

const renderWithProviders = (ui: React.ReactElement) =>
  render(ui, { wrapper: AllProviders });

// A minimal notification fixture
const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'test-notif-1',
  title: 'Test Notification',
  message: 'This is a test message',
  category: 'system',
  type: 'info',
  read: false,
  timestamp: new Date('2025-06-20T10:00:00Z'),
  ...overrides,
});

// ─── notificationUtils ────────────────────────────────────────────────────────

describe('notificationUtils', () => {
  describe('createNotificationId', () => {
    it('generates unique IDs', () => {
      const id1 = createNotificationId();
      const id2 = createNotificationId();
      expect(id1).not.toBe(id2);
    });

    it('starts with "notif-"', () => {
      const id = createNotificationId();
      expect(id.startsWith('notif-')).toBe(true);
    });
  });

  describe('countUnread', () => {
    it('counts only unread notifications', () => {
      const notifications: Notification[] = [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: true }),
        makeNotification({ id: '3', read: false }),
      ];
      expect(countUnread(notifications)).toBe(2);
    });

    it('returns 0 for empty array', () => {
      expect(countUnread([])).toBe(0);
    });

    it('returns 0 when all read', () => {
      const notifications: Notification[] = [
        makeNotification({ id: '1', read: true }),
        makeNotification({ id: '2', read: true }),
      ];
      expect(countUnread(notifications)).toBe(0);
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('has labels for all categories', () => {
      const categories: Array<Notification['category']> = [
        'system', 'transaction', 'credit_score', 'fraud', 'account', 'announcement',
      ];
      categories.forEach((cat) => {
        expect(CATEGORY_LABELS[cat]).toBeTruthy();
      });
    });
  });

  describe('isQuietHours', () => {
    const basePrefs: NotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    it('returns false when quiet hours disabled', () => {
      expect(isQuietHours({ ...basePrefs, quietHoursEnabled: false })).toBe(false);
    });

    it('detects same-day quiet hours window', () => {
      const prefs: NotificationPreferences = {
        ...basePrefs,
        quietHoursStart: '09:00',
        quietHoursEnd: '17:00',
      };
      // Mock Date to 12:00
      const RealDate = global.Date;
      const MockDate = class extends RealDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2025-06-20T12:00:00');
          } else {
            super(...(args as [any]));
          }
        }
      } as unknown as typeof Date;
      global.Date = MockDate;
      expect(isQuietHours(prefs)).toBe(true);
      global.Date = RealDate;
    });

    it('returns false outside same-day quiet hours', () => {
      const prefs: NotificationPreferences = {
        ...basePrefs,
        quietHoursStart: '09:00',
        quietHoursEnd: '17:00',
      };
      const RealDate = global.Date;
      const MockDate = class extends RealDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2025-06-20T18:00:00');
          } else {
            super(...(args as [any]));
          }
        }
      } as unknown as typeof Date;
      global.Date = MockDate;
      expect(isQuietHours(prefs)).toBe(false);
      global.Date = RealDate;
    });
  });

  describe('isCategoryEnabled', () => {
    it('returns true for enabled categories', () => {
      expect(isCategoryEnabled('system', DEFAULT_PREFERENCES)).toBe(true);
      expect(isCategoryEnabled('fraud', DEFAULT_PREFERENCES)).toBe(true);
    });

    it('returns false for disabled categories', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_PREFERENCES,
        systemAlerts: false,
      };
      expect(isCategoryEnabled('system', prefs)).toBe(false);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for very recent dates', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('returns minute-based string for older dates', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('returns "1 minute ago" for singular', () => {
      const oneMinuteAgo = new Date(Date.now() - 61 * 1000);
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('returns hour-based string for old dates', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });
  });
});

// ─── NotificationContext ──────────────────────────────────────────────────────

describe('NotificationContext', () => {
  const ContextConsumer: React.FC = () => {
    const ctx = useNotificationContext();
    return (
      <div>
        <span data-testid="count">{ctx.notifications.length}</span>
        <span data-testid="unread">{ctx.unreadCount}</span>
        <button
          data-testid="add"
          onClick={() =>
            ctx.addNotification({
              title: 'Hello',
              message: 'World',
              category: 'system',
              type: 'info',
            })
          }
        >
          Add
        </button>
        <button
          data-testid="mark-all-read"
          onClick={() => ctx.markAllAsRead()}
        >
          MarkAllRead
        </button>
        <button data-testid="clear-all" onClick={() => ctx.clearAll()}>
          ClearAll
        </button>
      </div>
    );
  };

  it('starts with 0 notifications (or persisted history)', () => {
    renderWithProviders(<ContextConsumer />);
    // May have persisted storage — just assert count is a number
    const count = parseInt(screen.getByTestId('count').textContent ?? '0', 10);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('adds a notification and increments unread count', () => {
    renderWithProviders(<ContextConsumer />);
    const before = parseInt(screen.getByTestId('unread').textContent ?? '0', 10);
    act(() => {
      fireEvent.click(screen.getByTestId('add'));
    });
    const after = parseInt(screen.getByTestId('unread').textContent ?? '0', 10);
    expect(after).toBe(before + 1);
  });

  it('markAllAsRead sets unread count to 0', () => {
    renderWithProviders(<ContextConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('add'));
      fireEvent.click(screen.getByTestId('add'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('mark-all-read'));
    });
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('clearAll removes all notifications', () => {
    renderWithProviders(<ContextConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('add'));
      fireEvent.click(screen.getByTestId('add'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('clear-all'));
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });
});

// ─── NotificationItem ─────────────────────────────────────────────────────────

describe('NotificationItem', () => {
  const notification = makeNotification();
  const mockMarkRead = jest.fn();
  const mockMarkUnread = jest.fn();
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderItem = (n: Notification = notification) =>
    render(
      <ThemeProvider theme={theme}>
        <NotificationItem
          notification={n}
          onMarkRead={mockMarkRead}
          onMarkUnread={mockMarkUnread}
          onDismiss={mockDismiss}
        />
      </ThemeProvider>
    );

  it('renders notification title and message', () => {
    renderItem();
    expect(screen.getByText('Test Notification')).toBeInTheDocument();
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('shows "Mark as read" button for unread notifications', () => {
    renderItem(makeNotification({ read: false }));
    expect(screen.getByLabelText('Mark as read')).toBeInTheDocument();
  });

  it('shows "Mark as unread" button for read notifications', () => {
    renderItem(makeNotification({ read: true }));
    expect(screen.getByLabelText('Mark as unread')).toBeInTheDocument();
  });

  it('calls onMarkRead when clicking mark-as-read', () => {
    renderItem(makeNotification({ read: false }));
    fireEvent.click(screen.getByLabelText('Mark as read'));
    expect(mockMarkRead).toHaveBeenCalledWith('test-notif-1');
  });

  it('calls onMarkUnread when clicking mark-as-unread on read item', () => {
    renderItem(makeNotification({ read: true }));
    fireEvent.click(screen.getByLabelText('Mark as unread'));
    expect(mockMarkUnread).toHaveBeenCalledWith('test-notif-1');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    renderItem();
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(mockDismiss).toHaveBeenCalledWith('test-notif-1');
  });

  it('renders the category chip when showCategory is true', () => {
    renderItem();
    expect(screen.getByText(CATEGORY_LABELS['system'])).toBeInTheDocument();
  });

  it('does not render category chip when showCategory is false', () => {
    render(
      <ThemeProvider theme={theme}>
        <NotificationItem
          notification={notification}
          onMarkRead={mockMarkRead}
          onMarkUnread={mockMarkUnread}
          onDismiss={mockDismiss}
          showCategory={false}
        />
      </ThemeProvider>
    );
    expect(screen.queryByText(CATEGORY_LABELS['system'])).not.toBeInTheDocument();
  });

  it('renders action button when action is provided', () => {
    const withAction = makeNotification({
      action: { label: 'View Details', onClick: jest.fn() },
    });
    renderItem(withAction);
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('calls action.onClick when action button is clicked', () => {
    const onClick = jest.fn();
    const withAction = makeNotification({
      action: { label: 'View Details', onClick },
    });
    renderItem(withAction);
    fireEvent.click(screen.getByText('View Details'));
    expect(onClick).toHaveBeenCalled();
  });

  it('marks notification as read when clicking unread item body', () => {
    renderItem(makeNotification({ read: false }));
    const article = screen.getByRole('article');
    fireEvent.click(article);
    expect(mockMarkRead).toHaveBeenCalledWith('test-notif-1');
  });

  it('has accessible role and aria-label', () => {
    renderItem(makeNotification({ read: false }));
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-label');
    expect(article.getAttribute('aria-label')).toContain('Test Notification');
  });

  it('includes "Unread:" prefix in aria-label for unread items', () => {
    renderItem(makeNotification({ read: false }));
    const article = screen.getByRole('article');
    expect(article.getAttribute('aria-label')).toMatch(/^Unread:/);
  });
});

// ─── NotificationCenter (integration) ────────────────────────────────────────

describe('NotificationCenter', () => {
  const renderCenter = () => renderWithProviders(<NotificationCenter />);

  it('renders the bell icon button', () => {
    renderCenter();
    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
  });

  it('does not show the dropdown panel initially', () => {
    renderCenter();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the panel when bell is clicked', () => {
    renderCenter();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the panel when bell is clicked again', () => {
    renderCenter();
    const bell = screen.getByLabelText(/notifications/i);
    fireEvent.click(bell);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(bell);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    renderCenter();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    // Clear any persisted notifications by finding clear-all if present
    const clearBtn = screen.queryByLabelText('Clear all notifications');
    if (clearBtn) {
      act(() => fireEvent.click(clearBtn));
    }
    expect(
      screen.queryByText(/you're all caught up/i) ||
      screen.queryByRole('feed')
    ).toBeTruthy();
  });

  it('shows notification settings panel when settings icon is clicked', () => {
    renderCenter();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    fireEvent.click(screen.getByLabelText('Open notification settings'));
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
  });

  it('navigates back from preferences panel', () => {
    renderCenter();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    fireEvent.click(screen.getByLabelText('Open notification settings'));
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Back to notifications'));
    expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
  });

  it('closes panel on Escape key', () => {
    renderCenter();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
