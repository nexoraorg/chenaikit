import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';

interface NotificationSettingsProps {
  preferences: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    transactionAlerts?: boolean;
    scoreChanges?: boolean;
    marketingEmails?: boolean;
    securityAlerts?: boolean;
    weeklyReport?: boolean;
    priceAlerts?: boolean;
  };
  onUpdatePreferences: (data: Record<string, boolean>) => Promise<void>;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences = {},
  onUpdatePreferences
}) => {
  const [localPrefs, setLocalPrefs] = useState({
    emailNotifications: preferences.emailNotifications ?? true,
    pushNotifications: preferences.pushNotifications ?? true,
    transactionAlerts: preferences.transactionAlerts ?? true,
    scoreChanges: preferences.scoreChanges ?? true,
    marketingEmails: preferences.marketingEmails ?? false,
    securityAlerts: preferences.securityAlerts ?? true,
    weeklyReport: preferences.weeklyReport ?? false,
    priceAlerts: preferences.priceAlerts ?? true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalPrefs({
      emailNotifications: preferences.emailNotifications ?? true,
      pushNotifications: preferences.pushNotifications ?? true,
      transactionAlerts: preferences.transactionAlerts ?? true,
      scoreChanges: preferences.scoreChanges ?? true,
      marketingEmails: preferences.marketingEmails ?? false,
      securityAlerts: preferences.securityAlerts ?? true,
      weeklyReport: preferences.weeklyReport ?? false,
      priceAlerts: preferences.priceAlerts ?? true
    });
  }, [preferences]);

  const handleToggle = (key: keyof typeof localPrefs) => {
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    const previousPrefs = { ...localPrefs };
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdatePreferences(localPrefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setLocalPrefs(previousPrefs);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Notification Preferences
            </Typography>
          </Box>

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Notification preferences updated!
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                />
              }
              label="Email Notifications"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Receive notifications via email
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.pushNotifications}
                  onChange={() => handleToggle('pushNotifications')}
                />
              }
              label="Push Notifications"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Receive push notifications in your browser
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.transactionAlerts}
                  onChange={() => handleToggle('transactionAlerts')}
                />
              }
              label="Transaction Alerts"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Get notified about new transactions
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.scoreChanges}
                  onChange={() => handleToggle('scoreChanges')}
                />
              }
              label="Score Changes"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Notifications when your credit score changes
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.priceAlerts}
                  onChange={() => handleToggle('priceAlerts')}
                />
              }
              label="Price Alerts"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Alerts for cryptocurrency price changes
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.securityAlerts}
                  onChange={() => handleToggle('securityAlerts')}
                />
              }
              label="Security Alerts"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Important security notifications (login attempts, password changes)
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.weeklyReport}
                  onChange={() => handleToggle('weeklyReport')}
                />
              }
              label="Weekly Report"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
              Receive a weekly summary of your activity
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.marketingEmails}
                  onChange={() => handleToggle('marketingEmails')}
                />
              }
              label="Marketing Emails"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 6 }}>
              Product updates, promotions, and newsletters
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationSettings;
