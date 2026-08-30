import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  CircularProgress, Link, Grid, Stepper, Step, StepLabel,
  InputAdornment, Divider,
} from '@mui/material';
import {
  LocalPharmacy, PersonOutline, EmailOutlined, LockOutlined,
  StoreOutlined, CheckCircleOutline, ArrowBack, ArrowForward,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../api';

interface FormData {
  username: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  storeName: string;
  storeAddress: string;
  storeGST: string;
  storeDLNo: string;
  storeUpiId: string;
}

const INITIAL: FormData = {
  username: '', name: '', email: '', password: '', confirmPassword: '',
  phone: '', storeName: '', storeAddress: '', storeGST: '', storeDLNo: '', storeUpiId: '',
};

const steps = ['Account Details', 'Store Information', 'Review & Submit'];

const SignUp: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = field === 'username' ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setError('');
  };

  const validateStep0 = () => {
    if (!form.username || form.username.length < 3)
      return 'Username must be at least 3 characters.';
    if (!/^[a-z0-9_]+$/.test(form.username))
      return 'Username can only contain letters, numbers, and underscores.';
    if (!form.name) return 'Full name is required.';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Valid email is required.';
    if (!form.password || form.password.length < 6)
      return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword)
      return 'Passwords do not match.';
    return '';
  };

  const validateStep1 = () => {
    if (!form.storeName) return 'Store name is required.';
    if (!form.phone) return 'Phone number is required.';
    return '';
  };

  const handleNext = () => {
    let err = '';
    if (activeStep === 0) err = validateStep0();
    if (activeStep === 1) err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => { setError(''); setActiveStep((prev) => prev - 1); };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', {
        username: form.username,
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        storeName: form.storeName,
        storeAddress: form.storeAddress,
        storeGST: form.storeGST,
        storeDLNo: form.storeDLNo,
        storeUpiId: form.storeUpiId,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', p: 2,
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 480, borderRadius: 3 }}>
          <CardContent sx={{ p: 5, textAlign: 'center' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'success.light', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
              <CheckCircleOutline sx={{ fontSize: 44, color: 'success.main' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} mb={1.5} color="#1e293b">
              Registration Submitted!
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={2}>
              Thank you, <strong>{form.name}</strong>! Your account request has been received.
            </Typography>
            <Box sx={{ bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', borderRadius: 2, p: 2, mb: 3, textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={600} color="warning.800" mb={0.5}>
                What happens next?
              </Typography>
              <Typography variant="body2" color="warning.700" sx={{ lineHeight: 1.8 }}>
                1. Our team will review your application<br />
                2. After payment confirmation, your account will be approved<br />
                3. You'll be able to log in once approved<br />
                4. Contact support if you need help
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Your username: <strong>@{form.username}</strong>
            </Typography>
            <Button variant="contained" fullWidth size="large" component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalPharmacy sx={{ fontSize: 24, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>MedMek</Typography>
              <Typography variant="caption" color="text.secondary">Create your account</Typography>
            </Box>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Step 0: Account */}
          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Username *"
                  value={form.username}
                  onChange={set('username')}
                  fullWidth
                  autoFocus
                  helperText="3–30 chars, letters/numbers/underscore only. This is your login ID."
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography color="text.secondary" variant="body2">@</Typography></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Full Name *"
                  value={form.name}
                  onChange={set('name')}
                  fullWidth
                  InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email Address *"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  fullWidth
                  helperText="Used for password reset only"
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Password *"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  fullWidth
                  helperText="Minimum 6 characters"
                  InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Confirm Password *"
                  type="password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  fullWidth
                  error={form.confirmPassword !== '' && form.password !== form.confirmPassword}
                  helperText={form.confirmPassword !== '' && form.password !== form.confirmPassword ? 'Does not match' : ''}
                />
              </Grid>
            </Grid>
          )}

          {/* Step 1: Store */}
          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Store / Pharmacy Name *"
                  value={form.storeName}
                  onChange={set('storeName')}
                  fullWidth
                  autoFocus
                  InputProps={{ startAdornment: <InputAdornment position="start"><StoreOutlined fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Phone Number *" value={form.phone} onChange={set('phone')} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="GST Number (optional)" value={form.storeGST} onChange={set('storeGST')} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Drug License No. (optional)" value={form.storeDLNo} onChange={set('storeDLNo')} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="UPI ID (optional)" value={form.storeUpiId} onChange={set('storeUpiId')} fullWidth placeholder="yourstore@upi" />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Store Address (optional)"
                  value={form.storeAddress}
                  onChange={set('storeAddress')}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          )}

          {/* Step 2: Review */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" mb={2}>Review your information</Typography>
              {[
                { label: 'Username', value: `@${form.username}` },
                { label: 'Full Name', value: form.name },
                { label: 'Email', value: form.email },
                { label: 'Store Name', value: form.storeName },
                { label: 'Phone', value: form.phone },
                { label: 'GST Number', value: form.storeGST || '—' },
                { label: 'Drug License No.', value: form.storeDLNo || '—' },
                { label: 'UPI ID', value: form.storeUpiId || '—' },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                </Box>
              ))}
              <Alert severity="info" sx={{ mt: 2.5 }} icon={false}>
                <Typography variant="body2">
                  By submitting, you agree that your account will be <strong>pending review</strong>.
                  Access is granted only after admin approval and payment confirmation.
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Navigation */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
            {activeStep > 0 && (
              <Button onClick={handleBack} startIcon={<ArrowBack />} variant="outlined" color="inherit" sx={{ flex: 1 }}>
                Back
              </Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button onClick={handleNext} endIcon={<ArrowForward />} variant="contained" sx={{ flex: 1, fontWeight: 700 }}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                variant="contained"
                color="success"
                disabled={loading}
                sx={{ flex: 1, fontWeight: 700 }}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutline />}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            )}
          </Box>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" underline="hover" fontWeight={600}>Sign In</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignUp;
