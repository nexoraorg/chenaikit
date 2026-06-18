import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  Lock as LockIcon,
  Smartphone as SmartphoneIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useFormValidation } from '../../hooks/useFormValidation';
import { ValidationRules } from '@chenaikit/core';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current?: boolean;
}

interface LoginHistory {
  id: string;
  date: string;
  device: string;
  location: string;
  status: 'success' | 'failed';
}

interface SecuritySettingsProps {
  twoFactorEnabled?: boolean;
  sessions?: Session[];
  loginHistory?: LoginHistory[];
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onEnableTwoFactor: () => Promise<void>;
  onDisableTwoFactor: () => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeAllSessions: () => Promise<void>;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  twoFactorEnabled = false,
  sessions = [],
  loginHistory = [],
  onChangePassword,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onRevokeSession,
  onRevokeAllSessions
}) => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordMatchError, setPasswordMatchError] = useState(false);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit
  } = useFormValidation({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    validationRules: {
      currentPassword: ValidationRules.required('Current password is required'),
      newPassword: ValidationRules.minLength(8, 'Password must be at least 8 characters'),
      confirmPassword: ValidationRules.required('Please confirm your password')
    },
    onSubmit: async (formValues: Record<string, string>) => {
      if (formValues.newPassword !== formValues.confirmPassword) {
        setPasswordMatchError(true);
        return;
      }
      setPasswordMatchError(false);
      setIsChangingPassword(true);
      setPasswordSuccess(false);
      try {
        await onChangePassword(formValues.currentPassword, formValues.newPassword);
        setPasswordSuccess(true);
      } finally {
        setIsChangingPassword(false);
      }
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  const handleTwoFactorToggle = async () => {
    if (twoFactorEnabled) {
      await onDisableTwoFactor();
    } else {
      setTwoFactorDialogOpen(true);
    }
  };

  const handleEnableTwoFactor = async () => {
    await onEnableTwoFactor();
    setTwoFactorDialogOpen(false);
  };

  const handleRevokeAllSessions = async () => {
    await onRevokeAllSessions();
    setRevokeAllDialogOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <LockIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Change Password
            </Typography>
          </Box>

          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Password changed successfully!
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={values.currentPassword}
                  onChange={(e) => handleChange('currentPassword', e.target.value)}
                  onBlur={() => handleBlur('currentPassword')}
                  error={touched.currentPassword && !!errors.currentPassword}
                  helperText={touched.currentPassword && errors.currentPassword}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setShowCurrentPassword(!showCurrentPassword)} edge="end">
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="New Password"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={values.newPassword}
                  onChange={(e) => handleChange('newPassword', e.target.value)}
                  onBlur={() => handleBlur('newPassword')}
                  error={touched.newPassword && !!errors.newPassword}
                  helperText={touched.newPassword && errors.newPassword}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={values.confirmPassword}
                  onChange={(e) => {
                    handleChange('confirmPassword', e.target.value);
                    setPasswordMatchError(false);
                  }}
                  onBlur={() => handleBlur('confirmPassword')}
                  error={(touched.confirmPassword && !!errors.confirmPassword) || passwordMatchError}
                  helperText={(touched.confirmPassword && errors.confirmPassword) || (passwordMatchError ? 'Passwords do not match' : '')}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isChangingPassword || !isValid}
                  startIcon={isChangingPassword ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SmartphoneIcon color="primary" />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Two-Factor Authentication
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Add an extra layer of security to your account
                </Typography>
              </Box>
            </Box>
            <Chip
              label={twoFactorEnabled ? 'Enabled' : 'Disabled'}
              color={twoFactorEnabled ? 'success' : 'default'}
              onClick={handleTwoFactorToggle}
              sx={{ cursor: 'pointer' }}
            />
          </Box>

          {!twoFactorEnabled && (
            <Button variant="outlined" onClick={() => setTwoFactorDialogOpen(true)}>
              Enable 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <HistoryIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Active Sessions
              </Typography>
            </Box>
            {sessions.length > 1 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setRevokeAllDialogOpen(true)}
              >
                Revoke All Others
              </Button>
            )}
          </Box>

          {sessions.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              No active sessions
            </Typography>
          ) : (
            <List>
              {sessions.map((session) => (
                <ListItem
                  key={session.id}
                  sx={{
                    borderBottom: '1px solid #f1f5f9',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                  secondaryAction={
                    !session.current && (
                      <IconButton
                        edge="end"
                        onClick={() => {
                          setRevokingSessionId(session.id);
                          onRevokeSession(session.id).finally(() => setRevokingSessionId(null));
                        }}
                        disabled={revokingSessionId === session.id}
                        title="Revoke session"
                      >
                        {revokingSessionId === session.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                      </IconButton>
                    )
                  }
                >
                  <ListItemIcon>
                    <SmartphoneIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {session.device}
                        {session.current && (
                          <Chip label="Current" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={`${session.location} • Last active: ${session.lastActive}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Login History
            </Typography>
          </Box>

          {loginHistory.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              No login history available
            </Typography>
          ) : (
            <List>
              {loginHistory.slice(0, 5).map((login) => (
                <ListItem
                  key={login.id}
                  sx={{
                    borderBottom: '1px solid #f1f5f9',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <ListItemIcon>
                    <HistoryIcon color={login.status === 'success' ? 'success' : 'error'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${login.device} - ${login.status === 'success' ? 'Successful' : 'Failed'}`}
                    secondary={`${login.location} • ${login.date}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={twoFactorDialogOpen} onClose={() => setTwoFactorDialogOpen(false)}>
        <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Two-factor authentication adds an extra layer of security to your account. You'll need to download an authenticator app on your phone.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            This feature requires integration with your backend API.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTwoFactorDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEnableTwoFactor}>
            Continue Setup
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={revokeAllDialogOpen} onClose={() => setRevokeAllDialogOpen(false)}>
        <DialogTitle>Revoke All Other Sessions</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to revoke all other active sessions? You will be logged out on all devices except the current one.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeAllDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRevokeAllSessions}>
            Revoke All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecuritySettings;
