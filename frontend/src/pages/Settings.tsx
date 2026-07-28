import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  Drawer,
  IconButton,
  Badge,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import AccountSettings from '../components/settings/AccountSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import ApiKeysSettings from '../components/settings/ApiKeysSettings';
import AccessibleTabPanel from '../components/a11y/AccessibleTabPanel';
import { MobileBottomNav } from '../components/mobile';
import UndoRedoButtons from '../components/UndoRedoButtons';
import ActionHistory from '../components/ActionHistory';
import { useUndoRedoContext } from '../contexts/UndoRedoContext';

interface SettingsPageProps {
  user: {
    id: number;
    email: string;
    name?: string;
    avatar?: string;
    role?: string;
    language?: string;
    theme?: 'light' | 'dark' | 'system';
  };
  notificationPreferences?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    transactionAlerts?: boolean;
    scoreChanges?: boolean;
    marketingEmails?: boolean;
    securityAlerts?: boolean;
    weeklyReport?: boolean;
    priceAlerts?: boolean;
  };
  securitySettings?: {
    twoFactorEnabled?: boolean;
    sessions?: Array<{
      id: string;
      device: string;
      location: string;
      lastActive: string;
      current?: boolean;
    }>;
    loginHistory?: Array<{
      id: string;
      date: string;
      device: string;
      location: string;
      status: 'success' | 'failed';
    }>;
  };
  apiKeys?: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed: string | null;
    permissions: string[];
  }>;
  onUpdateAccount: (data: { email?: string; name?: string; language?: string; theme?: string }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onUpdateNotificationPreferences: (data: Record<string, boolean>) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onEnableTwoFactor: () => Promise<void>;
  onDisableTwoFactor: () => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeAllSessions: () => Promise<void>;
  onCreateApiKey: (name: string, permissions: string[]) => Promise<{ key: string }>;
  onDeleteApiKey: (id: string) => Promise<void>;
  onRegenerateApiKey: (id: string) => Promise<{ key: string }>;
}

export const Settings: React.FC<SettingsPageProps> = ({
  user,
  notificationPreferences = {},
  securitySettings = {},
  apiKeys = [],
  onUpdateAccount,
  onDeleteAccount,
  onUpdateNotificationPreferences,
  onChangePassword,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onRevokeSession,
  onRevokeAllSessions,
  onCreateApiKey,
  onDeleteApiKey,
  onRegenerateApiKey
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { undoStack } = useUndoRedoContext();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: { xs: 2, md: 4 },
        pb: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 4 },
        overflowX: 'hidden',
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/" underline="hover" color="inherit">
            Dashboard
          </Link>
          <Typography color="text.primary">Settings</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon sx={{ fontSize: { xs: 28, md: 32 }, color: 'text.primary' }} />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                fontSize: { xs: '1.5rem', md: '2.125rem' },
              }}
            >
              Settings
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <UndoRedoButtons />
            <IconButton
              size="small"
              onClick={() => setHistoryOpen(true)}
              aria-label="Action history"
            >
              <Badge badgeContent={undoStack.length} color="primary" max={99}>
                <HistoryIcon />
              </Badge>
            </IconButton>
          </Box>
        </Box>

        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Settings sections"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 64
              }
            }}
          >
            <Tab
              icon={<PersonIcon />}
              iconPosition="start"
              label="Account"
              id="settings-tab-0"
              aria-controls="settings-panel-0"
            />
            <Tab
              icon={<NotificationsIcon />}
              iconPosition="start"
              label="Notifications"
              id="settings-tab-1"
              aria-controls="settings-panel-1"
            />
            <Tab
              icon={<SecurityIcon />}
              iconPosition="start"
              label="Security"
              id="settings-tab-2"
              aria-controls="settings-panel-2"
            />
            <Tab
              icon={<VpnKeyIcon />}
              iconPosition="start"
              label="API Keys"
              id="settings-tab-3"
              aria-controls="settings-panel-3"
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            <AccessibleTabPanel value={activeTab} index={0} idPrefix="settings">
              <AccountSettings
                user={user}
                onUpdateAccount={onUpdateAccount}
                onDeleteAccount={onDeleteAccount}
              />
            </AccessibleTabPanel>

            <AccessibleTabPanel value={activeTab} index={1} idPrefix="settings">
              <NotificationSettings
                preferences={notificationPreferences}
                onUpdatePreferences={onUpdateNotificationPreferences}
              />
            </AccessibleTabPanel>

            <AccessibleTabPanel value={activeTab} index={2} idPrefix="settings">
              <SecuritySettings
                twoFactorEnabled={securitySettings.twoFactorEnabled}
                sessions={securitySettings.sessions}
                loginHistory={securitySettings.loginHistory}
                onChangePassword={onChangePassword}
                onEnableTwoFactor={onEnableTwoFactor}
                onDisableTwoFactor={onDisableTwoFactor}
                onRevokeSession={onRevokeSession}
                onRevokeAllSessions={onRevokeAllSessions}
              />
            </AccessibleTabPanel>

            <AccessibleTabPanel value={activeTab} index={3} idPrefix="settings">
              <ApiKeysSettings
                apiKeys={apiKeys}
                onCreateApiKey={onCreateApiKey}
                onDeleteApiKey={onDeleteApiKey}
                onRegenerateApiKey={onRegenerateApiKey}
              />
            </AccessibleTabPanel>
          </Box>
        </Paper>
      </Box>
      <Drawer
        anchor="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{ sx: { width: 320, maxWidth: '100vw' } }}
      >
        <ActionHistory />
      </Drawer>
      <MobileBottomNav />
    </Box>
  );
};

export default Settings;
