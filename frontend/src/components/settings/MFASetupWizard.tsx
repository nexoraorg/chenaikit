import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const STEPS = ['Scan QR Code', 'Enter Code', 'Save Backup Codes'];

interface BackupCode {
  code: string;
  revealed: boolean;
}

export const MFASetupWizard: React.FC<{ onComplete: () => void; onCancel: () => void }> = ({
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_BASE}/auth/mfa/setup`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSecret(res.data.secret);
      setQrCodeUrl(res.data.qrCodeUrl);
      setBackupCodes(res.data.backupCodes.map((c: string) => ({ code: c, revealed: false })));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start MFA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${API_BASE}/auth/mfa/verify`,
        { token: verificationCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.map((c) => c.code).join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const revealCode = (index: number) => {
    const updated = [...backupCodes];
    updated[index] = { ...updated[index], revealed: true };
    setBackupCodes(updated);
  };

  React.useEffect(() => {
    startSetup();
  }, []);

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Set Up Two-Factor Authentication
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && activeStep === 0 && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}

      {activeStep === 0 && qrCodeUrl && (
        <Box textAlign="center">
          <Typography variant="body1" gutterBottom>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </Typography>
          <Box my={3} display="flex" justifyContent="center">
            <QRCodeSVG value={qrCodeUrl} size={220} level="H" />
          </Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Or enter this key manually:
          </Typography>
          <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                bgcolor: 'grey.100',
                p: 1,
                borderRadius: 1,
                fontSize: '0.75rem',
                wordBreak: 'break-all',
                maxWidth: 300,
              }}
            >
              {secret}
            </Typography>
            <Tooltip title="Copy secret key">
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(secret)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="contained" onClick={() => setActiveStep(1)}>
              I've scanned the code
            </Button>
          </Box>
        </Box>
      )}

      {activeStep === 1 && (
        <Box>
          <Typography variant="body1" gutterBottom>
            Enter the 6-digit verification code from your authenticator app
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            label="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            sx={{ my: 2 }}
            inputProps={{ style: { fontSize: '1.5rem', letterSpacing: 8, textAlign: 'center' } }}
          />
          <Box display="flex" justifyContent="space-between">
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button variant="contained" onClick={verifyCode} disabled={verificationCode.length !== 6 || loading}>
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          </Box>
        </Box>
      )}

      {activeStep === 2 && (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
            Two-factor authentication has been enabled successfully!
          </Alert>
          <Typography variant="h6" gutterBottom>
            Backup Codes
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Save these backup codes in a secure location. Each code can be used only once if you lose access to your authenticator app.
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
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  bgcolor: code.revealed ? 'grey.50' : 'grey.100',
                  '&:hover': { bgcolor: 'grey.200' },
                }}
                onClick={() => revealCode(index)}
              >
                {code.revealed ? code.code : '••••••••••••'}
              </Box>
            ))}
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button onClick={handleCopyBackupCodes} startIcon={<ContentCopyIcon />}>
              {copied ? 'Copied!' : 'Copy All'}
            </Button>
            <Box display="flex" gap={1}>
              <Button onClick={onCancel}>Close</Button>
              <Button variant="contained" onClick={onComplete}>
                Done
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default MFASetupWizard;