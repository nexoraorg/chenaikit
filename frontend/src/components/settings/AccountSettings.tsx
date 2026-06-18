import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { useFormValidation } from '../../hooks/useFormValidation';
import { ValidationRules } from '@chenaikit/core';

interface AccountSettingsProps {
  user: {
    email: string;
    name?: string;
    language?: string;
    theme?: 'light' | 'dark' | 'system';
  };
  onUpdateAccount: (data: { email?: string; name?: string; language?: string; theme?: string }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onUpdateAccount,
  onDeleteAccount
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');

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
      name: user.name || '',
      email: user.email
    },
    validationRules: {
      email: ValidationRules.email(),
      name: ValidationRules.minLength(2, 'Name must be at least 2 characters')
    },
    onSubmit: async (formValues) => {
      setIsSaving(true);
      setSaveSuccess(false);
      try {
        await onUpdateAccount(formValues);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } finally {
        setIsSaving(false);
      }
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  const handleDeleteAccount = async () => {
    if (deleteEmail !== user.email) return;
    setIsSaving(true);
    try {
      await onDeleteAccount();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
            Profile Information
          </Typography>

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Profile updated successfully!
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Display Name"
                  name="name"
                  value={values.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  error={touched.name && !!errors.name}
                  helperText={touched.name && errors.name}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  error={touched.email && !!errors.email}
                  helperText={touched.email && errors.email}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    select
                    fullWidth
                    label="Language"
                    name="language"
                    value={user.language || 'en'}
                    onChange={(e) => handleChange('language', e.target.value)}
                    SelectProps={{ native: true }}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="zh">中文</option>
                    <option value="ar">العربية</option>
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    label="Theme"
                    name="theme"
                    value={user.theme || 'system'}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    SelectProps={{ native: true }}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </TextField>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSaving || !isValid}
                  startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'error.main' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'error.main' }}>
            Danger Zone
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
            Once you delete your account, there is no going back. Please be certain.
          </Typography>

          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {deleteConfirmOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <Box
            sx={{
              backgroundColor: 'white',
              borderRadius: 2,
              p: 4,
              maxWidth: 400,
              width: '100%',
              mx: 2
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'error.main' }}>
              Delete Account
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#475569' }}>
              This action cannot be undone. To confirm, please type your email address:{' '}
              <strong>{user.email}</strong>
            </Typography>
            <TextField
              fullWidth
              label="Confirm Email"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              sx={{ mb: 3 }}
            />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={() => setDeleteConfirmOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={deleteEmail !== user.email || isSaving}
                onClick={handleDeleteAccount}
              >
                {isSaving ? 'Deleting...' : 'Delete Forever'}
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AccountSettings;
