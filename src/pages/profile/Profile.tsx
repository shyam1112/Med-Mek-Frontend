import React, { useState } from 'react';
import {
  Box, Card, CardContent, Grid, TextField, Button, Typography, Divider,
} from '@mui/material';
import { Save, Lock } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';
import { useSnackbar } from 'notistack';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    storeName: user?.storeName || '',
    storeAddress: user?.storeAddress || '',
    storeGST: user?.storeGST || '',
    storeDLNo: user?.storeDLNo || '',
    storeUpiId: user?.storeUpiId || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', profile);
      updateUser(data.data);
      enqueueSnackbar('Profile updated', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to update profile', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      enqueueSnackbar('Password must be at least 6 characters', { variant: 'warning' });
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to change password', { variant: 'error' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={3}>Profile Information</Typography>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <TextField label="Username" value={user?.username || ''} fullWidth disabled helperText="Username cannot be changed" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Email" value={user?.email || ''} fullWidth disabled helperText="Used for password reset only" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Phone Number" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} fullWidth />
              </Grid>
              <Divider sx={{ width: '100%', my: 1 }} />
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>Store Information</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Store Name" value={profile.storeName} onChange={(e) => setProfile({ ...profile, storeName: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="GST Number" value={profile.storeGST} onChange={(e) => setProfile({ ...profile, storeGST: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Drug License No." value={profile.storeDLNo} onChange={(e) => setProfile({ ...profile, storeDLNo: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="UPI ID"
                  value={profile.storeUpiId}
                  onChange={(e) => setProfile({ ...profile, storeUpiId: e.target.value })}
                  fullWidth
                  placeholder="yourstore@upi"
                  helperText="Used to generate a UPI QR code on bills paid via UPI"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Store Address" value={profile.storeAddress} onChange={(e) => setProfile({ ...profile, storeAddress: e.target.value })} fullWidth multiline rows={2} />
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" startIcon={<Save />} onClick={handleProfileSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={3}>Change Password</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Current Password"
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                fullWidth
              />
              <TextField
                label="New Password"
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                fullWidth
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                fullWidth
                error={passwords.confirmPassword !== '' && passwords.newPassword !== passwords.confirmPassword}
                helperText={passwords.confirmPassword !== '' && passwords.newPassword !== passwords.confirmPassword ? 'Passwords do not match' : ''}
              />
              <Button
                variant="contained"
                color="warning"
                startIcon={<Lock />}
                onClick={handlePasswordChange}
                disabled={changingPassword || !passwords.currentPassword || !passwords.newPassword}
                fullWidth
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default Profile;
