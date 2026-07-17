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
  LinearProgress,
  Link as MuiLink
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Email, 
  Lock,
  CheckCircleOutline
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ValidationRules } from '@chenaikit/core';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useAuth } from './AuthContext';

interface PasswordStrength {
  score: number;
  textKey: string;
  color: string;
}

const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return { score: 0, textKey: '', color: '#e2e8f0' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 33, textKey: 'auth.weak', color: '#f87171' };
  if (score <= 4) return { score: 66, textKey: 'auth.medium', color: '#fbbf24' };
  return { score: 100, textKey: 'auth.strong', color: '#34d399' };
};

export const SignupForm: React.FC = () => {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    setError
  } = useFormValidation({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationRules: {
      email: ValidationRules.email(t('forms.invalidEmail')),
      password: ValidationRules.minLength(8, t('forms.minLength', { count: 8 }))
    },
    onSubmit: async (formValues) => {
      setSubmitError(null);
      setTermsError(null);

      if (!acceptTerms) {
        setTermsError(t('auth.acceptTermsError'));
        return;
      }

      if (formValues.password !== formValues.confirmPassword) {
        setError('confirmPassword', t('forms.passwordMismatch'));
        return;
      }

      try {
        await register(formValues.email, formValues.password);
        setRegisteredEmail(formValues.email);
        setIsVerificationSent(true);
      } catch (err: any) {
        setSubmitError(err.message || t('auth.registerError'));
      }
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  const passwordStrength = getPasswordStrength(values.password);

  if (isVerificationSent) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CheckCircleOutline sx={{ fontSize: 72, color: '#34d399' }} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: 'text.primary' }}>
          {t('auth.accountCreated')}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, px: 2 }}>
          {t('auth.accountCreatedDesc', { email: registeredEmail })}
        </Typography>
        <Button
          component={Link}
          to="/login"
          variant="contained"
          sx={{
            py: 1.5,
            px: 4,
            borderRadius: '10px',
            textTransform: 'none',
            fontSize: '16px',
            fontWeight: 600,
          }}
        >
          {t('auth.goToSignIn')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
          {t('auth.createAccount')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('auth.signupSubtitle')}
        </Typography>
      </Box>

      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {submitError}
        </Alert>
      )}

      {termsError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {termsError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
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

          {values.password && (
            <Box sx={{ mt: -1, mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('auth.passwordStrength')}:
                </Typography>
                <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 700 }}>
                  {passwordStrength.textKey ? t(passwordStrength.textKey) : ''}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={passwordStrength.score} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: passwordStrength.color,
                    borderRadius: 3
                  }
                }} 
              />
            </Box>
          )}

          <TextField
            id="field-confirmPassword"
            name="confirmPassword"
            label={t('auth.confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={values.confirmPassword}
            onChange={(e) => {
              handleChange('confirmPassword', e.target.value);
              if (errors.confirmPassword) {
                setError('confirmPassword', '');
              }
            }}
            onBlur={() => handleBlur('confirmPassword')}
            error={!!(touched.confirmPassword && errors.confirmPassword)}
            helperText={touched.confirmPassword && errors.confirmPassword}
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
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                color="primary"
                sx={{ borderRadius: '4px' }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: 'text.secondary', userSelect: 'none' }}>
                {t('auth.iAgreeTo')}{' '}
                <MuiLink 
                  component={Link}
                  to="/terms"
                  sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                >
                  {t('app.termsTitle')}
                </MuiLink>{' '}
                {t('auth.and')}{' '}
                <MuiLink 
                  component={Link}
                  to="/privacy"
                  sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                >
                  {t('app.privacyTitle')}
                </MuiLink>
              </Typography>
            }
            sx={{ mt: -0.5 }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !isValid || !acceptTerms}
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
              t('auth.signUp')
            )}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('auth.alreadyHaveAccount')}{' '}
              <MuiLink
                component={Link}
                to="/login"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                {t('auth.signIn')}
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default SignupForm;
