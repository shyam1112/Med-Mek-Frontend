import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, TextField, InputAdornment, Typography,
  Button, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Divider, MenuItem, Autocomplete, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, ToggleButton, ToggleButtonGroup, Chip,
} from '@mui/material';
import { Search, Delete, Save, Person, Print, CheckCircle, AddCircleOutline } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import QRCode from 'qrcode';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { printInvoice, InvoiceData as SavedBill } from '../../utils/printInvoice';

interface Medicine {
  _id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  packSize: string;
  sellingPrice: number;
  gstPercentage: number;
  currentStock: number;
  batchNumber: string;
  expiryDate?: string;
  scheduleClass?: 'None' | 'H' | 'H1' | 'X';
  location?: string;
}

const SCHEDULE_COLORS: Record<string, 'warning' | 'error'> = { H: 'warning', H1: 'warning', X: 'error' };

type DiscountMode = 'percent' | 'amount';

interface BillItem {
  medicine: Medicine;
  quantity: number;
  sellingPrice: number;
  discountMode: DiscountMode;
  discountValue: number;
  gstPercentage: number;
  total: number;
}

interface Customer {
  _id: string;
  name: string;
  mobile: string;
  address?: string;
}

interface Doctor {
  _id: string;
  name: string;
  specialization?: string;
  clinicName?: string;
}

