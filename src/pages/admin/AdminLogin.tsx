import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Chip,
} from '@mui/material';
import {
  AdminPanelSettings, PersonOutline, LockOutlined,
  Visibility, VisibilityOff, Security,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { adminLogin } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please enter credentials.'); return; }
    setLoading(true); setError('');
    try {
      await adminLogin(username, password);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 72, height: 72, borderRadius: 3,
                background: 'linear-gradient(135deg, #1565c0, #0d47a1)',
                display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', mb: 2,
                boxShadow: '0 8px 32px rgba(13,71,161,0.4)',
              }}
            >
              <AdminPanelSettings sx={{ fontSize: 40, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="#1e293b">
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5} mb={1}>
              MedMek Super Admin Access
            </Typography>
            <Chip
              icon={<Security fontSize="small" />}
              label="Restricted Access"
              size="small"
              color="error"
              variant="outlined"
            />
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Admin Username"
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
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
              sx={{ py: 1.5, mt: 0.5, fontWeight: 700, background: 'linear-gradient(135deg, #1565c0, #0d47a1)' }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In to Admin Panel'}
            </Button>
          </Box>

          <Typography variant="caption" color="text.disabled" display="block" textAlign="center" mt={3}>
            This area is restricted to MedMek system administrators only.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminLogin;
