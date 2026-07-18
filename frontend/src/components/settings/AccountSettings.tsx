import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useTranslation } from 'react-i18next';
import { ValidationRules } from '@chenaikit/core';
import { useThemeMode } from '../../contexts/ThemeContext';
import { changeLanguage } from '../../i18n/config';

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
  const { t } = useTranslation();
  const { setTheme } = useThemeMode();
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
      email: user.email,
      language: user.language || 'en',
      theme: user.theme || 'system'
    },
    validationRules: {
      email: ValidationRules.email(t('forms.invalidEmail')),
      name: ValidationRules.minLength(2, t('forms.minLength', { count: 2 }))
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

  useEffect(() => {
    if (values.theme === 'light' || values.theme === 'dark' || values.theme === 'system') {
      setTheme(values.theme);
    }
  }, [values.theme, setTheme]);

  useEffect(() => {
    if (values.language) {
      changeLanguage(values.language);
    }
  }, [values.language]);

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
            {t('profile.subtitle')}
          </Typography>

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {t('settings.profileUpdated')}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('profile.displayName')}
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
                  label={t('profile.email')}
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
                    label={t('settings.language')}
                    name="language"
                    value={values.language}
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
                    label={t('settings.theme')}
                    name="theme"
                    value={values.theme}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    SelectProps={{ native: true }}
                  >
                    <option value="light">{t('settings.light', { defaultValue: 'Light' })}</option>
                    <option value="dark">{t('settings.dark', { defaultValue: 'Dark' })}</option>
                    <option value="system">{t('settings.system', { defaultValue: 'System' })}</option>
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
                  {isSaving ? t('settings.saving') : t('common.save')}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'error.main' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'error.main' }}>
            {t('settings.dangerZone')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {t('settings.deleteAccountWarning')}
          </Typography>

          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            {t('settings.deleteAccount')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          {t('settings.deleteAccount')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            {t('settings.confirmDeleteEmail', { email: user.email })}
          </Typography>
          <TextField
            fullWidth
            label={t('settings.confirmEmail')}
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteEmail !== user.email || isSaving}
            onClick={handleDeleteAccount}
          >
            {isSaving ? t('settings.deleting') : t('settings.deleteForever')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountSettings;
