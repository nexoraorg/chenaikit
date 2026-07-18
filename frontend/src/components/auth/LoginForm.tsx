import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Checkbox, 
  FormControlLabel, 
  TextField, 
  Typography, 
  Alert, 
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Link as MuiLink
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Email, 
  Lock,
  Google,
  GitHub
} from '@mui/icons-material';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ValidationRules } from '@chenaikit/core';
import { useAuth } from './AuthContext';
import { useFormValidation } from '../../hooks/useFormValidation';

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit
  } = useFormValidation({
    initialValues: {
      email: '',
      password: ''
    },
    validationRules: {
      email: ValidationRules.email(t('forms.invalidEmail')),
      password: ValidationRules.required(t('forms.required'))
    },
    onSubmit: async (formValues) => {
      setSubmitError(null);
      try {
        await login(formValues.email, formValues.password, rememberMe);
        navigate(from, { replace: true });
      } catch (err: any) {
        setSubmitError(err.message || t('auth.loginError'));
      }
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  const handleSocialLogin = (platform: 'google' | 'github') => {
    window.location.assign(`/api/auth/oauth/${platform}`);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
          {t('auth.welcomeBack')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('auth.loginSubtitle')}
        </Typography>
      </Box>

      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            id="field-email"
            name="email"
            label={t('profile.email')}
            placeholder="name@example.com"
            value={values.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            error={!!(touched.email && errors.email)}
            helperText={touched.email && errors.email}
            disabled={isSubmitting}
            required
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email sx={{ color: '#94a3b8' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}
          />

          <TextField
            id="field-password"
            name="password"
            label={t('settings.changePassword')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={values.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            error={!!(touched.password && errors.password)}
            helperText={touched.password && errors.password}
            disabled={isSubmitting}
            required
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#94a3b8' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -0.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  color="primary"
                  sx={{ borderRadius: '4px' }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'text.secondary', userSelect: 'none' }}>
                  {t('auth.rememberMe')}
                </Typography>
              }
            />
            <MuiLink
              component={Link}
              to="/forgot-password"
              variant="body2"
              sx={{ 
                color: 'primary.main', 
                textDecoration: 'none', 
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {t('auth.forgotPassword')}
            </MuiLink>
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !isValid}
            fullWidth
            sx={{
              py: 1.5,
              borderRadius: '10px',
              textTransform: 'none',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: (theme) => theme.shadows[4],
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              t('auth.signIn')
            )}
          </Button>

          <Divider sx={{ my: 1.5, color: 'text.disabled' }}>
            <Typography variant="caption" sx={{ px: 1, color: 'text.secondary', fontWeight: 500 }}>
              {t('auth.orContinueWith')}
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => handleSocialLogin('google')}
              fullWidth
              startIcon={<Google />}
              sx={{
                py: 1.2,
                borderRadius: '10px',
                borderColor: 'divider',
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: 'action.hover',
                  backgroundColor: 'action.hover'
                }
              }}
            >
              Google
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSocialLogin('github')}
              fullWidth
              startIcon={<GitHub />}
              sx={{
                py: 1.2,
                borderRadius: '10px',
                borderColor: 'divider',
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: 'action.hover',
                  backgroundColor: 'action.hover'
                }
              }}
            >
              GitHub
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('auth.dontHaveAccount')}{' '}
              <MuiLink
                component={Link}
                to="/signup"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                {t('auth.signUp')}
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default LoginForm;
