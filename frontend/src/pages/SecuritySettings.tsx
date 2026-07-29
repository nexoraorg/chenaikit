import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import KeyIcon from '@mui/icons-material/Key';
import axios from 'axios';
import { MFASetupWizard } from '../components/settings/MFASetupWizard';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

interface MFAStatus {
  mfaEnabled: boolean;
  recoveryEmail: string | null;
  lastVerifiedAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export const SecuritySettings: React.FC = () => {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMFAStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`${API_BASE}/auth/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMfaStatus(res.data);
      if (res.data.recoveryEmail) {
        setRecoveryEmail(res.data.recoveryEmail);
      }
    } catch (err) {
      // Ignore errors on status fetch
    }
  };

  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const handleDisableMFA = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${API_BASE}/auth/mfa/disable`,
        { password: disablePassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Two-factor authentication has been disabled.');
      setDisableDialogOpen(false);
      setDisablePassword('');
      fetchMFAStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_BASE}/auth/mfa/backup-codes/regenerate`,
        { password: disablePassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBackupCodes(res.data.backupCodes);
      setBackupDialogOpen(true);
      setSuccess('Backup codes regenerated successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecovery = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${API_BASE}/auth/mfa/recovery/send`,
        { recoveryEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Recovery email sent successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send recovery email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={700} mx="auto" mt={4} p={2}>
      <Typography variant="h4" gutterBottom>
        Security Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* MFA Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">Two-Factor Authentication (MFA)</Typography>
          {mfaStatus?.mfaEnabled && (
            <Chip label="Enabled" color="success" size="small" />
          )}
        </Box>

        <Typography variant="body2" color="textSecondary" gutterBottom>
          Add an extra layer of security to your account by requiring a verification code
          from your authenticator app in addition to your password.
        </Typography>

        {mfaStatus?.lockedUntil && new Date(mfaStatus.lockedUntil) > new Date() && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Account is locked until {new Date(mfaStatus.lockedUntil).toLocaleString()} due to
            too many failed MFA attempts.
          </Alert>
        )}

        {!mfaStatus?.mfaEnabled && !showSetupWizard && (
          <Box mt={2}>
            <Button
              variant="contained"
              onClick={() => setShowSetupWizard(true)}
              startIcon={<SecurityIcon />}
            >
              Enable Two-Factor Authentication
            </Button>
          </Box>
        )}

        {showSetupWizard && (
          <MFASetupWizard
            onComplete={() => {
              setShowSetupWizard(false);
              setSuccess('Two-factor authentication has been enabled!');
              fetchMFAStatus();
            }}
            onCancel={() => setShowSetupWizard(false)}
          />
        )}

        {mfaStatus?.mfaEnabled && !showSetupWizard && (
          <Box mt={2}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDisableDialogOpen(true)}
              >
                Disable Two-Factor Authentication
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setDisablePassword('');
                  handleRegenerateBackupCodes();
                }}
                startIcon={<KeyIcon />}
              >
                Regenerate Backup Codes
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Recovery Email Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recovery Email
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Set a recovery email to receive MFA recovery links if you lose access to your
          authenticator app.
        </Typography>
        <Box display="flex" gap={2} alignItems="flex-end" mt={2}>
          <TextField
            label="Recovery Email"
            type="email"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            onClick={handleSendRecovery}
            disabled={!recoveryEmail || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Send Test Recovery'}
          </Button>
        </Box>
      </Paper>

      {/* Disable MFA Dialog */}
      <Dialog open={disableDialogOpen} onClose={() => setDisableDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Enter your password to confirm disabling two-factor authentication.
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            label="Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDisableMFA}
            disabled={!disablePassword || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Your New Backup Codes</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Store these codes in a secure location. Each code can only be used once.
          </Alert>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
            }}
          >
            {backupCodes.map((code, index) => (
              <Box
                key={index}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                }}
              >
                {code}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecuritySettings;