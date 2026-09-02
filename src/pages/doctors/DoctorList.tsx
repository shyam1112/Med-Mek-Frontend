import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, TextField, InputAdornment, IconButton, Tooltip,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip,
} from '@mui/material';
import { Add, Search, Edit, Delete } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../api';
import { useSnackbar } from 'notistack';

interface Doctor {
  _id: string;
  name: string;
  qualification: string;
  specialization: string;
  clinicName: string;
  phone: string;
  registrationNo: string;
  isActive: boolean;
}

const EMPTY = {
  name: '', qualification: '', specialization: '', clinicName: '', phone: '', registrationNo: '',
};

const DoctorList: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/doctors', { params });
      setDoctors(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch doctors', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, enqueueSnackbar]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleSave = async () => {
    if (!form.name) { enqueueSnackbar('Name is required', { variant: 'warning' }); return; }
    setSaving(true);
    try {
      if (editDoctor) {
        await api.put(`/doctors/${editDoctor._id}`, form);
        enqueueSnackbar('Doctor updated', { variant: 'success' });
      } else {
        await api.post('/doctors', form);
        enqueueSnackbar('Doctor added', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchDoctors();
    } catch {
      enqueueSnackbar('Failed to save doctor', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      id: 'name', label: 'Doctor Name', minWidth: 180,
      render: (row: Doctor) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
          {row.qualification && <Typography variant="caption" color="text.secondary">{row.qualification}</Typography>}
        </Box>
      ),
    },
    {
      id: 'specialization', label: 'Specialization', minWidth: 150,
      render: (row: Doctor) => row.specialization || <Box component="span" color="text.disabled">—</Box>,
    },
    {
      id: 'clinicName', label: 'Clinic', minWidth: 160,
      render: (row: Doctor) => row.clinicName || <Box component="span" color="text.disabled">—</Box>,
    },
    {
      id: 'phone', label: 'Phone', minWidth: 130,
      render: (row: Doctor) => row.phone || <Box component="span" color="text.disabled">—</Box>,
    },
    {
      id: 'isActive', label: 'Status', minWidth: 100,
      render: (row: Doctor) => (
        <Chip label={row.isActive ? 'Active' : 'Inactive'} size="small" color={row.isActive ? 'success' : 'default'} variant="outlined" />
      ),
    },
    {
      id: 'actions', label: '', align: 'right' as const,
      render: (row: Doctor) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => {
              setForm({
                name: row.name, qualification: row.qualification, specialization: row.specialization,
                clinicName: row.clinicName, phone: row.phone, registrationNo: row.registrationNo,
              });
              setEditDoctor(row);
              setDialogOpen(true);
            }}>
              <Edit fontSize="small" />
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
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, alignItems: 'center' }}>
        <TextField
          placeholder="Search doctors by name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm(EMPTY); setEditDoctor(null); setDialogOpen(true); }}>
          Add Doctor
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={doctors}
        loading={loading}
        total={total}
        page={page}
        rowsPerPage={20}
        onPageChange={setPage}
        keyExtractor={(row) => row._id}
      />

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editDoctor ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Qualification" placeholder="MBBS, MD..." value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Specialization" placeholder="General Physician, Pediatrician..." value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Clinic / Hospital Name" value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Registration No." value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} fullWidth />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" variant="outlined">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editDoctor ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Doctor"
        message="Delete this doctor? Existing bills that reference them will keep showing their name."
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await api.delete(`/doctors/${deleteId}`);
            enqueueSnackbar('Doctor deleted', { variant: 'success' });
            fetchDoctors();
          } catch {
            enqueueSnackbar('Failed to delete doctor', { variant: 'error' });
          } finally {
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default DoctorList;
