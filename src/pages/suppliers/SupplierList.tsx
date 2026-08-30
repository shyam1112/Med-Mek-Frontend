import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, TextField, InputAdornment, IconButton, Tooltip,
  Typography, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Table, TableHead, TableRow, TableCell, TableBody, Card, CardContent,
  CircularProgress, Divider,
} from '@mui/material';
import { Add, Search, Edit, Delete, Assessment } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../api';
import { useSnackbar } from 'notistack';

interface Supplier {
  _id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  outstandingBalance: number;
}

interface YearRow {
  _id: number;
  orders: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

interface StatementData {
  supplier: Supplier;
  summary: { totalOrders: number; totalAmount: number; totalPaid: number; totalBalance: number };
  yearlyBreakdown: YearRow[];
  recentPurchases: Array<{
    _id: string;
    invoiceNumber: string;
    purchaseDate: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: 'pending' | 'partial' | 'paid';
  }>;
}

const STATUS_COLORS = { pending: 'error', partial: 'warning', paid: 'success' } as const;
const EMPTY_FORM = { name: '', contactPerson: '', phone: '', email: '', address: '', gstNumber: '' };

const SummaryCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Card variant="outlined">
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={700} color={color || 'text.primary'}>{value}</Typography>
    </CardContent>
  </Card>
);

