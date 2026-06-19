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
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <ProfileHeader user={user} stats={stats} onUpdateProfile={onUpdateProfile} />

        <Paper sx={{ mt: 3, borderRadius: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid #e5e7eb',
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none'
              }
            }}
          >
            <Tab label="Activity" />
            <Tab label="Account" />
            <Tab label="Statistics" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            <TabPanel value={activeTab} index={0}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#0f172a' }}>
                Recent Activity
              </Typography>
              {activity.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <HistoryIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#64748b' }}>
                    No recent activity
                  </Typography>
                </Box>
              ) : (
                <List>
                  {activity.map((item) => (
                    <ListItem
                      key={item.id}
                      sx={{
                        borderBottom: '1px solid #f1f5f9',
                        py: 2,
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      <ListItemIcon>{getActivityIcon(item.type)}</ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        secondary={
                          <Box component="span">
                            <Typography variant="body2" component="span" sx={{ color: '#475569' }}>
                              {item.description}
                            </Typography>
                            <Typography
                              variant="caption"
                              component="span"
                              sx={{ display: 'block', color: '#94a3b8', mt: 0.5 }}
                            >
                              {new Date(item.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        Account Information
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Email
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {user.email}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Role
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                            {user.role || 'User'}
                          </Typography>
                        </Box>
                        {user.createdAt && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Member Since
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {new Date(user.createdAt).toLocaleDateString()}
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
                        Security Status
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">Two-Factor Auth</Typography>
                          <Chip label="Disabled" size="small" color="default" />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">Password</Typography>
                          <Chip label="Set" size="small" color="success" />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">Active Sessions</Typography>
                          <Chip label="1" size="small" color="primary" />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Grid container spacing={3}>
                {stats.transactions !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <CreditCardIcon sx={{ fontSize: 40, color: '#38bdf8', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {stats.transactions.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Total Transactions
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {stats.score !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <TrendingUpIcon sx={{ fontSize: 40, color: '#22c55e', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {stats.score}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Credit Score
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {stats.activeDays !== undefined && (
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', p: 3 }}>
                      <HistoryIcon sx={{ fontSize: 40, color: '#a855f7', mb: 1 }} />
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {stats.activeDays}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Active Days
                      </Typography>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </TabPanel>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Profile;
