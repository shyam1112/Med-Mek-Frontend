import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, TextField, InputAdornment, IconButton, Tooltip,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Divider,
  Accordion, AccordionSummary, AccordionDetails, CircularProgress,
} from '@mui/material';
import { Add, Search, Edit, Delete, Receipt, ExpandMore } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../api';
import { useSnackbar } from 'notistack';

interface Customer {
  _id: string;
  name: string;
  mobile: string;
  address: string;
  totalPurchases: number;
  createdAt: string;
}

interface BillItem {
  medicineName: string;
  quantity: number;
  sellingPrice: number;
  gstPercentage: number;
  discount: number;
  totalAmount: number;
}

interface Bill {
  _id: string;
  billNumber: string;
  saleDate: string;
  items: BillItem[];
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalReturned: number;
  paymentMode: string;
}

interface ReturnItem {
  medicineName: string;
  quantity: number;
  refundAmount: number;
}

interface BillReturn {
  _id: string;
  items: ReturnItem[];
  totalRefund: number;
  reason: string;
  createdAt: string;
}

const PAYMENT_COLORS: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  cash: 'success', upi: 'info', card: 'warning', credit: 'default',
};

const EMPTY = { name: '', mobile: '', address: '' };

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bill history state
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [returnsBySale, setReturnsBySale] = useState<Record<string, BillReturn[]>>({});
  const [returnsLoadingSale, setReturnsLoadingSale] = useState<Record<string, boolean>>({});

  const { enqueueSnackbar } = useSnackbar();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/customers', { params });
      setCustomers(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch customers', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, enqueueSnackbar]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer);
    setBills([]);
    setReturnsBySale({});
    setReturnsLoadingSale({});
    setBillsLoading(true);
    try {
      const { data } = await api.get(`/customers/${customer._id}/billing`, { params: { limit: 50 } });
      setBills(data.data || []);
    } catch {
      enqueueSnackbar('Failed to load bill history', { variant: 'error' });
    } finally {
      setBillsLoading(false);
    }
  };

  // Loaded lazily as each bill's accordion is expanded, rather than N+1
  // fetching return details for every bill up front.
  const loadReturnsForSale = useCallback(async (saleId: string) => {
    if (returnsBySale[saleId] || returnsLoadingSale[saleId]) return;
    setReturnsLoadingSale((prev) => ({ ...prev, [saleId]: true }));
    try {
      const { data } = await api.get('/returns', { params: { saleId } });
      setReturnsBySale((prev) => ({ ...prev, [saleId]: data.data || [] }));
    } catch {
      enqueueSnackbar('Failed to load return details', { variant: 'error' });
    } finally {
      setReturnsLoadingSale((prev) => ({ ...prev, [saleId]: false }));
    }
  }, [returnsBySale, returnsLoadingSale, enqueueSnackbar]);

  const handleSave = async () => {
    if (!form.name) { enqueueSnackbar('Name is required', { variant: 'warning' }); return; }
    setSaving(true);
    try {
      if (editCustomer) {
        await api.put(`/customers/${editCustomer._id}`, form);
        enqueueSnackbar('Customer updated', { variant: 'success' });
      } else {
        await api.post('/customers', form);
        enqueueSnackbar('Customer added', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch {
      enqueueSnackbar('Failed to save customer', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      id: 'name', label: 'Customer Name', minWidth: 180,
      render: (row: Customer) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
          {row.mobile && <Typography variant="caption" color="text.secondary">{row.mobile}</Typography>}
        </Box>
      ),
    },
    {
      id: 'address', label: 'Address', minWidth: 180,
      render: (row: Customer) => row.address || <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      id: 'totalPurchases', label: 'Total Spent', align: 'right' as const, minWidth: 130,
      render: (row: Customer) => (
        <Typography variant="body2" fontWeight={700} color="primary.main">
          ₹{row.totalPurchases.toFixed(0)}
        </Typography>
      ),
    },
    {
      id: 'createdAt', label: 'Customer Since', minWidth: 120,
      render: (row: Customer) => new Date(row.createdAt).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions', label: '', align: 'right' as const,
      render: (row: Customer) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Bill History">
            <IconButton size="small" color="info" onClick={() => openHistory(row)}>
              <Receipt fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => {
              setForm({ name: row.name, mobile: row.mobile, address: row.address });
              setEditCustomer(row);
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
          placeholder="Search customers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm(EMPTY); setEditCustomer(null); setDialogOpen(true); }}>
          Add Customer
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={customers}
        loading={loading}
        total={total}
        page={page}
        rowsPerPage={20}
        onPageChange={setPage}
        keyExtractor={(row) => row._id}
      />

      {/* ── Bill History Dialog ── */}
      <Dialog open={!!historyCustomer} onClose={() => setHistoryCustomer(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Receipt color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>{historyCustomer?.name}</Typography>
              {historyCustomer?.mobile && (
                <Typography variant="caption" color="text.secondary">{historyCustomer.mobile}</Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {billsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : bills.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Receipt sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No bills found for this customer.</Typography>
            </Box>
          ) : (
            <Box>
              {/* Summary row */}
              <Box sx={{ display: 'flex', gap: 3, mb: 2.5, p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.100' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Bills</Typography>
                  <Typography variant="h6" fontWeight={700}>{bills.length}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Spent (net)</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    ₹{bills.reduce((s, b) => s + b.totalAmount - (b.totalReturned || 0), 0).toFixed(0)}
                  </Typography>
                </Box>
                {bills.some((b) => b.totalReturned > 0) && (
                  <>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Total Returned</Typography>
                      <Typography variant="h6" fontWeight={700} color="warning.main">
                        ₹{bills.reduce((s, b) => s + (b.totalReturned || 0), 0).toFixed(0)}
                      </Typography>
                    </Box>
                  </>
                )}
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Last Visit</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {new Date(bills[0].saleDate).toLocaleDateString('en-IN')}
                  </Typography>
                </Box>
              </Box>

              {/* Bills list — each bill expandable to show items */}
              {bills.map((bill) => (
                <Accordion
                  key={bill._id}
                  disableGutters
                  elevation={0}
                  sx={{ border: '1px solid', borderColor: 'divider', mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}
                  onChange={(_, expanded) => { if (expanded && bill.totalReturned > 0) loadReturnsForSale(bill._id); }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Grid container alignItems="center" spacing={1}>
                      <Grid item xs={12} sm={2}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {bill.billNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(bill.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">
                          {bill.items.map((i) => i.medicineName).join(', ')}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <Chip
                          label={bill.paymentMode.toUpperCase()}
                          size="small"
                          color={PAYMENT_COLORS[bill.paymentMode] || 'default'}
                          variant="outlined"
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        {bill.totalReturned > 0 ? (
                          <Chip label={`Returned ₹${bill.totalReturned.toFixed(0)}`} size="small" color="warning" />
                        ) : (
                          <Chip label="Completed" size="small" color="success" variant="outlined" />
                        )}
                      </Grid>
                      <Grid item xs={6} sm={2} sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" fontWeight={700}>
                          ₹{bill.totalAmount.toFixed(0)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Medicine</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Rate (₹)</TableCell>
                          <TableCell align="right">GST%</TableCell>
                          <TableCell align="right">Disc (₹)</TableCell>
                          <TableCell align="right">Total (₹)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bill.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.medicineName}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">₹{item.sellingPrice.toFixed(2)}</TableCell>
                            <TableCell align="right">{item.gstPercentage}%</TableCell>
                            <TableCell align="right">{item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>₹{item.totalAmount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, mt: 1.5, pr: 1 }}>
                      <Typography variant="caption" color="text.secondary">Subtotal: ₹{bill.subtotal.toFixed(2)}</Typography>
                      <Typography variant="caption" color="text.secondary">GST: ₹{bill.gstAmount.toFixed(2)}</Typography>
                      {bill.discountAmount > 0 && <Typography variant="caption" color="success.main">Discount: -₹{bill.discountAmount.toFixed(2)}</Typography>}
                      <Typography variant="body2" fontWeight={700}>Total: ₹{bill.totalAmount.toFixed(2)}</Typography>
                    </Box>

                    {bill.totalReturned > 0 && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="subtitle2" fontWeight={700} mb={1}>Return History</Typography>
                        {returnsLoadingSale[bill._id] ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={20} />
                          </Box>
                        ) : (
                          (returnsBySale[bill._id] || []).map((r) => (
                            <Box key={r._id} sx={{ mb: 1, p: 1.5, bgcolor: 'warning.50', borderRadius: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </Typography>
                                <Typography variant="body2" fontWeight={700} color="warning.main">
                                  -₹{r.totalRefund.toFixed(2)}
                                </Typography>
                              </Box>
                              <Typography variant="body2">
                                {r.items.map((i) => `${i.medicineName} × ${i.quantity}`).join(', ')}
                              </Typography>
                              {r.reason && (
                                <Typography variant="caption" color="text.secondary">Reason: {r.reason}</Typography>
                              )}
                            </Box>
                          ))
                        )}
                      </>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHistoryCustomer(null)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} fullWidth />
            <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} fullWidth multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" variant="outlined">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editCustomer ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Customer"
        message="Delete this customer?"
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleteId) return;
          await api.delete(`/customers/${deleteId}`);
          enqueueSnackbar('Customer deleted', { variant: 'success' });
          setDeleteId(null);
          fetchCustomers();
        }}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default CustomerList;
