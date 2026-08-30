import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  CircularProgress, Link, InputAdornment, Divider,
} from '@mui/material';
import {
  LocalPharmacy, EmailOutlined, LockOutlined, ArrowBack, CheckCircleOutline,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../api';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Email is required.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
      // In dev mode the token is returned directly
      if (data.resetToken) {
        setToken(data.resetToken);
        setStep('reset');
      } else {
        setStep('reset');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to send reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError('Please enter the reset token from your email.'); return; }
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, password: newPassword });
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to reset password. Token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  const containerSx = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', p: 2,
  };

  return (
    <Box sx={containerSx}>
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalPharmacy sx={{ fontSize: 24, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>MedMek</Typography>
              <Typography variant="caption" color="text.secondary">Password Recovery</Typography>
            </Box>
          </Box>

          {/* Step: Email */}
          {step === 'email' && (
            <>
              <Typography variant="h6" fontWeight={600} mb={0.5}>Forgot your password?</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Enter the email address linked to your account. We'll send you a reset token.
              </Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleSendReset} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  autoFocus
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined fontSize="small" color="action" /></InputAdornment> }}
                />
                <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth sx={{ py: 1.5, fontWeight: 700 }}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Reset Token'}
                </Button>
              </Box>
            </>
          )}

          {/* Step: Reset token + new password */}
          {step === 'reset' && (
            <>
              <Typography variant="h6" fontWeight={600} mb={0.5}>Reset your password</Typography>
              {message && (
                <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>
              )}
              <Typography variant="body2" color="text.secondary" mb={3}>
                Enter the reset token sent to <strong>{email}</strong> and choose a new password.
              </Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleResetPassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Reset Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  fullWidth
                  autoFocus
                  helperText="Check your email for the reset token"
                />
                <TextField
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" color="action" /></InputAdornment> }}
                  helperText="Minimum 6 characters"
                />
                <TextField
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  error={confirmPassword !== '' && newPassword !== confirmPassword}
                  helperText={confirmPassword !== '' && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
                />
                <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth sx={{ py: 1.5, fontWeight: 700 }}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Reset Password'}
                </Button>
                <Button startIcon={<ArrowBack />} onClick={() => setStep('email')} color="inherit" size="small">
                  Try different email
                </Button>
              </Box>
            </>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <Box textAlign="center" py={2}>
              <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'success.light', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <CheckCircleOutline sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} mb={1}>Password Reset!</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Your password has been reset successfully. You can now sign in with your new password.
              </Typography>
              <Button component={RouterLink} to="/login" variant="contained" fullWidth size="large" sx={{ fontWeight: 700 }}>
                Sign In Now
              </Button>
            </Box>
          )}

          {step !== 'done' && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Remember your password?{' '}
                <Link component={RouterLink} to="/login" underline="hover" fontWeight={600}>Sign In</Link>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ForgotPassword;
