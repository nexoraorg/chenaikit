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
import { ValidationRules } from '@chenaikit/core';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useAuth } from './AuthContext';

export const LoginForm: React.FC = () => {
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
      email: ValidationRules.email(),
      password: ValidationRules.required('Password is required')
    },
    onSubmit: async (formValues) => {
      setSubmitError(null);
      try {
        await login(formValues.email, formValues.password, rememberMe);
        navigate(from, { replace: true });
      } catch (err: any) {
        setSubmitError(err.message || 'Failed to sign in. Please try again.');
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
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
          Welcome back
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Enter your details to access your dashboard
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
                <Typography variant="body2" sx={{ color: '#475569', userSelect: 'none' }}>
                  Remember me
                </Typography>
              }
            />
            <MuiLink
              component={Link}
              to="/forgot-password"
              variant="body2"
              sx={{ 
                color: '#0284c7', 
                textDecoration: 'none', 
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Forgot password?
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
              'Sign In'
            )}
          </Button>

          <Divider sx={{ my: 1.5, color: '#94a3b8' }}>
            <Typography variant="caption" sx={{ px: 1, color: '#64748b', fontWeight: 500 }}>
              OR CONTINUE WITH
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
                borderColor: '#e2e8f0',
                color: '#334155',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f8fafc'
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
                borderColor: '#e2e8f0',
                color: '#334155',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f8fafc'
                }
              }}
            >
              GitHub
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Don't have an account?{' '}
              <MuiLink
                component={Link}
                to="/signup"
                sx={{
                  color: '#0284c7',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Sign up
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default LoginForm;
