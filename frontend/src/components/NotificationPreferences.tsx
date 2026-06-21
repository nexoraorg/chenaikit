/**
 * NotificationPreferences
 *
 * A panel for configuring all notification preferences:
 *  - Per-category in-app toggles
 *  - Email / push / mobile-push delivery channels
 *  - Sound alerts
 *  - Quiet hours (with cross-midnight support)
 *  - Request browser push-notification permission
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  TextField,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  PhoneAndroid as MobileIcon,
  VolumeUp as SoundIcon,
  Schedule as QuietHoursIcon,
  NotificationsOff as PushOffIcon,
  Security as SystemIcon,
  SwapHoriz as TransactionIcon,
  TrendingUp as CreditScoreIcon,
  GppBad as FraudIcon,
  ManageAccounts as AccountIcon,
  Campaign as AnnouncementIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import type { NotificationPreferences as Prefs } from '../contexts/NotificationContext';
import useNotifications from '../hooks/useNotifications';

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactElement;
  title: string;
  description?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, description }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
    <Box sx={{ color: 'primary.main', mt: 0.25 }}>{icon}</Box>
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {description}
        </Typography>
      )}
    </Box>
  </Box>
);

// ─── Toggle row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  tooltip?: string;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  checked,
  onChange,
  label,
  description,
  tooltip,
  disabled = false,
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0.75,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500, color: disabled ? 'text.disabled' : 'text.primary' }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        )}
      </Box>
      {tooltip && (
        <Tooltip title={tooltip} placement="right">
          <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }}>
            <HelpIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      size="small"
      inputProps={{ 'aria-label': label }}
    />
  </Box>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationPreferencesProps {
  /** Called after preferences are saved */
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  onClose,
}) => {
  const {
    preferences,
    updatePreferences,
    browserPermission,
    isBrowserPushSupported,
    requestPushPermission,
  } = useNotifications();

  const [local, setLocal] = useState<Prefs>(preferences);
  const [pushRequestStatus, setPushRequestStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');

  const update = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    updatePreferences(local);
    onClose?.();
  }, [local, updatePreferences, onClose]);

  const handleRequestPush = useCallback(async () => {
    setPushRequestStatus('requesting');
    const result = await requestPushPermission();
    setPushRequestStatus(result === 'granted' ? 'granted' : 'denied');
    if (result === 'granted') {
      setLocal((prev) => ({ ...prev, pushNotifications: true }));
    }
  }, [requestPushPermission]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>

        {/* ── Notification Types ──────────────────────────────────────── */}
        <SectionHeader
          icon={<NotificationsIcon />}
          title="Notification Types"
          description="Choose which types of notifications to receive in-app"
        />

        <ToggleRow
          label="System Alerts"
          description="Errors, outages, and warnings"
          checked={local.systemAlerts}
          onChange={(v) => update('systemAlerts', v)}
        />
        <ToggleRow
          label="Transaction Alerts"
          description="High-value and suspicious transactions"
          checked={local.transactionAlerts}
          onChange={(v) => update('transactionAlerts', v)}
        />
        <ToggleRow
          label="Credit Score Updates"
          description="Changes to your credit score"
          checked={local.creditScoreUpdates}
          onChange={(v) => update('creditScoreUpdates', v)}
        />
        <ToggleRow
          label="Fraud Detection Alerts"
          description="Potential fraud and security threats"
          checked={local.fraudAlerts}
          onChange={(v) => update('fraudAlerts', v)}
          tooltip="Fraud alerts are always delivered immediately, bypassing quiet hours."
        />
        <ToggleRow
          label="Account Notifications"
          description="Login activity, settings changes"
          checked={local.accountNotifications}
          onChange={(v) => update('accountNotifications', v)}
        />
        <ToggleRow
          label="Announcements"
          description="New features and product updates"
          checked={local.announcements}
          onChange={(v) => update('announcements', v)}
        />

        <Divider sx={{ my: 2 }} />

        {/* ── Delivery Channels ──────────────────────────────────────── */}
        <SectionHeader
          icon={<EmailIcon />}
          title="Delivery Channels"
          description="Control how you receive notifications"
        />

        <ToggleRow
          label="Email Notifications"
          description="Receive notifications via email"
          checked={local.emailNotifications}
          onChange={(v) => update('emailNotifications', v)}
        />

        <Box sx={{ py: 0.75 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Browser Push Notifications
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Receive push notifications when the tab is in the background
              </Typography>
            </Box>
            <Switch
              checked={local.pushNotifications}
              onChange={(e) => update('pushNotifications', e.target.checked)}
              size="small"
              disabled={!isBrowserPushSupported}
              inputProps={{ 'aria-label': 'Browser Push Notifications' }}
            />
          </Box>

          {/* Permission request */}
          {isBrowserPushSupported && browserPermission !== 'granted' && local.pushNotifications && (
            <Box sx={{ mt: 1 }}>
              {pushRequestStatus === 'denied' ? (
                <Alert severity="warning" icon={<PushOffIcon fontSize="small" />} sx={{ py: 0.5 }}>
                  Push notifications were blocked. Please update your browser settings to allow
                  them for this site.
                </Alert>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRequestPush}
                  disabled={pushRequestStatus === 'requesting'}
                  sx={{ mt: 0.5, fontSize: '0.75rem', textTransform: 'none' }}
                >
                  {pushRequestStatus === 'requesting'
                    ? 'Requesting permission…'
                    : 'Enable browser push'}
                </Button>
              )}
            </Box>
          )}
          {pushRequestStatus === 'granted' && (
            <Alert severity="success" sx={{ mt: 1, py: 0.5 }}>
              Browser push notifications enabled!
            </Alert>
          )}

          {!isBrowserPushSupported && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              Your browser does not support push notifications.
            </Typography>
          )}
        </Box>

        <ToggleRow
          label="Mobile Push Notifications"
          description="Receive notifications on your mobile device"
          checked={local.mobilePush}
          onChange={(v) => update('mobilePush', v)}
        />

        <Divider sx={{ my: 2 }} />

        {/* ── Sound ──────────────────────────────────────────────────── */}
        <SectionHeader
          icon={<SoundIcon />}
          title="Sound Alerts"
        />
        <ToggleRow
          label="Play sound for notifications"
          description="A short audio tone for new in-app notifications"
          checked={local.soundEnabled}
          onChange={(v) => update('soundEnabled', v)}
        />

        <Divider sx={{ my: 2 }} />

        {/* ── Quiet Hours ────────────────────────────────────────────── */}
        <SectionHeader
          icon={<QuietHoursIcon />}
          title="Quiet Hours"
          description="Suppress non-urgent notifications during specified times"
        />

        <ToggleRow
          label="Enable Quiet Hours"
          checked={local.quietHoursEnabled}
          onChange={(v) => update('quietHoursEnabled', v)}
        />

        {local.quietHoursEnabled && (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mt: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <TextField
              label="From"
              type="time"
              size="small"
              value={local.quietHoursStart}
              onChange={(e) => update('quietHoursStart', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'Quiet hours start time' }}
              sx={{ flex: 1, minWidth: 120 }}
            />
            <TextField
              label="Until"
              type="time"
              size="small"
              value={local.quietHoursEnd}
              onChange={(e) => update('quietHoursEnd', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'Quiet hours end time' }}
              sx={{ flex: 1, minWidth: 120 }}
            />
          </Box>
        )}
        {local.quietHoursEnabled && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Fraud alerts are always delivered, even during quiet hours.
          </Typography>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        {onClose && (
          <Button
            size="small"
            variant="text"
            onClick={onClose}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          sx={{ textTransform: 'none' }}
        >
          Save Preferences
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationPreferences;
