import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Typography, TextField, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Table, TableHead, TableRow, TableCell, TableBody, Divider,
  InputAdornment, CircularProgress, Alert,
} from '@mui/material';
import { Visibility, Search, AssignmentReturn, Print } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import api from '../../api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { printInvoice } from '../../utils/printInvoice';

interface SaleItem {
  medicine: string;
  medicineName: string;
  manufacturer: string;
  packSize: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  sellingPrice: number;
  gstPercentage: number;
  discount: number;
  totalAmount: number;
}

interface Sale {
  _id: string;
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  doctorName: string;
  items: SaleItem[];
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalReturned: number;
  paymentMode: string;
}

interface SaleReturnItem {
  medicine: string;
  medicineName: string;
  quantity: number;
  refundAmount: number;
}

interface SaleReturn {
  _id: string;
  billNumber: string;
  items: SaleReturnItem[];
  totalRefund: number;
  reason: string;
  createdAt: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

// Checked against the batch's expiry date at the time of sale — not today's
// Medicine record, which may since have been restocked with a fresh batch.
const isExpired = (item: SaleItem) => !!item.expiryDate && new Date(item.expiryDate) < new Date();

const SalesList: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);

  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const handlePrintInvoice = (sale: Sale) => {
    printInvoice(sale, user?.storeName || '', user?.storeAddress || '', user?.storeGST || '', user?.storeDLNo || '');
  };

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/billing', { params });
      setSales(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch sales', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, enqueueSnackbar]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const fetchReturns = useCallback(async (saleId: string) => {
    setReturnsLoading(true);
    try {
      const { data } = await api.get('/returns', { params: { saleId } });
      setReturns(data.data || []);
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  const openView = (sale: Sale) => {
    setViewSale(sale);
    const initial: Record<string, string> = {};
    sale.items.forEach((i) => { initial[i.medicine] = ''; });
    setReturnQuantities(initial);
    setReturnReason('');
    fetchReturns(sale._id);
  };

  const returnedQtyFor = (medicineId: string) =>
    returns.reduce((sum, r) => sum + r.items.filter((i) => i.medicine === medicineId).reduce((s, i) => s + i.quantity, 0), 0);

  // Items the user has actually entered a return quantity for — the confirm
  // step only reviews these, not the whole bill.
  const itemsToReturn = (viewSale?.items || [])
    .map((it) => ({ item: it, quantity: parseInt(returnQuantities[it.medicine] || '', 10) || 0 }))
    .filter((r) => r.quantity > 0);

  const previewRefund = (it: SaleItem, qty: number) =>
    Math.round((it.totalAmount / it.quantity) * qty * 100) / 100;

  const openConfirmReturn = () => {
    if (itemsToReturn.length === 0) {
      enqueueSnackbar('Enter a quantity to return for at least one item', { variant: 'warning' });
      return;
    }
    setReturnDialogOpen(true);
  };

  const handleSubmitReturn = async () => {
    if (!viewSale) return;
    const items = itemsToReturn.map(({ item, quantity }) => ({ medicineId: item.medicine, quantity }));

    setReturnSaving(true);
    try {
      await api.post('/returns', { saleId: viewSale._id, items, reason: returnReason });
      enqueueSnackbar('Return processed', { variant: 'success' });
      setReturnDialogOpen(false);
      setReturnReason('');
      await fetchReturns(viewSale._id);
      fetchSales();
      // Refresh the view dialog's sale total so "Returned" reflects immediately,
      // and reset the quantity inputs now that this batch has been submitted.
      const { data } = await api.get(`/billing/${viewSale._id}`);
      setViewSale(data.data);
      const cleared: Record<string, string> = {};
      data.data.items.forEach((i: SaleItem) => { cleared[i.medicine] = ''; });
      setReturnQuantities(cleared);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to process return', { variant: 'error' });
    } finally {
      setReturnSaving(false);
    }
  };

  const columns = [
    { id: 'billNumber', label: 'Bill No.', minWidth: 150,
      render: (row: Sale) => <Typography variant="body2" fontWeight={600} color="primary">{row.billNumber}</Typography> },
    { id: 'saleDate', label: 'Date', minWidth: 140,
      render: (row: Sale) => new Date(row.saleDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
    { id: 'customerName', label: 'Customer', minWidth: 160,
      render: (row: Sale) => (
        <Box>
          <Typography variant="body2">{row.customerName}</Typography>
          {row.customerMobile && <Typography variant="caption" color="text.secondary">{row.customerMobile}</Typography>}
        </Box>
      ) },
    { id: 'totalAmount', label: 'Amount', align: 'right' as const, minWidth: 100,
      render: (row: Sale) => formatCurrency(row.totalAmount) },
    { id: 'paymentMode', label: 'Payment', minWidth: 100,
      render: (row: Sale) => <Chip label={row.paymentMode.toUpperCase()} size="small" /> },
    { id: 'status', label: 'Status', minWidth: 120,
      render: (row: Sale) => row.totalReturned > 0
        ? <Chip label={`Returned ${formatCurrency(row.totalReturned)}`} color="warning" size="small" />
        : <Chip label="Completed" color="success" size="small" variant="outlined" /> },
    { id: 'actions', label: '', align: 'right' as const, minWidth: 90,
      render: (row: Sale) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Print Invoice">
            <IconButton size="small" onClick={() => handlePrintInvoice(row)}><Print fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="View / Return">
            <IconButton size="small" onClick={() => openView(row)}><Visibility fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      ) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
        <TextField
          placeholder="Search by bill number, customer name or mobile..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1, maxWidth: 420 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
      </Box>

      <DataTable
        columns={columns}
        rows={sales}
        loading={loading}
        total={total}
        page={page}
        rowsPerPage={20}
        onPageChange={setPage}
        keyExtractor={(row) => row._id}
      />

      {/* ── View Sale Dialog ── */}
      <Dialog open={!!viewSale && !returnDialogOpen} onClose={() => setViewSale(null)} maxWidth="md" fullWidth>
        {viewSale && (
          <>
            <DialogTitle>Bill — {viewSale.billNumber}</DialogTitle>
            <DialogContent>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Customer:</strong> {viewSale.customerName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Date:</strong> {new Date(viewSale.saleDate).toLocaleString('en-IN')}</Typography>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mb: 2 }}>
                To process a return, only add a quantity for the medicine(s) the customer is
                actually returning — leave the rest blank. Refund and stock are calculated
                only for the items you enter.
              </Alert>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Medicine</TableCell>
                    <TableCell>Expiry</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Returned</TableCell>
                    <TableCell align="right">Return Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewSale.items.map((it, i) => {
                    const remaining = it.quantity - returnedQtyFor(it.medicine);
                    const expired = isExpired(it);
                    return (
                      <TableRow key={i}>
                        <TableCell>{it.medicineName}</TableCell>
                        <TableCell>
                          {it.expiryDate
                            ? (
                              <Chip
                                label={new Date(it.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                size="small"
                                color={expired ? 'error' : 'default'}
                                variant={expired ? 'filled' : 'outlined'}
                              />
                            )
                            : '—'}
                        </TableCell>
                        <TableCell align="right">{it.quantity}</TableCell>
                        <TableCell align="right">₹{it.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{it.totalAmount.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          {returnsLoading ? <CircularProgress size={12} /> : (returnedQtyFor(it.medicine) || '—')}
                        </TableCell>
                        <TableCell align="right">
                          {expired ? (
                            <Typography variant="caption" color="error.main">Expired</Typography>
                          ) : remaining <= 0 ? (
                            <Typography variant="caption" color="text.disabled">Fully returned</Typography>
                          ) : (
                            <TextField
                              type="number"
                              size="small"
                              value={returnQuantities[it.medicine] ?? ''}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(remaining, parseInt(e.target.value, 10) || 0));
                                setReturnQuantities((prev) => ({ ...prev, [it.medicine]: v ? String(v) : '' }));
                              }}
                              placeholder="0"
                              inputProps={{ min: 0, max: remaining, style: { width: 60, textAlign: 'right' } }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <TextField
                label="Return note / reason (optional)"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                fullWidth
                multiline
                rows={2}
                sx={{ mt: 2 }}
                helperText="Applies to whichever item(s) you enter a return quantity for above."
              />

              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                <Typography variant="body2">Total: <strong>{formatCurrency(viewSale.totalAmount)}</strong></Typography>
                {viewSale.totalReturned > 0 && (
                  <Typography variant="body2" color="warning.main">
                    Returned: <strong>{formatCurrency(viewSale.totalReturned)}</strong>
                  </Typography>
                )}
              </Box>

              {returns.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>Return History</Typography>
                  {returns.map((r) => (
                    <Box key={r._id} sx={{ mb: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="warning.main">
                          -{formatCurrency(r.totalRefund)}
                        </Typography>
                      </Box>
                      <Typography variant="body2">
                        {r.items.map((i) => `${i.medicineName} × ${i.quantity}`).join(', ')}
                      </Typography>
                      {r.reason && <Typography variant="caption" color="text.secondary">Reason: {r.reason}</Typography>}
                    </Box>
                  ))}
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setViewSale(null)} variant="outlined" color="inherit">Close</Button>
              <Button
                onClick={() => handlePrintInvoice(viewSale)}
                variant="outlined"
                startIcon={<Print />}
              >
                Print Invoice
              </Button>
              <Button
                onClick={openConfirmReturn}
                variant="contained"
                color="warning"
                startIcon={<AssignmentReturn />}
                disabled={viewSale.items.every((it) => isExpired(it) || returnedQtyFor(it.medicine) >= it.quantity)}
              >
                Process Return
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── Confirm Return Dialog — review just the items a quantity was entered for ── */}
      <Dialog open={returnDialogOpen} onClose={() => setReturnDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Return — {viewSale?.billNumber}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Review the item(s) below before confirming — stock will be added back and the
            refund deducted from this bill's revenue.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Refund</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itemsToReturn.map(({ item, quantity }) => (
                <TableRow key={item.medicine}>
                  <TableCell>{item.medicineName}</TableCell>
                  <TableCell align="right">{quantity}</TableCell>
                  <TableCell align="right">{formatCurrency(previewRefund(item, quantity))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight={700}>Total Refund</Typography>
            <Typography variant="body2" fontWeight={700} color="warning.main">
              {formatCurrency(itemsToReturn.reduce((sum, { item, quantity }) => sum + previewRefund(item, quantity), 0))}
            </Typography>
          </Box>
          {returnReason && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Note: {returnReason}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReturnDialogOpen(false)} color="inherit" variant="outlined">Back</Button>
          <Button onClick={handleSubmitReturn} variant="contained" color="warning" disabled={returnSaving}>
            {returnSaving ? 'Processing...' : 'Confirm Return'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesList;
