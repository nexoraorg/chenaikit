import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  History as HistoryIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import ProfileHeader from '../components/profile/ProfileHeader';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime, formatNumber } from '../i18n/config';

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

interface ActivityItem {
  id: string;
  type: 'transaction' | 'score_change' | 'alert' | 'login';
  title: string;
  description: string;
  timestamp: string;
}

interface ProfilePageProps {
  user: {
    id: number;
    email: string;
    name?: string;
    avatar?: string;
    role?: string;
    createdAt?: string;
  };
  stats?: {
    transactions?: number;
    score?: number;
    activeDays?: number;
  };
  activity?: ActivityItem[];
  onUpdateProfile: (data: { name?: string; avatar?: string }) => Promise<void>;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'transaction':
      return <CreditCardIcon color="primary" />;
    case 'score_change':
      return <TrendingUpIcon color="success" />;
    case 'alert':
      return <WarningIcon color="warning" />;
    case 'login':
      return <HistoryIcon color="info" />;
    default:
      return <HistoryIcon />;
  }
};

export const Profile: React.FC<ProfilePageProps> = ({
  user,
  stats = {},
  activity = [],
  onUpdateProfile
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <ProfileHeader user={user} stats={stats} onUpdateProfile={onUpdateProfile} />

        <Paper sx={{ mt: 3, borderRadius: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            aria-label="Profile sections"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none'
              }
            }}
          >
            <Tab label={t('profile.activity')} />
            <Tab label={t('profile.account')} />
            <Tab label={t('profile.statistics')} />
          </Tabs>

          <Box sx={{ p: 3 }}>
            <AccessibleTabPanel value={activeTab} index={0} idPrefix="profile">
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
                {t('profile.recentActivity')}
              </Typography>
              {activity.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {t('profile.noActivity')}
                  </Typography>
                </Box>
              ) : (
                <List>
                  {activity.map((item) => (
                      <ListItem
                        key={item.id}
                        sx={{
                          borderBottom: 1,
                          borderColor: 'divider',
                          py: 2,
                          '&:last-child': { borderBottom: 'none' }
                        }}
                      >
                        <ListItemIcon>{getActivityIcon(item.type)}</ListItemIcon>
                        <ListItemText
                          primary={item.title}
                          secondary={
                            <Box component="span">
                              <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>
                                {item.description}
                              </Typography>
                              <Typography
                                variant="caption"
                                component="span"
                                sx={{ display: 'block', color: 'text.disabled', mt: 0.5 }}
                              >
                                {formatDateTime(item.timestamp)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                  ))}
                </List>
              )}
            </AccessibleTabPanel>

            <AccessibleTabPanel value={activeTab} index={1} idPrefix="profile">
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        {t('profile.accountInformation', { defaultValue: 'Account Information' })}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('profile.email')}
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {user.email}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('profile.role')}
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                            {t('profile.roleName.' + (user.role || 'user'), { defaultValue: user.role || 'User' })}
                          </Typography>
                        </Box>
                        {user.createdAt && (
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t('profile.memberSince')}
                          </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {formatDate(user.createdAt)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        {t('profile.securityStatus')}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">{t('profile.twoFactorEnabled')}</Typography>
                          <Chip label={t('common.disabled')} size="small" color="default" />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">{t('profile.passwordSet')}</Typography>
                          <Chip label={t('settings.set', { defaultValue: 'Set' })} size="small" color="success" />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">{t('profile.activeSessions')}</Typography>
                          <Chip label="1" size="small" color="primary" />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccessibleTabPanel>

            <AccessibleTabPanel value={activeTab} index={2} idPrefix="profile">
              <Grid container spacing={3}>
                {stats.transactions !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <CreditCardIcon sx={{ fontSize: 40, color: '#38bdf8', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {formatNumber(stats.transactions)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('dashboard.totalTransactions')}
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {stats.score !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <TrendingUpIcon sx={{ fontSize: 40, color: '#22c55e', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {formatNumber(stats.score)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('profile.creditScore')}
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {stats.activeDays !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <HistoryIcon sx={{ fontSize: 40, color: '#a855f7', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {formatNumber(stats.activeDays)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('profile.activeDays')}
                      </Typography>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </AccessibleTabPanel>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Profile;
