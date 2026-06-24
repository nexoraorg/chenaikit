/**
 * NotificationCenter
 *
 * A bell icon button with unread-count badge that opens a dropdown panel
 * containing:
 *  - Notification history with category filtering
 *  - Mark-as-read / dismiss actions per item
 *  - Mark-all-read + Clear-all bulk actions
 *  - Inline preferences panel (slide-in)
 *
 * Designed to be embedded in the DashboardShell header bar.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Notifications as BellIcon,
  NotificationsNone as BellEmptyIcon,
  Settings as SettingsIcon,
  DoneAll as MarkAllReadIcon,
  DeleteSweep as ClearAllIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import NotificationItem from './NotificationItem';
import NotificationPreferences from './NotificationPreferences';
import useNotifications from '../hooks/useNotifications';
import type { NotificationCategory } from '../contexts/NotificationContext';
import { CATEGORY_LABELS } from '../utils/notificationUtils';

// ─── Category filter tabs ─────────────────────────────────────────────────────

const CATEGORY_FILTERS: Array<{ value: NotificationCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'system', label: 'System' },
  { value: 'credit_score', label: 'Credit Score' },
  { value: 'account', label: 'Account' },
  { value: 'announcement', label: 'News' },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ filtered: boolean }> = ({ filtered }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
      px: 2,
      gap: 1,
    }}
  >
    <BellEmptyIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
      {filtered
        ? 'No notifications in this category'
        : 'You're all caught up!'}
    </Typography>
  </Box>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationCenterProps {
  /** Size variant for the bell icon button */
  size?: 'small' | 'medium' | 'large';
  /** Max number of items to render at once for performance */
  maxVisible?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  size = 'medium',
  maxVisible = 50,
}) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    clearAll,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<NotificationCategory | 'all'>('all');

  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // ── Filtered + paginated list ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const base =
      activeFilter === 'all'
        ? notifications
        : notifications.filter((n) => n.category === activeFilter);
    return base.slice(0, maxVisible);
  }, [notifications, activeFilter, maxVisible]);

  const unreadInFilter = useMemo(
    () => filtered.filter((n) => !n.read).length,
    [filtered]
  );

  // ── Badge colour: red for fraud/error, primary otherwise ─────────────────

  const badgeColor = useMemo(() => {
    const hasUrgent = notifications.some(
      (n) => !n.read && (n.category === 'fraud' || n.type === 'error')
    );
    return hasUrgent ? 'error' : 'primary';
  }, [notifications]);

  // ── Keyboard: Esc to close ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
    setShowPreferences(false);
  }, []);

  const handleClickAway = useCallback(() => {
    setOpen(false);
    setShowPreferences(false);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    clearAll();
  }, [clearAll]);

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        {/* Bell button */}
        <Tooltip title={open ? 'Close notifications' : 'Notifications'} placement="bottom">
          <IconButton
            ref={bellRef}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            size={size}
            onClick={handleToggle}
            sx={{
              color: open ? 'primary.main' : 'inherit',
              transition: 'color 0.2s ease',
            }}
          >
            <Badge
              badgeContent={unreadCount}
              color={badgeColor}
              max={99}
              overlap="circular"
              aria-hidden="true"
            >
              {unreadCount > 0 ? (
                <BellIcon fontSize={size === 'small' ? 'small' : 'medium'} />
              ) : (
                <BellEmptyIcon fontSize={size === 'small' ? 'small' : 'medium'} />
              )}
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Dropdown panel */}
        {open && (
          <Paper
            ref={panelRef}
            role="dialog"
            aria-label="Notification center"
            aria-modal="false"
            elevation={8}
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: { xs: '100vw', sm: 380 },
              maxWidth: '100vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1300,
              borderRadius: 2,
              overflow: 'hidden',
              // Ensure it stays on-screen on small viewports
              ...(typeof window !== 'undefined' && window.innerWidth < 380
                ? { right: 'auto', left: -16 }
                : {}),
            }}
          >
            {showPreferences ? (
              /* ── Preferences panel ─────────────────────────────────── */
              <>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    gap: 1,
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label="Back to notifications"
                    onClick={() => setShowPreferences(false)}
                    sx={{ p: 0.5 }}
                  >
                    <BackIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    Notification Preferences
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  <NotificationPreferences
                    onClose={() => setShowPreferences(false)}
                  />
                </Box>
              </>
            ) : (
              /* ── Notification list ─────────────────────────────────── */
              <>
                {/* Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    Notifications
                    {unreadCount > 0 && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          ml: 1,
                          px: 0.75,
                          py: 0.1,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          verticalAlign: 'middle',
                        }}
                      >
                        {unreadCount}
                      </Typography>
                    )}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {unreadInFilter > 0 && (
                      <Tooltip title="Mark all as read">
                        <IconButton
                          size="small"
                          aria-label="Mark all as read"
                          onClick={handleMarkAllRead}
                          sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                        >
                          <MarkAllReadIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {notifications.length > 0 && (
                      <Tooltip title="Clear all">
                        <IconButton
                          size="small"
                          aria-label="Clear all notifications"
                          onClick={handleClearAll}
                          sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                        >
                          <ClearAllIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Notification settings">
                      <IconButton
                        size="small"
                        aria-label="Open notification settings"
                        onClick={() => setShowPreferences(true)}
                        sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        <SettingsIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Category filter chips */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.75,
                    px: 1.5,
                    py: 1,
                    overflowX: 'auto',
                    borderBottom: 1,
                    borderColor: 'divider',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    flexShrink: 0,
                  }}
                  role="tablist"
                  aria-label="Filter notifications by category"
                >
                  {CATEGORY_FILTERS.map(({ value, label }) => {
                    const count =
                      value === 'all'
                        ? unreadCount
                        : notifications.filter(
                            (n) => n.category === value && !n.read
                          ).length;
                    return (
                      <Chip
                        key={value}
                        role="tab"
                        aria-selected={activeFilter === value}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <span>{label}</span>
                            {count > 0 && (
                              <Box
                                component="span"
                                sx={{
                                  bgcolor:
                                    activeFilter === value
                                      ? 'primary.contrastText'
                                      : 'primary.main',
                                  color:
                                    activeFilter === value
                                      ? 'primary.main'
                                      : 'primary.contrastText',
                                  borderRadius: '50%',
                                  width: 16,
                                  height: 16,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                }}
                              >
                                {count > 9 ? '9+' : count}
                              </Box>
                            )}
                          </Box>
                        }
                        size="small"
                        clickable
                        onClick={() => setActiveFilter(value)}
                        color={activeFilter === value ? 'primary' : 'default'}
                        sx={{
                          height: 24,
                          fontSize: '0.7rem',
                          fontWeight: activeFilter === value ? 700 : 400,
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      />
                    );
                  })}
                </Box>

                {/* Notification list */}
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                  role="feed"
                  aria-label="Notification feed"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {filtered.length === 0 ? (
                    <EmptyState filtered={activeFilter !== 'all'} />
                  ) : (
                    <Box sx={{ py: 0.5 }}>
                      {filtered.map((notification, index) => (
                        <React.Fragment key={notification.id}>
                          <NotificationItem
                            notification={notification}
                            onMarkRead={markAsRead}
                            onMarkUnread={markAsUnread}
                            onDismiss={dismissNotification}
                            showCategory={activeFilter === 'all'}
                          />
                          {index < filtered.length - 1 && (
                            <Divider sx={{ mx: 1.5, opacity: 0.5 }} />
                          )}
                        </React.Fragment>
                      ))}
                      {notifications.length > maxVisible && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'center',
                            color: 'text.secondary',
                            py: 1.5,
                          }}
                        >
                          Showing {maxVisible} of {notifications.length} notifications
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Footer */}
                {notifications.length > 0 && (
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {unreadCount > 0
                        ? `${unreadCount} unread`
                        : 'All read'}
                    </Typography>
                    {unreadCount > 0 && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={handleMarkAllRead}
                        sx={{ fontSize: '0.7rem', textTransform: 'none', p: 0.5 }}
                      >
                        Mark all as read
                      </Button>
                    )}
                  </Box>
                )}
              </>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default NotificationCenter;
