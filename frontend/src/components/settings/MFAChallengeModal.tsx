import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
  Link,
} from '@mui/material';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

interface MFAChallengeModalProps {
  open: boolean;
  onVerified: () => void;
  onClose: () => void;
}

export const MFAChallengeModal: React.FC<MFAChallengeModalProps> = ({
  open,
  onVerified,
  onClose,
}) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (useBackupCode) {
        await axios.post(
          `${API_BASE}/auth/mfa/verify`,
          { token, isBackupCode: true },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } else {
        await axios.post(
          `${API_BASE}/auth/mfa/challenge`,
          { token },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      }
      onVerified();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecovery = async () => {
    setLoading(true);
    setError('');
    try {
      const accessToken = localStorage.getItem('accessToken');
      await axios.post(
        `${API_BASE}/auth/mfa/recovery/send`,
        { recoveryEmail },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRecoverySent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send recovery email');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setToken('');
      setError('');
      setUseBackupCode(false);
      setUseRecovery(false);
      setRecoverySent(false);
      setRecoveryEmail('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {useRecovery ? 'Account Recovery' : 'Two-Factor Authentication'}
      </DialogTitle>
      <DialogContent>
        {!useRecovery && (
          <>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {useBackupCode
                ? 'Enter one of your backup codes to access your account.'
                : 'Enter the verification code from your authenticator app.'}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              variant="outlined"
              label={useBackupCode ? 'Backup Code' : 'Verification Code'}
              value={token}
              onChange={(e) =>
                useBackupCode
                  ? setToken(e.target.value)
                  : setToken(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder={useBackupCode ? 'XXXX-XXXX-XXXX' : '000000'}
              sx={{ my: 2 }}
              inputProps={{
                style: {
                  fontSize: '1.5rem',
                  letterSpacing: useBackupCode ? 4 : 8,
                  textAlign: 'center',
                  fontFamily: useBackupCode ? 'monospace' : 'inherit',
                },
              }}
            />

            <Box display="flex" justifyContent="center" gap={2} mt={1}>
              <Link
                component="button"
                variant="body2"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setToken('');
                  setError('');
                }}
              >
                {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
              </Link>
            </Box>
          </>
        )}

        {useRecovery && !recoverySent && (
          <>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Enter your recovery email address to receive a recovery link.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              variant="outlined"
              label="Recovery Email"
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              sx={{ my: 2 }}
            />
          </>
        )}

        {recoverySent && (
          <Alert severity="success">
            Recovery email has been sent. Please check your inbox and follow the instructions.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Box>
          {!useRecovery && (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setUseRecovery(true);
                setToken('');
                setError('');
              }}
            >
              Lost access?
            </Link>
          )}
          {useRecovery && !recoverySent && (
            <Link
              component="button"
              variant="body2"
              onClick={() => {
                setUseRecovery(false);
                setError('');
              }}
            >
              Back to verification
            </Link>
          )}
        </Box>
        <Box display="flex" gap={1}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {!useRecovery && (
            <Button
              variant="contained"
              onClick={handleVerify}
              disabled={token.length === 0 || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          )}
          {useRecovery && !recoverySent && (
            <Button
              variant="contained"
              onClick={handleSendRecovery}
              disabled={!recoveryEmail || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Send Recovery Email'}
            </Button>
          )}
          {recoverySent && (
            <Button variant="contained" onClick={handleClose}>
              Close
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default MFAChallengeModal;