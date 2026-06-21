/**
 * NotificationItem
 *
 * Renders a single notification row inside the NotificationCenter panel.
 * Features:
 *  - Category icon + color coding
 *  - Unread indicator dot
 *  - Relative timestamp
 *  - Mark-as-read / mark-as-unread toggle
 *  - Dismiss button
 *  - Optional action button
 *  - Keyboard-accessible
 */

import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  MarkEmailRead as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  SwapHoriz as TransactionIcon,
  TrendingUp as CreditScoreIcon,
  GppBad as FraudIcon,
  ManageAccounts as AccountIcon,
  Campaign as AnnouncementIcon,
} from '@mui/icons-material';
import type { Notification, NotificationCategory, NotificationType } from '../contexts/NotificationContext';
import { CATEGORY_LABELS, formatRelativeTime } from '../utils/notificationUtils';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<NotificationCategory, React.ReactElement> = {
  system: <SecurityIcon fontSize="small" />,
  transaction: <TransactionIcon fontSize="small" />,
  credit_score: <CreditScoreIcon fontSize="small" />,
  fraud: <FraudIcon fontSize="small" />,
  account: <AccountIcon fontSize="small" />,
  announcement: <AnnouncementIcon fontSize="small" />,
};

const TYPE_ICON: Record<NotificationType, React.ReactElement> = {
  error: <ErrorIcon fontSize="small" />,
  warning: <WarningIcon fontSize="small" />,
  success: <SuccessIcon fontSize="small" />,
  info: <InfoIcon fontSize="small" />,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  error: 'error.main',
  warning: 'warning.main',
  success: 'success.main',
  info: 'info.main',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDismiss: (id: string) => void;
  /** Whether to show the category chip. Defaults to true. */
  showCategory?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onMarkUnread,
  onDismiss,
  showCategory = true,
}) => {
  const { id, title, message, category, type, read, timestamp, action, urgent } =
    notification;

  const handleToggleRead = useCallback(() => {
    if (read) {
      onMarkUnread(id);
    } else {
      onMarkRead(id);
    }
  }, [id, read, onMarkRead, onMarkUnread]);

  const handleDismiss = useCallback(() => {
    onDismiss(id);
  }, [id, onDismiss]);

  const handleAction = useCallback(() => {
    action?.onClick();
    if (!read) onMarkRead(id);
  }, [action, id, read, onMarkRead]);

  return (
    <Box
      component="article"
      aria-label={`${read ? '' : 'Unread: '}${title}`}
      onClick={() => !read && onMarkRead(id)}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        cursor: read ? 'default' : 'pointer',
        bgcolor: read ? 'transparent' : 'action.hover',
        borderLeft: urgent ? '3px solid' : '3px solid transparent',
        borderLeftColor: urgent ? TYPE_COLOR[type] : 'transparent',
        borderRadius: 1,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: 'action.selected',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
        position: 'relative',
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!read) onMarkRead(id);
        }
      }}
    >
      {/* Unread dot */}
      {!read && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 12,
            left: -1,
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            flexShrink: 0,
          }}
        />
      )}

      {/* Type / category icon */}
      <Box
        aria-hidden="true"
        sx={{
          color: TYPE_COLOR[type],
          mt: 0.25,
          flexShrink: 0,
        }}
      >
        {urgent ? TYPE_ICON[type] : CATEGORY_ICON[category]}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 1,
            mb: 0.25,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: read ? 400 : 600,
              color: 'text.primary',
              lineHeight: 1.4,
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', flexShrink: 0, fontSize: '0.7rem' }}
            title={timestamp.toLocaleString()}
          >
            {formatRelativeTime(timestamp)}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            lineHeight: 1.4,
            mb: showCategory || action ? 1 : 0,
          }}
        >
          {message}
        </Typography>

        {/* Category chip + action button */}
        {(showCategory || action) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {showCategory && (
              <Chip
                label={CATEGORY_LABELS[category]}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  bgcolor: 'action.selected',
                  color: 'text.secondary',
                }}
              />
            )}
            {action && (
              <Button
                size="small"
                variant="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
                sx={{
                  px: 0.75,
                  py: 0,
                  minWidth: 0,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'primary.main',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                {action.label}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          flexShrink: 0,
          alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title={read ? 'Mark as unread' : 'Mark as read'} placement="left">
          <IconButton
            size="small"
            aria-label={read ? 'Mark as unread' : 'Mark as read'}
            onClick={handleToggleRead}
            sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            {read ? (
              <MarkUnreadIcon sx={{ fontSize: 14 }} />
            ) : (
              <MarkReadIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Dismiss" placement="left">
          <IconButton
            size="small"
            aria-label="Dismiss notification"
            onClick={handleDismiss}
            sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default NotificationItem;
