import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, InputAdornment,
  IconButton, Alert, CircularProgress, Link, Divider,
} from '@mui/material';
import { Visibility, VisibilityOff, LocalPharmacy, PersonOutline, LockOutlined } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError(''); setErrorCode('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; code?: string } } })?.response?.data;
      setError(res?.message || 'Login failed. Please check your credentials.');
      setErrorCode(res?.code || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 50%, #01579b 100%)',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 68, height: 68, borderRadius: 3,
                bgcolor: 'primary.main', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', mb: 2,
                boxShadow: '0 8px 24px rgba(21,101,192,0.3)',
              }}
            >
              <LocalPharmacy sx={{ fontSize: 38, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="#1e293b">MedMek</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Pharmacy Management System
            </Typography>
          </Box>

          <Typography variant="h6" fontWeight={600} mb={0.5}>Sign in</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Enter your username and password to continue
          </Typography>

          {error && (
            <Alert
              severity={errorCode === 'PENDING_APPROVAL' ? 'warning' : errorCode === 'ACCOUNT_REJECTED' ? 'error' : 'error'}
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              fullWidth
              autoFocus
              autoComplete="username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right', mt: -1 }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2" underline="hover" color="primary">
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
              sx={{ py: 1.5, mt: 0.5, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">New to MedMek?</Typography>
          </Divider>

          <Button
            component={RouterLink}
            to="/signup"
            variant="outlined"
            fullWidth
            sx={{ fontWeight: 600 }}
          >
            Create Account
          </Button>

          <Typography variant="caption" color="text.disabled" display="block" textAlign="center" mt={2.5}>
            Admin?{' '}
            <Link component={RouterLink} to="/admin" underline="hover" color="text.secondary">
              Go to Admin Panel
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
