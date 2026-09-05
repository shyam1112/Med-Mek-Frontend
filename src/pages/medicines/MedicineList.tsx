import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, TextField, InputAdornment, Chip, IconButton,
  Tooltip, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { Add, Search, Edit, Delete, FilterList, LocalPrintshop } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { printShelfLabel } from '../../utils/printLabel';

interface Medicine {
  _id: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercentage: number;
  currentStock: number;
  minimumStockLevel: number;
  barcode: string;
  scheduleClass?: 'None' | 'H' | 'H1' | 'X';
  location?: string;
}

const SCHEDULE_COLORS: Record<string, 'warning' | 'error'> = { H: 'warning', H1: 'warning', X: 'error' };

const MedicineList: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('lowStock') === 'true');
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page: page + 1, limit: rowsPerPage };
      if (search) params.search = search;
      if (category) params.category = category;
      if (lowStockFilter) params.lowStock = true;
      const { data } = await api.get('/medicines', { params });
      setMedicines(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch medicines', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, category, lowStockFilter, enqueueSnackbar]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  useEffect(() => {
    api.get('/medicines/categories').then(({ data }) => setCategories(data.data));
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/medicines/${deleteId}`);
      enqueueSnackbar('Medicine deleted', { variant: 'success' });
      fetchMedicines();
    } catch {
      enqueueSnackbar('Failed to delete medicine', { variant: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const getStockChip = (m: Medicine) => {
    if (m.currentStock === 0) return <Chip label="Out of Stock" color="error" size="small" />;
    if (m.currentStock <= m.minimumStockLevel) return <Chip label={`${m.currentStock} (Low)`} color="warning" size="small" />;
    return <Chip label={m.currentStock} color="success" size="small" />;
  };

  const getExpiryChip = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const days = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    if (days < 0) return <Chip label="Expired" color="error" size="small" />;
    if (days <= 30) return <Chip label={`${days}d`} color="error" size="small" />;
    if (days <= 90) return <Chip label={`${days}d`} color="warning" size="small" />;
    return <Chip label={date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} size="small" />;
  };

  const columns = [
    { id: 'name', label: 'Medicine Name', minWidth: 200, render: (row: Medicine) => (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box fontWeight={600} fontSize="0.875rem">{row.name}</Box>
          {row.scheduleClass && row.scheduleClass !== 'None' && (
            <Chip label={`Sch. ${row.scheduleClass}`} size="small" color={SCHEDULE_COLORS[row.scheduleClass]} sx={{ height: 18, fontSize: 10 }} />
          )}
        </Box>
        <Box fontSize="0.75rem" color="text.secondary">{row.genericName}</Box>
      </Box>
    )},
    { id: 'category', label: 'Category', minWidth: 120 },
    { id: 'batchNumber', label: 'Batch', minWidth: 100 },
    {
      id: 'location', label: 'Location', minWidth: 130,
      render: (row: Medicine) => row.location || <Box component="span" color="text.disabled">—</Box>,
    },
    { id: 'expiryDate', label: 'Expiry', minWidth: 110, render: (row: Medicine) => getExpiryChip(row.expiryDate) },
    { id: 'sellingPrice', label: 'MRP (₹)', minWidth: 90, align: 'right' as const, render: (row: Medicine) => `₹${row.sellingPrice.toFixed(2)}` },
    { id: 'currentStock', label: 'Stock', minWidth: 100, render: (row: Medicine) => getStockChip(row) },
    {
      id: 'actions', label: 'Actions', minWidth: 120, align: 'right' as const,
      render: (row: Medicine) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Print Shelf Label">
            <IconButton
              size="small"
              color="secondary"
              onClick={() => printShelfLabel(
                { name: row.name, batchNumber: row.batchNumber, barcode: row.barcode, location: row.location },
                user?.storeName
              )}
            >
              <LocalPrintshop fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => navigate(`/medicines/${row._id}/edit`)}>
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/medicines/new')}
        >
          Add Medicine
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search medicines..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="category-filter-label" shrink>Category</InputLabel>
          <Select labelId="category-filter-label" value={category} label="Category" displayEmpty notched onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
            <MenuItem value="">All Categories</MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <Button
          variant={lowStockFilter ? 'contained' : 'outlined'}
          color="warning"
          startIcon={<FilterList />}
          onClick={() => { setLowStockFilter(!lowStockFilter); setPage(0); }}
          size="small"
        >
          Low Stock
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={medicines}
        loading={loading}
        total={total}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(r) => { setRowsPerPage(r); setPage(0); }}
        keyExtractor={(row) => row._id}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Medicine"
        message="Are you sure you want to delete this medicine? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
    </Box>
  );
};

export default MedicineList;
