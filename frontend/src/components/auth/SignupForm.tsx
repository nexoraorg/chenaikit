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
import { ValidationRules } from '@chenaikit/core';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useAuth } from './AuthContext';

interface PasswordStrength {
  score: number;
  text: string;
  color: string;
}

const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return { score: 0, text: '', color: '#e2e8f0' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 33, text: 'Weak', color: '#f87171' };
  if (score <= 4) return { score: 66, text: 'Medium', color: '#fbbf24' };
  return { score: 100, text: 'Strong', color: '#34d399' };
};

export const SignupForm: React.FC = () => {
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
      email: ValidationRules.email(),
      password: ValidationRules.minLength(8, 'Password must be at least 8 characters long')
    },
    onSubmit: async (formValues) => {
      setSubmitError(null);
      setTermsError(null);

      if (!acceptTerms) {
        setTermsError('You must accept the terms of service to register.');
        return;
      }

      if (formValues.password !== formValues.confirmPassword) {
        setError('confirmPassword', 'Passwords do not match');
        return;
      }

      try {
        await register(formValues.email, formValues.password);
        setRegisteredEmail(formValues.email);
        setIsVerificationSent(true);
      } catch (err: any) {
        setSubmitError(err.message || 'Registration failed. Please try again.');
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
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: '#0f172a' }}>
          Verify your email
        </Typography>
        <Typography variant="body1" sx={{ color: '#475569', mb: 4, px: 2 }}>
          We have sent a verification link to <strong>{registeredEmail}</strong>. Please check your inbox and click the link to verify your account.
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
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          }}
        >
          Go to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
          Create an account
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Sign up to monitor blockchain analytics and credit metrics
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
            label="Email Address"
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
            label="Password"
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
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Password Strength:
                </Typography>
                <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 700 }}>
                  {passwordStrength.text}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={passwordStrength.score} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: '#e2e8f0',
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
            label="Confirm Password"
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
              <Typography variant="body2" sx={{ color: '#475569', userSelect: 'none' }}>
                I agree to the{' '}
                <MuiLink 
                  component="button" 
                  type="button" 
                  onClick={() => alert('Terms of Service dialog (Demo Mode)')}
                  sx={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                >
                  Terms of Service
                </MuiLink>{' '}
                and{' '}
                <MuiLink 
                  component="button" 
                  type="button" 
                  onClick={() => alert('Privacy Policy dialog (Demo Mode)')}
                  sx={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                >
                  Privacy Policy
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
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
              }
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              'Sign Up'
            )}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Already have an account?{' '}
              <MuiLink
                component={Link}
                to="/login"
                sx={{
                  color: '#0284c7',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Sign in
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default SignupForm;
