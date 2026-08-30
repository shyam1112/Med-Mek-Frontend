import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, IconButton, Tooltip,
  TextField, InputAdornment, Tab, Tabs, Avatar, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, AppBar, Toolbar,
  Menu, MenuItem as MuiMenuItem, Badge, Alert,
} from '@mui/material';
import {
  Search, CheckCircle, Cancel, Replay, Delete,
  AdminPanelSettings, PersonOutline,
  NotificationsOutlined, Logout, Refresh,
} from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import adminApi from '../../api/adminApi';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

interface UserRequest {
  _id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  storeAddress: string;
  storeGST: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const STATUS_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
} as const;

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'];

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRequest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rejectDialogUser, setRejectDialogUser] = useState<UserRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRequest | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { admin, adminLogout } = useAdminAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/admin/stats');
      setStats(data.data);
    } catch { /* silent */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20, status: STATUS_TABS[tab] };
      if (search) params.search = search;
      const { data } = await adminApi.get('/admin/requests', { params });
      setUsers(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch requests', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, tab, search, enqueueSnackbar]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleApprove = async (user: UserRequest) => {
    try {
      await adminApi.patch(`/admin/requests/${user._id}/approve`);
      enqueueSnackbar(`✓ ${user.name} approved successfully`, { variant: 'success' });
      fetchUsers(); fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to approve', { variant: 'error' });
    }
  };

  const handleReject = async () => {
    if (!rejectDialogUser) return;
    try {
      await adminApi.patch(`/admin/requests/${rejectDialogUser._id}/reject`, { reason: rejectReason });
      enqueueSnackbar(`${rejectDialogUser.name} rejected`, { variant: 'warning' });
      setRejectDialogUser(null);
      setRejectReason('');
      fetchUsers(); fetchStats();
    } catch {
      enqueueSnackbar('Failed to reject', { variant: 'error' });
    }
  };

  const handleReApprove = async (user: UserRequest) => {
    try {
      await adminApi.patch(`/admin/requests/${user._id}/re-approve`);
      enqueueSnackbar(`${user.name} re-approved`, { variant: 'success' });
      fetchUsers(); fetchStats();
    } catch {
      enqueueSnackbar('Failed to re-approve', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await adminApi.delete(`/admin/requests/${deleteId}`);
      enqueueSnackbar('User deleted', { variant: 'success' });
      setDeleteId(null);
      fetchUsers(); fetchStats();
    } catch {
      enqueueSnackbar('Failed to delete', { variant: 'error' });
    }
  };

  const columns = [
    {
      id: 'user', label: 'User', minWidth: 220,
      render: (row: UserRequest) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
            {row.name?.[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">@{row.username}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'store', label: 'Store', minWidth: 200,
      render: (row: UserRequest) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.storeName || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{row.phone}</Typography>
        </Box>
      ),
    },
    { id: 'email', label: 'Email', minWidth: 200 },
    { id: 'storeGST', label: 'GST No.', minWidth: 160, render: (row: UserRequest) => row.storeGST || '—' },
    {
      id: 'createdAt', label: 'Applied On', minWidth: 130,
      render: (row: UserRequest) => new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
    {
      id: 'status', label: 'Status', minWidth: 110,
      render: (row: UserRequest) => (
        <Chip
          label={row.status.toUpperCase()}
          color={STATUS_COLORS[row.status]}
          size="small"
          variant="filled"
        />
      ),
    },
    {
      id: 'actions', label: 'Actions', minWidth: 160, align: 'center' as const,
      render: (row: UserRequest) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {row.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleApprove(row)}
                  sx={{ bgcolor: 'success.50', '&:hover': { bgcolor: 'success.100' } }}
                >
                  <CheckCircle fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => { setRejectDialogUser(row); setRejectReason(''); }}
                  sx={{ bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' } }}
                >
                  <Cancel fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {row.status === 'approved' && (
            <Tooltip title="Revoke Approval">
              <IconButton
                size="small"
                color="warning"
                onClick={() => { setRejectDialogUser(row); setRejectReason(''); }}
              >
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {row.status === 'rejected' && (
            <Tooltip title="Re-Approve">
              <IconButton size="small" color="success" onClick={() => handleReApprove(row)}>
                <Replay fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => setSelectedUser(row)}>
              <PersonOutline fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteId(row._id)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4f8' }}>
      {/* Admin AppBar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ background: 'linear-gradient(135deg, #0d0d0d, #1a1a2e)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AdminPanelSettings sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="#fff" lineHeight={1.2}>
                MedMek Admin
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Super Admin Panel
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Chip
            label={`${stats.pending} Pending`}
            color={stats.pending > 0 ? 'warning' : 'default'}
            size="small"
            sx={{ fontWeight: 700 }}
          />

          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchUsers(); fetchStats(); }} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
              {admin?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="body2" color="#fff" fontWeight={600} sx={{ display: { xs: 'none', sm: 'block' } }}>
              {admin?.name}
            </Typography>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MuiMenuItem onClick={() => { adminLogout(); navigate('/admin'); setAnchorEl(null); }} sx={{ color: 'error.main' }}>
              <Logout fontSize="small" sx={{ mr: 1.5 }} /> Logout
            </MuiMenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Stats */}
        <Grid container spacing={2.5} mb={3}>
          {[
            { title: 'Total Applications', value: stats.total, color: '#1976d2', icon: <PersonOutline /> },
            { title: 'Pending Review', value: stats.pending, color: '#ed6c02', icon: <NotificationsOutlined /> },
            { title: 'Approved', value: stats.approved, color: '#2e7d32', icon: <CheckCircle /> },
            { title: 'Rejected', value: stats.rejected, color: '#d32f2f', icon: <Cancel /> },
          ].map((s) => (
            <Grid item xs={6} sm={3} key={s.title}>
              <StatCard title={s.title} value={s.value} icon={s.icon} color={s.color} />
            </Grid>
          ))}
        </Grid>

        {/* Pending alert */}
        {stats.pending > 0 && (
          <Alert
            severity="warning"
            sx={{ mb: 2.5, borderRadius: 2 }}
            action={
              <Button color="warning" size="small" onClick={() => setTab(1)}>
                Review Now
              </Button>
            }
          >
            <strong>{stats.pending} application{stats.pending > 1 ? 's' : ''}</strong> waiting for your review and payment confirmation.
          </Alert>
        )}

        {/* Main table */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
                User Requests
              </Typography>
              <TextField
                placeholder="Search by name, username, email, store..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                size="small"
                sx={{ minWidth: 280 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
            </Box>

            <Tabs
              value={tab}
              onChange={(_, v) => { setTab(v); setPage(0); }}
              sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab label={`All (${stats.total})`} />
              <Tab
                label={
                  <Badge badgeContent={stats.pending} color="warning" max={99}>
                    <Box sx={{ pr: stats.pending > 0 ? 1.5 : 0 }}>Pending</Box>
                  </Badge>
                }
              />
              <Tab label={`Approved (${stats.approved})`} />
              <Tab label={`Rejected (${stats.rejected})`} />
            </Tabs>

            <DataTable
              columns={columns}
              rows={users}
              loading={loading}
              total={total}
              page={page}
              rowsPerPage={20}
              onPageChange={setPage}
              keyExtractor={(row) => row._id}
            />
          </CardContent>
        </Card>
      </Box>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialogUser} onClose={() => setRejectDialogUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Application</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Rejecting <strong>{rejectDialogUser?.name}</strong> (@{rejectDialogUser?.username}).
            They will see this reason when they try to log in.
          </Typography>
          <TextField
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="e.g. Payment not received, Invalid store details..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialogUser(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleReject} variant="contained" color="error">Reject</Button>
        </DialogActions>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>{selectedUser?.name?.[0]}</Avatar>
          <Box>
            {selectedUser?.name}
            <Typography variant="caption" color="text.secondary" display="block">
              @{selectedUser?.username}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box>
              {[
                { label: 'Email', value: selectedUser.email },
                { label: 'Phone', value: selectedUser.phone || '—' },
                { label: 'Store Name', value: selectedUser.storeName || '—' },
                { label: 'Store Address', value: selectedUser.storeAddress || '—' },
                { label: 'GST Number', value: selectedUser.storeGST || '—' },
                { label: 'Applied On', value: new Date(selectedUser.createdAt).toLocaleString('en-IN') },
                { label: 'Status', value: selectedUser.status.toUpperCase() },
                ...(selectedUser.rejectionReason ? [{ label: 'Rejection Reason', value: selectedUser.rejectionReason }] : []),
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
                {selectedUser.status !== 'approved' && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => { handleApprove(selectedUser); setSelectedUser(null); }}
                    fullWidth
                  >
                    Approve
                  </Button>
                )}
                {selectedUser.status !== 'rejected' && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => { setRejectDialogUser(selectedUser); setSelectedUser(null); }}
                    fullWidth
                  >
                    Reject
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete User"
        message="Permanently delete this user account? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default AdminPanel;
