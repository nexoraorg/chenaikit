import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export const MFARecovery: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const userId = searchParams.get('userId') || '';

  const [step, setStep] = useState<'enter_email' | 'verify_token' | 'complete'>('enter_email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRequestRecovery = async () => {
    setLoading(true);
    setError('');
    try {
      const accessToken = localStorage.getItem('accessToken');
      await axios.post(
        `${API_BASE}/auth/mfa/recovery/send`,
        { recoveryEmail: email },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setMessage('Recovery email sent. Check your inbox for the recovery link.');
      setStep('verify_token');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send recovery email');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRecovery = async () => {
    setLoading(true);
    setError('');
    try {
      const accessToken = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_BASE}/auth/mfa/setup`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setNewSecret(res.data.secret);
      setQrCodeUrl(res.data.qrCodeUrl);
      setBackupCodes(res.data.backupCodes);

      // Complete recovery with the new secret
      await axios.post(
        `${API_BASE}/auth/mfa/recovery/complete`,
        { token, userId, newSecret: res.data.secret },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      setStep('complete');
      setMessage('MFA has been reset successfully. Please set up your authenticator app again.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete recovery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={500} mx="auto" mt={8} p={2}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          MFA Recovery
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {step === 'enter_email' && (
          <>
            <Typography variant="body1" gutterBottom>
              Enter your recovery email address to receive a recovery link.
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              label="Recovery Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ my: 2 }}
            />
            <Box display="flex" justifyContent="space-between">
              <Button onClick={() => navigate('/settings/security/mfa')}>Back</Button>
              <Button
                variant="contained"
                onClick={handleRequestRecovery}
                disabled={!email || loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Send Recovery Email'}
              </Button>
            </Box>
          </>
        )}

        {step === 'verify_token' && (
          <>
            <Typography variant="body1" gutterBottom>
              Click the button below to complete the recovery process and set up a new authenticator.
            </Typography>
            <Box display="flex" justifyContent="center" mt={2}>
              <Button
                variant="contained"
                onClick={handleCompleteRecovery}
                disabled={loading}
                size="large"
              >
                {loading ? <CircularProgress size={24} /> : 'Complete Recovery'}
              </Button>
            </Box>
          </>
        )}

        {step === 'complete' && (
          <>
            <Typography variant="h6" gutterBottom>
              New Backup Codes
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Save these backup codes. Each code can be used only once.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                my: 2,
              }}
            >
              {backupCodes.map((code, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1,
                    border: '1px solid',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    bgcolor: 'grey.50',
                  }}
                >
                  {code}
                </Box>
              ))}
            </Box>
            <Box display="flex" justifyContent="center">
              <Button variant="contained" onClick={() => navigate('/settings/security/mfa')}>
                Go to Security Settings
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default MFARecovery;