const SupplierList: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Statement
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: page + 1, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/suppliers', { params });
      setSuppliers(data.data);
      setTotal(data.pagination.total);
    } catch {
      enqueueSnackbar('Failed to fetch suppliers', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, enqueueSnackbar]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openStatement = async (s: Supplier) => {
    setStatementOpen(true);
    setStatementLoading(true);
    setStatementData(null);
    try {
      const { data } = await api.get(`/suppliers/${s._id}/statement`);
      setStatementData(data.data);
    } catch {
      enqueueSnackbar('Failed to load statement', { variant: 'error' });
      setStatementOpen(false);
    } finally {
      setStatementLoading(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditSupplier(null); setDialogOpen(true); };
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, contactPerson: s.contactPerson, phone: s.phone, email: s.email, address: s.address, gstNumber: s.gstNumber });
    setEditSupplier(s);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) { enqueueSnackbar('Name and phone are required', { variant: 'warning' }); return; }
    setSaving(true);
    try {
      if (editSupplier) {
        await api.put(`/suppliers/${editSupplier._id}`, form);
        enqueueSnackbar('Supplier updated', { variant: 'success' });
      } else {
        await api.post('/suppliers', form);
        enqueueSnackbar('Supplier added', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchSuppliers();
    } catch {
      enqueueSnackbar('Failed to save supplier', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/suppliers/${deleteId}`);
      enqueueSnackbar('Supplier deleted', { variant: 'success' });
      fetchSuppliers();
    } catch {
      enqueueSnackbar('Failed to delete', { variant: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const columns = [
    {
      id: 'name', label: 'Supplier Name', minWidth: 200,
      render: (row: Supplier) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
          <Typography variant="caption" color="text.secondary">{row.contactPerson}</Typography>
        </Box>
      ),
    },
    { id: 'phone', label: 'Phone', minWidth: 130 },
    { id: 'email', label: 'Email', minWidth: 180 },
    { id: 'gstNumber', label: 'GST No.', minWidth: 160 },
    {
      id: 'outstandingBalance', label: 'Pending Payment', minWidth: 140, align: 'right' as const,
      render: (row: Supplier) => (
        <Chip
          label={`₹${row.outstandingBalance.toFixed(0)}`}
          color={row.outstandingBalance > 0 ? 'error' : 'success'}
          size="small"
          variant={row.outstandingBalance > 0 ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      id: 'actions', label: '', align: 'right' as const,
      render: (row: Supplier) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="View Statement">
            <IconButton size="small" color="info" onClick={() => openStatement(row)}>
              <Assessment fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => openEdit(row)}>
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
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>Add Supplier</Button>
      </Box>

      <DataTable
        columns={columns}
        rows={suppliers}
        loading={loading}
        total={total}
        page={page}
        rowsPerPage={20}
        onPageChange={setPage}
        keyExtractor={(row) => row._id}
      />

      {/* ── Supplier Statement Dialog ── */}
      <Dialog open={statementOpen} onClose={() => setStatementOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {statementData ? `Supplier Statement — ${statementData.supplier.name}` : 'Supplier Statement'}
        </DialogTitle>
        <DialogContent>
          {statementLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : statementData ? (
            <Box>
              {/* Summary cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <SummaryCard label="Total Orders" value={String(statementData.summary.totalOrders)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <SummaryCard label="Total Purchased" value={`₹${statementData.summary.totalAmount.toFixed(0)}`} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <SummaryCard label="Total Paid" value={`₹${statementData.summary.totalPaid.toFixed(0)}`} color="success.main" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <SummaryCard
                    label="Pending Payment"
                    value={`₹${statementData.summary.totalBalance.toFixed(0)}`}
                    color={statementData.summary.totalBalance > 0 ? 'error.main' : 'success.main'}
                  />
                </Grid>
              </Grid>

              {/* Supplier info */}
              <Box sx={{ mb: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {statementData.supplier.phone && <Typography variant="body2">📞 {statementData.supplier.phone}</Typography>}
                {statementData.supplier.email && <Typography variant="body2">✉️ {statementData.supplier.email}</Typography>}
                {statementData.supplier.gstNumber && <Typography variant="body2">GST: {statementData.supplier.gstNumber}</Typography>}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Year-wise breakdown */}
              {statementData.yearlyBreakdown.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Year-wise Summary</Typography>
                  <Table size="small" sx={{ mb: 3 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell><strong>Year</strong></TableCell>
                        <TableCell align="right"><strong>Orders</strong></TableCell>
                        <TableCell align="right"><strong>Total Amount</strong></TableCell>
                        <TableCell align="right"><strong>Amount Paid</strong></TableCell>
                        <TableCell align="right"><strong>Pending</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statementData.yearlyBreakdown.map((row) => (
                        <TableRow key={row._id} hover>
                          <TableCell><Typography variant="body2" fontWeight={600}>{row._id}</Typography></TableCell>
                          <TableCell align="right">{row.orders}</TableCell>
                          <TableCell align="right">₹{row.totalAmount.toFixed(0)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>₹{row.paidAmount.toFixed(0)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={row.balanceAmount > 0 ? 700 : 400}
                              color={row.balanceAmount > 0 ? 'error.main' : 'success.main'}
                            >
                              ₹{row.balanceAmount.toFixed(0)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {/* Recent purchase orders */}
              {statementData.recentPurchases.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Recent Purchase Orders</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell><strong>Invoice</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                        <TableCell align="right"><strong>Paid</strong></TableCell>
                        <TableCell align="right"><strong>Pending</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statementData.recentPurchases.map((p) => (
                        <TableRow key={p._id} hover>
                          <TableCell><Typography variant="body2" fontWeight={600}>{p.invoiceNumber}</Typography></TableCell>
                          <TableCell>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell align="right">₹{p.totalAmount.toFixed(0)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>₹{p.paidAmount.toFixed(0)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color={p.balanceAmount > 0 ? 'error.main' : 'success.main'} fontWeight={p.balanceAmount > 0 ? 700 : 400}>
                              ₹{p.balanceAmount.toFixed(0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={p.paymentStatus.toUpperCase()} color={STATUS_COLORS[p.paymentStatus]} size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {statementData.recentPurchases.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                  No purchase orders yet for this supplier.
                </Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatementOpen(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {[
              { field: 'name', label: 'Supplier Name *' },
              { field: 'contactPerson', label: 'Contact Person' },
              { field: 'phone', label: 'Phone *' },
              { field: 'email', label: 'Email' },
              { field: 'gstNumber', label: 'GST Number' },
              { field: 'address', label: 'Address' },
            ].map(({ field, label }) => (
              <Grid item xs={12} sm={6} key={field}>
                <TextField
                  label={label}
                  value={(form as Record<string, string>)[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  fullWidth
                  multiline={field === 'address'}
                  rows={field === 'address' ? 2 : 1}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editSupplier ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default SupplierList;
