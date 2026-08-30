import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button,
  TextField, Tab, Tabs, Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, CircularProgress, InputAdornment,
} from '@mui/material';
import { Add, Remove, SwapHoriz, Search } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import api from '../../api';
import { useSnackbar } from 'notistack';

interface Transaction {
  _id: string;
  medicineName: string;
  transactionType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string;
  createdAt: string;
  reference?: string;
}

interface Medicine {
  _id: string;
  name: string;
  currentStock: number;
  sellingPrice: number;
  batchNumber: string;
  scheduleClass?: 'None' | 'H' | 'H1' | 'X';
  location?: string;
}

const SCHEDULE_COLORS: Record<string, 'warning' | 'error'> = { H: 'warning', H1: 'warning', X: 'error' };

const TYPE_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  stock_in: 'success',
  purchase: 'success',
  sale: 'error',
  stock_out: 'error',
  adjustment: 'warning',
  return: 'info',
};

const TYPE_FILTERS = ['', 'stock_in', 'stock_out', 'adjustment', 'sale', 'purchase', 'return'];

const Inventory: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dialogType, setDialogType] = useState<'in' | 'out' | 'adjust' | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [quantity, setQuantity] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20 };
      if (tab > 0) params.type = TYPE_FILTERS[tab];
      const { data } = await api.get('/inventory/transactions', { params });
      setTransactions(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch transactions', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, tab, enqueueSnackbar]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    if (!dialogType) return;
    api.get('/medicines/search', { params: { q: medicineSearch, includeOutOfStock: true } })
      .then(({ data }) => setMedicines(data.data));
  }, [dialogType, medicineSearch]);

  const handleAction = async () => {
    if (!selectedMedicine) { enqueueSnackbar('Select a medicine', { variant: 'warning' }); return; }
    setActionLoading(true);
    try {
      if (dialogType === 'in') {
        await api.post('/inventory/stock-in', { medicineId: selectedMedicine._id, quantity: parseInt(quantity), notes });
        enqueueSnackbar('Stock added', { variant: 'success' });
      } else if (dialogType === 'out') {
        await api.post('/inventory/stock-out', { medicineId: selectedMedicine._id, quantity: parseInt(quantity), notes });
        enqueueSnackbar('Stock removed', { variant: 'success' });
      } else if (dialogType === 'adjust') {
        await api.post('/inventory/adjust', { medicineId: selectedMedicine._id, newQuantity: parseInt(newQuantity), notes });
        enqueueSnackbar('Stock adjusted', { variant: 'success' });
      }
      setDialogType(null);
      fetchTransactions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Action failed', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    { id: 'createdAt', label: 'Date', minWidth: 160,
      render: (row: Transaction) => new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
    { id: 'medicineName', label: 'Medicine', minWidth: 180 },
    { id: 'transactionType', label: 'Type', minWidth: 120,
      render: (row: Transaction) => (
        <Chip
          label={row.transactionType.replace('_', ' ').toUpperCase()}
          color={TYPE_COLORS[row.transactionType] || 'default'}
          size="small"
        />
      ),
    },
    { id: 'quantity', label: 'Qty', align: 'right' as const, minWidth: 80,
      render: (row: Transaction) => (
        <Typography variant="body2" fontWeight={700}
          sx={{ color: row.quantity < 0 ? 'error.main' : 'success.main' }}>
          {row.quantity > 0 ? '+' : ''}{row.quantity}
        </Typography>
      ),
    },
    { id: 'previousStock', label: 'Before', align: 'right' as const },
    { id: 'newStock', label: 'After', align: 'right' as const },
    { id: 'reference', label: 'Reference', minWidth: 150 },
    { id: 'notes', label: 'Notes', minWidth: 200 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="contained" color="success" startIcon={<Add />} onClick={() => { setDialogType('in'); setQuantity(''); setNotes(''); setSelectedMedicine(null); setMedicineSearch(''); }}>
          Stock In
        </Button>
        <Button variant="contained" color="error" startIcon={<Remove />} onClick={() => { setDialogType('out'); setQuantity(''); setNotes(''); setSelectedMedicine(null); setMedicineSearch(''); }}>
          Stock Out
        </Button>
        <Button variant="outlined" startIcon={<SwapHoriz />} onClick={() => { setDialogType('adjust'); setNewQuantity(''); setNotes(''); setSelectedMedicine(null); setMedicineSearch(''); }}>
          Adjust Stock
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ mb: 2 }}>
            <Tab label="All" />
            <Tab label="Stock In" />
            <Tab label="Stock Out" />
            <Tab label="Adjustments" />
            <Tab label="Sales" />
            <Tab label="Purchases" />
            <Tab label="Returns" />
          </Tabs>

          <DataTable
            columns={columns}
            rows={transactions}
            loading={loading}
            total={total}
            page={page}
            rowsPerPage={20}
            onPageChange={setPage}
            keyExtractor={(row) => row._id}
          />
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!dialogType} onClose={() => setDialogType(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialogType === 'in' ? 'Stock In' : dialogType === 'out' ? 'Stock Out' : 'Adjust Stock'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              options={medicines}
              getOptionLabel={(o) => `${o.name}${o.batchNumber ? ` (${o.batchNumber})` : ''} — Stock: ${o.currentStock}`}
              value={selectedMedicine}
              onInputChange={(_, v) => setMedicineSearch(v)}
              onChange={(_, v) => setSelectedMedicine(v)}
              renderInput={(params) => (
                <TextField {...params} label="Search Medicine" fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option._id} sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{option.name}</Typography>
                      {option.scheduleClass && option.scheduleClass !== 'None' && (
                        <Chip label={`Sch. ${option.scheduleClass}`} size="small" color={SCHEDULE_COLORS[option.scheduleClass]} sx={{ height: 18, fontSize: 10, flexShrink: 0 }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Batch: {option.batchNumber || '—'} • Stock: {option.currentStock}
                      {option.location ? ` • Loc: ${option.location}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} color="primary" sx={{ flexShrink: 0, ml: 'auto' }}>
                    ₹{option.sellingPrice.toFixed(2)}
                  </Typography>
                </Box>
              )}
            />
            {dialogType !== 'adjust' ? (
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputProps={{ min: 1 }}
                fullWidth
              />
            ) : (
              <TextField
                label="New Stock Quantity"
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                inputProps={{ min: 0 }}
                fullWidth
                helperText={selectedMedicine ? `Current: ${selectedMedicine.currentStock}` : ''}
              />
            )}
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogType(null)} color="inherit" variant="outlined">Cancel</Button>
          <Button onClick={handleAction} variant="contained" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={18} color="inherit" /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
