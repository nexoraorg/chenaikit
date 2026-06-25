import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  Button
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import AccountSettings from '../components/settings/AccountSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import ApiKeysSettings from '../components/settings/ApiKeysSettings';
import { useShortcutContext } from '../contexts/ShortcutContext';
import { useShortcutLabel } from '../hooks/useKeyboardShortcuts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
);

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
  const { openHelp } = useShortcutContext();
  const shortcutSettingsLabel = useShortcutLabel('settings.shortcuts');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/" underline="hover" color="inherit">
            Dashboard
          </Link>
          <Typography color="text.primary">Settings</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <SettingsIcon sx={{ fontSize: 32, color: 'text.primary' }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Settings
          </Typography>
          <Button
            aria-keyshortcuts={shortcutSettingsLabel}
            onClick={openHelp}
            size="small"
            sx={{ ml: { xs: 0, sm: 'auto' } }}
            variant="outlined"
          >
            Keyboard Shortcuts ({shortcutSettingsLabel})
          </Button>
        </Box>

        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
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
            />
            <Tab
              icon={<NotificationsIcon />}
              iconPosition="start"
              label="Notifications"
            />
            <Tab
              icon={<SecurityIcon />}
              iconPosition="start"
              label="Security"
            />
            <Tab
              icon={<VpnKeyIcon />}
              iconPosition="start"
              label="API Keys"
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            <TabPanel value={activeTab} index={0}>
              <AccountSettings
                user={user}
                onUpdateAccount={onUpdateAccount}
                onDeleteAccount={onDeleteAccount}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <NotificationSettings
                preferences={notificationPreferences}
                onUpdatePreferences={onUpdateNotificationPreferences}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
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
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <ApiKeysSettings
                apiKeys={apiKeys}
                onCreateApiKey={onCreateApiKey}
                onDeleteApiKey={onDeleteApiKey}
                onRegenerateApiKey={onRegenerateApiKey}
              />
            </TabPanel>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Settings;