const Billing: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [doctorOptions, setDoctorOptions] = useState<Doctor[]>([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [extraDiscountMode, setExtraDiscountMode] = useState<DiscountMode>('amount');
  const [extraDiscountValue, setExtraDiscountValue] = useState(0);
  const [cgstOverride, setCgstOverride] = useState<number | null>(null);
  const [sgstOverride, setSgstOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null);
  const [upiQr, setUpiQr] = useState('');
  const customerTimer = useRef<ReturnType<typeof setTimeout>>();
  const doctorTimer = useRef<ReturnType<typeof setTimeout>>();
  const { enqueueSnackbar } = useSnackbar();

  // Static UPI deep link, no gateway/API key — the pharmacist still manually
  // confirms payment and marks the bill UPI; this QR is just a convenience
  // so the customer doesn't have to type the store's UPI ID by hand.
  useEffect(() => {
    if (savedBill && savedBill.paymentMode === 'upi' && user?.storeUpiId) {
      const upiLink = `upi://pay?pa=${encodeURIComponent(user.storeUpiId)}&pn=${encodeURIComponent(user.storeName || 'Store')}&am=${savedBill.totalAmount.toFixed(2)}&tn=${encodeURIComponent(savedBill.billNumber)}`;
      QRCode.toDataURL(upiLink, { width: 200, margin: 1 })
        .then(setUpiQr)
        .catch(() => setUpiQr(''));
    } else {
      setUpiQr('');
    }
  }, [savedBill, user?.storeUpiId, user?.storeName]);

  const resetForm = () => {
    setItems([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerMobile('');
    setCustomerAddress('');
    setDoctorId('');
    setDoctorName('');
    setCustomerOptions([]);
    setDoctorOptions([]);
    setExtraDiscountMode('amount');
    setExtraDiscountValue(0);
    setCgstOverride(null);
    setSgstOverride(null);
    setPaymentMode('cash');
  };

  const searchCustomers = useCallback((q: string) => {
    clearTimeout(customerTimer.current);
    if (!q) { setCustomerOptions([]); return; }
    customerTimer.current = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const { data } = await api.get('/customers', { params: { search: q, limit: 10 } });
        setCustomerOptions(data.data || []);
      } finally {
        setCustomerLoading(false);
      }
    }, 280);
  }, []);

  const searchDoctors = useCallback((q: string) => {
    clearTimeout(doctorTimer.current);
    if (!q) { setDoctorOptions([]); return; }
    doctorTimer.current = setTimeout(async () => {
      setDoctorLoading(true);
      try {
        const { data } = await api.get('/doctors/search', { params: { q, limit: 10 } });
        setDoctorOptions(data.data || []);
      } finally {
        setDoctorLoading(false);
      }
    }, 280);
  }, []);

  // No matching doctor typed — offer to add them on the spot rather than
  // forcing a trip to the Doctors page, mirroring the inline-new-medicine
  // flow in Purchase Orders.
  const handleAddNewDoctor = async (name: string) => {
    setAddingDoctor(true);
    try {
      const { data } = await api.post('/doctors', { name });
      setDoctorId(data.data._id);
      setDoctorName(data.data.name);
      setDoctorOptions([]);
      enqueueSnackbar(`Added new doctor: ${data.data.name}`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to add doctor', { variant: 'error' });
    } finally {
      setAddingDoctor(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchLoading(true);
    try {
      const { data } = await api.get('/medicines/search', { params: { q: query } });
      setSearchResults(data.data);
    } finally {
      setSearchLoading(false);
    }
  };

  const addItem = (medicine: Medicine) => {
    const existing = items.findIndex((i) => i.medicine._id === medicine._id);
    if (existing >= 0) {
      const updated = [...items];
      updated[existing].quantity += 1;
      updated[existing].total = calcItemTotal(updated[existing]);
      setItems(updated);
    } else {
      const newItem: BillItem = {
        medicine,
        quantity: 1,
        sellingPrice: medicine.sellingPrice,
        discountMode: 'amount',
        discountValue: 0,
        gstPercentage: medicine.gstPercentage,
        total: medicine.sellingPrice * (1 + medicine.gstPercentage / 100),
      };
      setItems([...items, newItem]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const getItemDiscountAmount = (item: BillItem) => {
    const base = item.quantity * item.sellingPrice;
    return item.discountMode === 'percent'
      ? (base * Math.min(item.discountValue, 100)) / 100
      : item.discountValue;
  };

  const calcItemTotal = (item: BillItem) => {
    const base = item.quantity * item.sellingPrice;
    const gst = (base * item.gstPercentage) / 100;
    return base + gst - getItemDiscountAmount(item);
  };

  const updateItem = (idx: number, field: keyof BillItem, value: number) => {
    const updated = [...items];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    updated[idx].total = calcItemTotal(updated[idx]);
    setItems(updated);
  };

  const updateItemDiscountValue = (idx: number, value: number) => {
    const updated = [...items];
    const clamped = updated[idx].discountMode === 'percent' ? Math.min(Math.max(value, 0), 100) : Math.max(value, 0);
    updated[idx] = { ...updated[idx], discountValue: clamped };
    updated[idx].total = calcItemTotal(updated[idx]);
    setItems(updated);
  };

  const toggleItemDiscountMode = (idx: number) => {
    const updated = [...items];
    const newMode: DiscountMode = updated[idx].discountMode === 'percent' ? 'amount' : 'percent';
    updated[idx] = { ...updated[idx], discountMode: newMode, discountValue: 0 };
    updated[idx].total = calcItemTotal(updated[idx]);
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.sellingPrice, 0);
  const gstTotal = items.reduce((s, i) => s + (i.quantity * i.sellingPrice * i.gstPercentage) / 100, 0);
  const itemDiscounts = items.reduce((s, i) => s + getItemDiscountAmount(i), 0);

  // Default CGST/SGST split is half the blended GST rate across all items; the
  // user can override either as a percentage (never as a flat rupee amount).
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const autoSplitPercent = subtotal > 0 ? round2(gstTotal / subtotal / 2 * 100) : 0;
  const cgstPercent = cgstOverride ?? autoSplitPercent;
  const sgstPercent = sgstOverride ?? autoSplitPercent;
  const isGstOverridden = cgstOverride !== null || sgstOverride !== null;
  const cgstAmount = (subtotal * cgstPercent) / 100;
  const sgstAmount = (subtotal * sgstPercent) / 100;

  const preDiscountTotal = subtotal + cgstAmount + sgstAmount - itemDiscounts;
  const extraDiscountAmount = extraDiscountMode === 'percent'
    ? (preDiscountTotal * Math.min(extraDiscountValue, 100)) / 100
    : extraDiscountValue;
  const total = preDiscountTotal - extraDiscountAmount;

  const handleSave = async () => {
    if (items.length === 0) {
      enqueueSnackbar('Add at least one medicine', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId: customerId || undefined,
        customerName: customerName || 'Walk-in Customer',
        customerMobile,
        customerAddress,
        doctorId: doctorId || undefined,
        doctorName,
        paymentMode,
        discountAmount: extraDiscountAmount,
        cgstAmount: round2(cgstAmount),
        sgstAmount: round2(sgstAmount),
        items: items.map((i) => ({
          medicineId: i.medicine._id,
          quantity: i.quantity,
          discount: getItemDiscountAmount(i),
        })),
      };
      const { data } = await api.post('/billing', payload);
      setSavedBill(data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to create bill', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (savedBill) {
      printInvoice(savedBill, user?.storeName || '', user?.storeAddress || '', user?.storeGST || '', user?.storeDLNo || '');
    }
  };

  const handleNewBill = () => {
    setSavedBill(null);
    resetForm();
  };

  return (
    <>
      <Grid container spacing={2.5}>
        {/* Left: medicine search + cart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Autocomplete
                freeSolo
                options={searchResults}
                getOptionLabel={(o) => typeof o === 'string' ? o : `${o.name} (${o.batchNumber})`}
                inputValue={searchQuery}
                onInputChange={(_, v, reason) => { if (reason === 'input') { setSearchQuery(v); handleSearch(v); } }}
                onChange={(_, v) => { if (v && typeof v !== 'string') addItem(v as Medicine); }}
                onOpen={() => { if (searchResults.length === 0) handleSearch(searchQuery); }}
                loading={searchLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search medicine by name or barcode..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <>
                          {searchLoading && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={(option as Medicine)._id}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography variant="body2" fontWeight={600}>{(option as Medicine).name}</Typography>
                        {(option as Medicine).scheduleClass && (option as Medicine).scheduleClass !== 'None' && (
                          <Chip
                            label={`Rx · Sch. ${(option as Medicine).scheduleClass}`}
                            size="small"
                            color={SCHEDULE_COLORS[(option as Medicine).scheduleClass as string]}
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {(option as Medicine).genericName} • Batch: {(option as Medicine).batchNumber} •
                        Stock: {(option as Medicine).currentStock}
                        {(option as Medicine).location ? ` • Loc: ${(option as Medicine).location}` : ''}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} color="primary">
                      ₹{(option as Medicine).sellingPrice}
                    </Typography>
                  </Box>
                )}
              />
            </CardContent>
          </Card>

          {/* Bill items table */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Bill Items</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Medicine</TableCell>
                    <TableCell align="right">Rate (₹)</TableCell>
                    <TableCell align="center" sx={{ minWidth: 80 }}>Qty</TableCell>
                    <TableCell align="right">GST%</TableCell>
                    <TableCell align="right">Disc</TableCell>
                    <TableCell align="right">Total (₹)</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.medicine._id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{item.medicine.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Batch: {item.medicine.batchNumber} | Avl: {item.medicine.currentStock}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">₹{item.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          inputProps={{ min: 1, max: item.medicine.currentStock, style: { textAlign: 'center', width: 55 } }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{item.gstPercentage}%</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.discountValue}
                          onChange={(e) => updateItemDiscountValue(idx, parseFloat(e.target.value) || 0)}
                          inputProps={{
                            min: 0,
                            ...(item.discountMode === 'percent' ? { max: 100 } : {}),
                            style: { textAlign: 'right', width: 45 },
                          }}
                          size="small"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end" sx={{ ml: 0 }}>
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={() => toggleItemDiscountMode(idx)}
                                  title="Toggle % / ₹"
                                  sx={{
                                    border: 'none', bgcolor: 'action.hover', borderRadius: 1, cursor: 'pointer',
                                    px: 0.6, py: 0.2, fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary',
                                    '&:hover': { bgcolor: 'action.selected' },
                                  }}
                                >
                                  {item.discountMode === 'percent' ? '%' : '₹'}
                                </Box>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700}>₹{item.total.toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.disabled' }}>
                        Search and add medicines above
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: customer + totals */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Customer Details</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Autocomplete
                  freeSolo
                  options={customerOptions}
                  loading={customerLoading}
                  getOptionLabel={(o) => typeof o === 'string' ? o : `${o.name} — ${o.mobile}`}
                  filterOptions={(x) => x}
                  inputValue={customerName}
                  onInputChange={(_, val, reason) => {
                    setCustomerName(val);
                    if (reason === 'input') {
                      setCustomerId('');
                      searchCustomers(val);
                    }
                  }}
                  onChange={(_, val) => {
                    if (val && typeof val !== 'string') {
                      setCustomerId(val._id);
                      setCustomerName(val.name);
                      setCustomerMobile(val.mobile);
                      setCustomerAddress(val.address || '');
                      setCustomerOptions([]);
                    }
                  }}
                  renderOption={(props, opt) => (
                    <Box component="li" {...props} key={(opt as Customer)._id}>
                      <Person sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{(opt as Customer).name}</Typography>
                        <Typography variant="caption" color="text.secondary">{(opt as Customer).mobile}</Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Name"
                      placeholder="Search or type name..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {customerLoading ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <TextField
                  label="Mobile Number"
                  value={customerMobile}
                  onChange={(e) => {
                    setCustomerMobile(e.target.value);
                    setCustomerId('');
                    searchCustomers(e.target.value);
                  }}
                  placeholder="Leave empty for walk-in"
                  fullWidth
                  inputProps={{ maxLength: 15 }}
                  helperText={customerId ? '✓ Existing customer linked' : customerMobile ? 'New customer will be saved automatically' : ''}
                  FormHelperTextProps={{ sx: { color: customerId ? 'success.main' : 'text.secondary' } }}
                />
                <TextField
                  label="Address (optional)"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="For invoice — shown if provided"
                  fullWidth
                  multiline
                  rows={2}
                />
                <Autocomplete
                  freeSolo
                  options={
                    doctorName.trim() && !doctorOptions.some((d) => d.name.toLowerCase() === doctorName.trim().toLowerCase())
                      ? [...doctorOptions, { _id: '__new__', name: doctorName.trim() } as Doctor]
                      : doctorOptions
                  }
                  loading={doctorLoading || addingDoctor}
                  getOptionLabel={(o) => typeof o === 'string' ? o : (o as Doctor).name}
                  filterOptions={(x) => x}
                  inputValue={doctorName}
                  onInputChange={(_, val, reason) => {
                    setDoctorName(val);
                    if (reason === 'input') {
                      setDoctorId('');
                      searchDoctors(val);
                    }
                  }}
                  onChange={(_, val) => {
                    if (!val || typeof val === 'string') return;
                    const d = val as Doctor;
                    if (d._id === '__new__') {
                      handleAddNewDoctor(d.name);
                    } else {
                      setDoctorId(d._id);
                      setDoctorName(d.name);
                      setDoctorOptions([]);
                    }
                  }}
                  renderOption={(props, opt) => {
                    const d = opt as Doctor;
                    const isNew = d._id === '__new__';
                    return (
                      <Box component="li" {...props} key={d._id}>
                        {isNew ? (
                          <Typography variant="body2" color="primary.main" fontWeight={600}>
                            + Add &quot;{d.name}&quot; as new doctor
                          </Typography>
                        ) : (
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                            {(d.specialization || d.clinicName) && (
                              <Typography variant="caption" color="text.secondary">
                                {[d.specialization, d.clinicName].filter(Boolean).join(' · ')}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Doctor Name (optional)"
                      placeholder="Search or add prescribing doctor..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {(doctorLoading || addingDoctor) ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                      helperText={doctorId ? '✓ Existing doctor linked' : ''}
                      FormHelperTextProps={{ sx: { color: 'success.main' } }}
                    />
                  )}
                />
                <TextField
                  select
                  label="Payment Mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  fullWidth
                >
                  {['cash', 'card', 'upi', 'credit'].map((m) => (
                    <MenuItem key={m} value={m}>{m.toUpperCase()}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </CardContent>
          </Card>

          {/* Bill summary */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>Bill Summary</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                <Typography variant="body2">₹{subtotal.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1 }}>
                <Typography variant="body2" color="text.secondary">CGST</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    type="number"
                    value={cgstPercent}
                    onChange={(e) => setCgstOverride(Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 50))}
                    size="small"
                    inputProps={{ min: 0, max: 50, step: 0.5, style: { width: 55, textAlign: 'right' } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                  <Typography variant="body2" sx={{ width: 72, textAlign: 'right' }}>₹{cgstAmount.toFixed(2)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1 }}>
                <Typography variant="body2" color="text.secondary">SGST</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    type="number"
                    value={sgstPercent}
                    onChange={(e) => setSgstOverride(Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 50))}
                    size="small"
                    inputProps={{ min: 0, max: 50, step: 0.5, style: { width: 55, textAlign: 'right' } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                  <Typography variant="body2" sx={{ width: 72, textAlign: 'right' }}>₹{sgstAmount.toFixed(2)}</Typography>
                </Box>
              </Box>
              {isGstOverridden && (
                <Box sx={{ textAlign: 'right', mb: 1 }}>
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => { setCgstOverride(null); setSgstOverride(null); }}
                  >
                    Reset to auto ({autoSplitPercent}% each)
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Item Discounts</Typography>
                <Typography variant="body2">-₹{itemDiscounts.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Extra Discount</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={extraDiscountMode}
                      onChange={(_, v) => { if (v) { setExtraDiscountMode(v); setExtraDiscountValue(0); } }}
                    >
                      <ToggleButton value="percent" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>%</ToggleButton>
                      <ToggleButton value="amount" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>₹</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField
                      type="number"
                      value={extraDiscountValue}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setExtraDiscountValue(extraDiscountMode === 'percent' ? Math.min(Math.max(v, 0), 100) : Math.max(v, 0));
                      }}
                      size="small"
                      inputProps={{
                        min: 0,
                        ...(extraDiscountMode === 'percent' ? { max: 100 } : {}),
                        style: { width: 70, textAlign: 'right' },
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end" sx={{ ml: 0 }}>
                            {extraDiscountMode === 'percent' ? '%' : '₹'}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                </Box>
                {extraDiscountMode === 'percent' && extraDiscountValue > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                    − ₹{extraDiscountAmount.toFixed(2)}
                  </Typography>
                )}
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" fontWeight={700}>Total</Typography>
                <Typography variant="h6" fontWeight={700} color="primary">
                  ₹{Math.max(0, total).toFixed(2)}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving || items.length === 0}
                fullWidth
              >
                {saving ? 'Processing...' : 'Save Bill'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Bill Saved Dialog ── */}
      <Dialog open={!!savedBill} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography component="span" variant="h6" fontWeight={700} sx={{ display: 'block' }}>Bill Created!</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', pb: 1 }}>
            <Typography variant="h5" fontWeight={800} color="primary.main" mb={0.5}>
              {savedBill?.billNumber}
            </Typography>
            {savedBill?.customerName !== 'Walk-in Customer' && (
              <Typography variant="body2" color="text.secondary" mb={0.5}>
                {savedBill?.customerName}
                {savedBill?.customerMobile ? ` · ${savedBill.customerMobile}` : ''}
              </Typography>
            )}
            <Typography variant="h5" fontWeight={700} mt={1}>
              ₹{savedBill?.totalAmount.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {savedBill?.items.length} item{savedBill && savedBill.items.length !== 1 ? 's' : ''} · {savedBill?.paymentMode.toUpperCase()}
            </Typography>
            {upiQr && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box component="img" src={upiQr} alt="UPI QR Code" sx={{ width: 180, height: 180, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }} />
                <Typography variant="caption" color="text.secondary">Scan to pay via UPI</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5, flexDirection: 'column' }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<Print />}
            onClick={handlePrint}
          >
            Print Bill
          </Button>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            startIcon={<AddCircleOutline />}
            onClick={handleNewBill}
          >
            New Bill
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Billing;
