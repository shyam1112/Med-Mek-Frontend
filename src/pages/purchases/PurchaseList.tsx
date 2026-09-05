import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, Typography, TextField, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Autocomplete, Table, TableHead, TableRow, TableCell, TableBody, Divider,
  CircularProgress,
} from '@mui/material';
import { Add, Visibility, Payment, Print } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import api from '../../api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { printPurchaseOrder } from '../../utils/printPurchaseOrder';

interface Purchase {
  _id: string;
  invoiceNumber: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  items: Array<{ medicineName: string; quantity: number; purchasePrice: number; totalAmount: number }>;
}

interface Supplier { _id: string; name: string }

interface MedicineOption {
  _id: string;
  name: string;
  genericName: string;
  category?: string;
  batchNumber?: string;
  gstPercentage: number;
  currentStock?: number;
  manufacturer?: string;
  dosageForm?: string;
  strength?: string;
  suggestedMRP?: number;
  unitOfMeasure?: string;
  unitsPerPack?: number;
  source: 'inventory' | 'catalog';
}

interface PurchaseItem {
  medicineId: string;
  isNew: boolean;
  newMedicineName: string;
  newGenericName: string;
  newCategory: string;
  newManufacturer: string;
  newDosageForm: string;
  newStrength: string;
  newPackSize: string;
  newBarcode: string;
  newMinimumStockLevel: string;
  newHsnCode: string;
  newScheduleClass: string;
  newUnitOfMeasure: string;
  newUnitsPerPack: string;
  newStorageCondition: string;
  sellingPrice: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  gstPercentage: number;
  // Carried over from the picked existing-inventory medicine (see
  // handleMedicineSelect) so the "units added" readout below Qty works for
  // restocking an existing medicine too, not just newly-created ones.
  selectedUnitOfMeasure: string;
  selectedUnitsPerPack: number;
}

const EMPTY_ITEM: PurchaseItem = {
  medicineId: '', isNew: false,
  newMedicineName: '', newGenericName: '', newCategory: 'Other',
  newManufacturer: '', newDosageForm: '', newStrength: '', newPackSize: '',
  newBarcode: '', newMinimumStockLevel: '10',
  selectedUnitOfMeasure: 'Strip', selectedUnitsPerPack: 1,
  newHsnCode: '', newScheduleClass: 'None', newUnitOfMeasure: 'Strip', newUnitsPerPack: '1', newStorageCondition: '',
  sellingPrice: '',
  batchNumber: '', expiryDate: '',
  quantity: 1, purchasePrice: 0, gstPercentage: 12,
};

const STATUS_COLORS = { pending: 'error', partial: 'warning', paid: 'success' } as const;

const CATEGORIES = [
  'Analgesic', 'Antibiotic', 'Antacid', 'Antifungal', 'Antihistamine',
  'Antiviral', 'Cardiovascular', 'Diabetes', 'Dermatology', 'ENT',
  'Eye/Ear', 'Gastrointestinal', 'Hormones', 'Nutritional', 'Orthopedic',
  'Pediatric', 'Psychiatric', 'Respiratory', 'Surgical', 'Vitamins', 'Other',
];

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment',
  'Cream', 'Gel', 'Lotion', 'Drops', 'Inhaler', 'Spray', 'Powder',
  'Sachet', 'Suppository', 'Patch',
];

const UNIT_OPTIONS = ['Strip', 'Bottle', 'Box', 'Tube', 'Vial', 'Piece'];
const SCHEDULE_OPTIONS = ['None', 'H', 'H1', 'X'];

const PurchaseList: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  const [searchOptions, setSearchOptions] = useState<MedicineOption[][]>([[]]);
  const [searchLoading, setSearchLoading] = useState<boolean[]>([false]);
  const [inputValues, setInputValues] = useState<string[]>(['']);
  const searchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchases', { params: { page: page + 1, limit: 20 } });
      setPurchases(data.data);
      setTotal(data.pagination.total);
    } finally { setLoading(false); }
  }, [page]);

  // Fetches fresh (rather than reusing the list row) so the printout gets the
  // supplier's actual address/phone/GSTIN — the list/view state only carries
  // the denormalized supplierName, not the full supplier record.
  const handlePrintPurchase = async (purchaseId: string) => {
    try {
      const { data } = await api.get(`/purchases/${purchaseId}`);
      printPurchaseOrder(
        data.data,
        user?.storeName || '', user?.storeAddress || '', user?.storeGST || '', user?.storeDLNo || ''
      );
    } catch {
      enqueueSnackbar('Failed to load purchase order for printing', { variant: 'error' });
    }
  };

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => {
    api.get('/suppliers', { params: { limit: 100 } }).then(({ data }) => setSuppliers(data.data));
  }, []);

  const resetCreate = () => {
    setSelectedSupplier(null);
    setItems([{ ...EMPTY_ITEM }]);
    setSearchOptions([[]]);
    setSearchLoading([false]);
    setInputValues(['']);
  };

  const addItem = () => {
    setItems((p) => [...p, { ...EMPTY_ITEM }]);
    setSearchOptions((p) => [...p, []]);
    setSearchLoading((p) => [...p, false]);
    setInputValues((p) => [...p, '']);
  };

  const removeItem = (idx: number) => {
    setItems((p) => p.filter((_, i) => i !== idx));
    setSearchOptions((p) => p.filter((_, i) => i !== idx));
    setSearchLoading((p) => p.filter((_, i) => i !== idx));
    setInputValues((p) => p.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof PurchaseItem, value: unknown) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleMedicineSearch = (idx: number, q: string) => {
    setInputValues((prev) => { const v = [...prev]; v[idx] = q; return v; });
    if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
    if (!q) {
      setSearchOptions((opts) => { const o = [...opts]; o[idx] = []; return o; });
      return;
    }
    searchTimers.current[idx] = setTimeout(async () => {
      setSearchLoading((p) => { const l = [...p]; l[idx] = true; return l; });
      try {
        const [invRes, catRes] = await Promise.all([
          api.get('/medicines/search', { params: { q } }),
          api.get('/catalog/search', { params: { q, limit: 8 } }),
        ]);
        const inv: MedicineOption[] = (invRes.data.data || []).map((m: MedicineOption) => ({ ...m, source: 'inventory' as const }));
        const invNames = new Set(inv.map((m) => m.name.toLowerCase()));
        const cat: MedicineOption[] = (catRes.data.data || [])
          .filter((c: MedicineOption) => !invNames.has(c.name.toLowerCase()))
          .map((c: MedicineOption) => ({ ...c, source: 'catalog' as const }));
        setSearchOptions((opts) => { const o = [...opts]; o[idx] = [...inv, ...cat]; return o; });
      } finally {
        setSearchLoading((p) => { const l = [...p]; l[idx] = false; return l; });
      }
    }, 280);
  };

  const handleMedicineSelect = (idx: number, opt: MedicineOption | null) => {
    if (!opt) {
      setItems((p) => { const u = [...p]; u[idx] = { ...EMPTY_ITEM }; return u; });
      setInputValues((p) => { const v = [...p]; v[idx] = ''; return v; });
      return;
    }
    if (opt.source === 'inventory') {
      setItems((p) => {
        const u = [...p];
        u[idx] = {
          ...u[idx], medicineId: opt._id, isNew: false, newMedicineName: '', gstPercentage: opt.gstPercentage,
          selectedUnitOfMeasure: opt.unitOfMeasure || 'Strip', selectedUnitsPerPack: opt.unitsPerPack || 1,
        };
        return u;
      });
    } else {
      setItems((p) => {
        const u = [...p];
        u[idx] = {
          ...u[idx], medicineId: '', isNew: true,
          newMedicineName: opt.name, newGenericName: opt.genericName || '',
          newCategory: opt.category || 'Other', newManufacturer: opt.manufacturer || '',
          newDosageForm: opt.dosageForm || '', newStrength: opt.strength || '',
          sellingPrice: opt.suggestedMRP ? String(opt.suggestedMRP) : '',
          gstPercentage: opt.gstPercentage,
        };
        return u;
      });
    }
    setInputValues((p) => { const v = [...p]; v[idx] = opt.name; return v; });
  };

  // If the user types a name that matches nothing in inventory/catalog and moves on,
  // treat it as a brand-new custom medicine instead of forcing a dropdown pick.
  const handleCustomNameCommit = (idx: number) => {
    const typed = (inputValues[idx] || '').trim();
    const current = items[idx];
    if (!typed || current.medicineId || current.isNew) return;
    setItems((p) => {
      const u = [...p];
      u[idx] = { ...u[idx], isNew: true, newMedicineName: typed };
      return u;
    });
  };

  const handleCreate = async () => {
    if (!selectedSupplier) { enqueueSnackbar('Select a supplier', { variant: 'warning' }); return; }
    for (const it of items) {
      if (!it.isNew && !it.medicineId) { enqueueSnackbar('Select a medicine from dropdown for all items', { variant: 'warning' }); return; }
      if (it.isNew && !it.newMedicineName.trim()) { enqueueSnackbar('Medicine name is required', { variant: 'warning' }); return; }
      if (it.isNew && !it.sellingPrice) { enqueueSnackbar('Selling price (MRP) is required for new medicines', { variant: 'warning' }); return; }
      if (it.isNew && !it.expiryDate) { enqueueSnackbar('Expiry date is required for new medicines', { variant: 'warning' }); return; }
    }
    setSaving(true);
    try {
      await api.post('/purchases', {
        supplierId: selectedSupplier._id,
        paidAmount: 0,
        items: items.map((it) =>
          it.isNew
            ? {
                newMedicine: {
                  name: it.newMedicineName, genericName: it.newGenericName,
                  category: it.newCategory, manufacturer: it.newManufacturer,
                  dosageForm: it.newDosageForm, strength: it.newStrength, packSize: it.newPackSize,
                  barcode: it.newBarcode,
                  hsnCode: it.newHsnCode, scheduleClass: it.newScheduleClass,
                  unitOfMeasure: it.newUnitOfMeasure, unitsPerPack: parseInt(it.newUnitsPerPack, 10) || 1,
                  storageCondition: it.newStorageCondition,
                  // Entered in packs (matching the field label) — converted
                  // to individual units, the same denomination currentStock
                  // (and the low-stock comparison) uses.
                  minimumStockLevel: (parseInt(it.newMinimumStockLevel, 10) || 10) * (parseInt(it.newUnitsPerPack, 10) || 1),
                  gstPercentage: it.gstPercentage,
                  sellingPrice: parseFloat(it.sellingPrice) || 0,
                },
                batchNumber: it.batchNumber, expiryDate: it.expiryDate || undefined,
                quantity: it.quantity, purchasePrice: it.purchasePrice, gstPercentage: it.gstPercentage,
              }
            : {
                medicineId: it.medicineId, batchNumber: it.batchNumber, expiryDate: it.expiryDate || undefined,
                quantity: it.quantity, purchasePrice: it.purchasePrice, gstPercentage: it.gstPercentage,
              }
        ),
      });
      enqueueSnackbar('Purchase order created', { variant: 'success' });
      setCreateOpen(false);
      resetCreate();
      fetchPurchases();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to create purchase', { variant: 'error' });
    } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!paymentPurchase) return;
    try {
      await api.patch(`/purchases/${paymentPurchase._id}/payment`, { amount: parseFloat(paymentAmount) });
      enqueueSnackbar('Payment recorded', { variant: 'success' });
      setPaymentPurchase(null);
      fetchPurchases();
    } catch {
      enqueueSnackbar('Failed to record payment', { variant: 'error' });
    }
  };

  const columns = [
    { id: 'invoiceNumber', label: 'Invoice #', minWidth: 140 },
    { id: 'supplierName', label: 'Supplier', minWidth: 180 },
    { id: 'purchaseDate', label: 'Date', minWidth: 120, render: (row: Purchase) => new Date(row.purchaseDate).toLocaleDateString('en-IN') },
    { id: 'totalAmount', label: 'Total', align: 'right' as const, render: (row: Purchase) => `₹${row.totalAmount.toFixed(0)}` },
    { id: 'paidAmount', label: 'Paid', align: 'right' as const, render: (row: Purchase) => (
      <Typography variant="body2" color={row.paidAmount > 0 ? 'success.main' : 'text.secondary'}>
        ₹{row.paidAmount.toFixed(0)}
      </Typography>
    )},
    { id: 'balanceAmount', label: 'Pending', align: 'right' as const, render: (row: Purchase) => (
      <Typography variant="body2" fontWeight={700} color={row.balanceAmount > 0 ? 'error.main' : 'success.main'}>
        ₹{row.balanceAmount.toFixed(0)}
      </Typography>
    )},
    { id: 'paymentStatus', label: 'Status', render: (row: Purchase) => (
      <Chip label={row.paymentStatus.toUpperCase()} color={STATUS_COLORS[row.paymentStatus]} size="small" />
    )},
    { id: 'actions', label: '', align: 'right' as const, render: (row: Purchase) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Print Purchase Order"><IconButton size="small" onClick={() => handlePrintPurchase(row._id)}><Print fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="View"><IconButton size="small" onClick={() => setViewPurchase(row)}><Visibility fontSize="small" /></IconButton></Tooltip>
        {row.paymentStatus !== 'paid' && (
          <Tooltip title="Record Payment"><IconButton size="small" color="success" onClick={() => { setPaymentPurchase(row); setPaymentAmount(''); }}><Payment fontSize="small" /></IconButton></Tooltip>
        )}
      </Box>
    )},
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2.5 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => { resetCreate(); setCreateOpen(true); }}>
          New Purchase Order
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={purchases}
        loading={loading} total={total} page={page} rowsPerPage={20}
        onPageChange={setPage}
        keyExtractor={(row) => row._id}
      />

      {/* ── Create Purchase Dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Purchase Order</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(o) => o.name}
                value={selectedSupplier}
                onChange={(_, v) => setSelectedSupplier(v)}
                renderInput={(params) => <TextField {...params} label="Supplier *" fullWidth />}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" mb={1}>Medicine Items</Typography>

          {items.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                mb: 2, p: 1.5, borderRadius: 1, border: '1px solid',
                borderColor: item.isNew ? 'warning.light' : 'divider',
                background: item.isNew ? '#fffbeb' : 'transparent',
              }}
            >
              {item.isNew && (
                <Box sx={{ mb: 1 }}>
                  <Chip label="New medicine — will be added to your inventory" size="small" color="warning" />
                </Box>
              )}
              <Grid container spacing={1.5} alignItems="flex-start">
                <Grid item xs={12} sm={item.isNew ? 12 : 4}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={searchOptions[idx] || []}
                    loading={searchLoading[idx]}
                    groupBy={(opt) => opt.source === 'inventory' ? 'Your Inventory' : 'From Catalog (New)'}
                    getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
                    filterOptions={(x) => x}
                    inputValue={inputValues[idx] || ''}
                    onInputChange={(_e, val, reason) => { if (reason === 'input') handleMedicineSearch(idx, val); }}
                    onChange={(_e, val) => { if (typeof val !== 'string') handleMedicineSelect(idx, val); }}
                    onBlur={() => handleCustomNameCommit(idx)}
                    renderOption={(props, opt) => (
                      <Box component="li" {...props} key={`${opt.source}-${opt._id}`}>
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontWeight={600}>{opt.name}</Typography>
                            {opt.source === 'inventory'
                              ? <Chip label={`Stock: ${opt.currentStock} ${(opt.unitsPerPack || 1) > 1 ? 'units' : (opt.unitOfMeasure || 'Strip').toLowerCase() + 's'}`} size="small" color="success" variant="outlined" sx={{ fontSize: 10 }} />
                              : <Chip label="New" size="small" color="warning" sx={{ fontSize: 10 }} />
                            }
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {opt.genericName}{opt.strength ? ` · ${opt.strength}` : ''}{opt.manufacturer ? ` · ${opt.manufacturer}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Medicine *"
                        size="small"
                        placeholder="Search inventory/catalog or type a brand-new name..."
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {searchLoading[idx] ? <CircularProgress size={14} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* New medicine extra fields — mirrors the standalone Add Medicine form */}
                {item.isNew && (
                  <>
                    <Grid item xs={6} sm={3}>
                      <TextField label="Generic / Salt" value={item.newGenericName} onChange={(e) => updateItem(idx, 'newGenericName', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField select label="Category *" value={item.newCategory} onChange={(e) => updateItem(idx, 'newCategory', e.target.value)} fullWidth size="small">
                        {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField label="Manufacturer" value={item.newManufacturer} onChange={(e) => updateItem(idx, 'newManufacturer', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Autocomplete
                        freeSolo
                        size="small"
                        options={DOSAGE_FORMS}
                        value={item.newDosageForm}
                        onInputChange={(_e, v) => updateItem(idx, 'newDosageForm', v)}
                        renderInput={(params) => <TextField {...params} label="Dosage Form" placeholder="Tablet, Syrup..." fullWidth />}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField label="Strength" placeholder="500mg..." value={item.newStrength} onChange={(e) => updateItem(idx, 'newStrength', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField label="Pack Size" placeholder="10 TAB..." value={item.newPackSize} onChange={(e) => updateItem(idx, 'newPackSize', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField select label="Unit of Measure" value={item.newUnitOfMeasure} onChange={(e) => updateItem(idx, 'newUnitOfMeasure', e.target.value)} fullWidth size="small">
                        {UNIT_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label={`Tablets/Units per ${item.newUnitOfMeasure}`}
                        type="number"
                        value={item.newUnitsPerPack}
                        onChange={(e) => updateItem(idx, 'newUnitsPerPack', e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{ min: 1, step: 1 }}
                        helperText={Number(item.newUnitsPerPack) > 1 ? 'Bills per individual unit' : 'Leave as 1 if sold whole'}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField label="Barcode" value={item.newBarcode} onChange={(e) => updateItem(idx, 'newBarcode', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label={Number(item.newUnitsPerPack) > 1 ? `Min. Stock (in ${item.newUnitOfMeasure}s)` : 'Minimum Stock Level'}
                        type="number"
                        value={item.newMinimumStockLevel}
                        onChange={(e) => updateItem(idx, 'newMinimumStockLevel', e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField label="HSN Code" placeholder="3004" value={item.newHsnCode} onChange={(e) => updateItem(idx, 'newHsnCode', e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField select label="Schedule" value={item.newScheduleClass} onChange={(e) => updateItem(idx, 'newScheduleClass', e.target.value)} fullWidth size="small">
                        {SCHEDULE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s === 'None' ? 'None' : `Schedule ${s}`}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField label="Storage Condition" placeholder="Store below 25°C..." value={item.newStorageCondition} onChange={(e) => updateItem(idx, 'newStorageCondition', e.target.value)} fullWidth size="small" />
                    </Grid>
                  </>
                )}

                {/* Purchase fields row */}
                <Grid container item xs={12} spacing={1.5}>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Batch # (optional)"
                      value={item.batchNumber} onChange={(e) => updateItem(idx, 'batchNumber', e.target.value)} fullWidth size="small"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label={item.isNew ? 'Expiry Date *' : 'Expiry Date (optional)'}
                      type="date" value={item.expiryDate} onChange={(e) => updateItem(idx, 'expiryDate', e.target.value)}
                      fullWidth size="small" InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <TextField label="Qty *" type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} fullWidth size="small" inputProps={{ min: 1 }} />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <TextField
                      label={`Buy Price ₹/${item.isNew ? item.newUnitOfMeasure : item.selectedUnitOfMeasure} *`}
                      type="number" value={item.purchasePrice} onChange={(e) => updateItem(idx, 'purchasePrice', parseFloat(e.target.value) || 0)} fullWidth size="small" inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  {item.isNew && (
                    <Grid item xs={4} sm={2}>
                      <TextField
                        label={`Sell ₹/${item.newUnitOfMeasure} *`} type="number"
                        value={item.sellingPrice}
                        onChange={(e) => updateItem(idx, 'sellingPrice', e.target.value)}
                        fullWidth size="small"
                        inputProps={{ min: 0, step: 0.01 }}
                        helperText="Required for new medicine"
                      />
                    </Grid>
                  )}
                  <Grid item xs={4} sm={2}>
                    <TextField select label="GST%" value={item.gstPercentage} onChange={(e) => updateItem(idx, 'gstPercentage', parseInt(e.target.value))} fullWidth size="small">
                      {[0, 5, 12, 18, 28].map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs="auto">
                    <IconButton color="error" onClick={() => removeItem(idx)} disabled={items.length === 1} size="small" sx={{ mt: 0.5 }}>
                      <Add sx={{ transform: 'rotate(45deg)' }} />
                    </IconButton>
                  </Grid>
                  {/* Buy Price per Unit applies to restocking an existing medicine
                      too (uses its saved units-per-pack), not just new ones —
                      Sell Price per Unit only exists for new medicines since an
                      existing one's MRP isn't re-entered on this screen. */}
                  {(item.isNew ? Number(item.newUnitsPerPack) : item.selectedUnitsPerPack) > 1 && (
                    <Grid item xs={item.isNew ? 6 : 12} sm={3}>
                      <TextField
                        label="Buy Price per Unit (₹)"
                        value={
                          item.purchasePrice
                            ? (item.purchasePrice / (item.isNew ? Number(item.newUnitsPerPack) : item.selectedUnitsPerPack)).toFixed(2)
                            : ''
                        }
                        fullWidth size="small" disabled
                      />
                    </Grid>
                  )}
                  {item.isNew && Number(item.newUnitsPerPack) > 1 && (
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Sell Price per Unit (₹)"
                        value={item.sellingPrice ? (parseFloat(item.sellingPrice) / Number(item.newUnitsPerPack)).toFixed(2) : ''}
                        fullWidth size="small" disabled
                      />
                    </Grid>
                  )}
                  {/* Works for restocking an existing medicine too, not just new
                      ones — uses whichever units-per-pack applies (the new-medicine
                      form field, or the one carried over from the picked medicine). */}
                  {(item.isNew ? Number(item.newUnitsPerPack) : item.selectedUnitsPerPack) > 1 && (
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Total Units Added"
                        value={item.quantity * (item.isNew ? Number(item.newUnitsPerPack) : item.selectedUnitsPerPack)}
                        fullWidth size="small" disabled
                        helperText={`${item.quantity} ${(item.isNew ? item.newUnitOfMeasure : item.selectedUnitOfMeasure).toLowerCase()}s × ${item.isNew ? item.newUnitsPerPack : item.selectedUnitsPerPack}`}
                      />
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </Box>
          ))}

          <Button startIcon={<Add />} onClick={addItem} size="small">Add Item</Button>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Payment will be recorded separately after order is placed.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} color="inherit" variant="outlined">Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={saving}>{saving ? 'Saving...' : 'Create Purchase Order'}</Button>
        </DialogActions>
      </Dialog>

      {/* ── View Purchase Dialog ── */}
      {viewPurchase && (
        <Dialog open={!!viewPurchase} onClose={() => setViewPurchase(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Purchase Order — {viewPurchase.invoiceNumber}</DialogTitle>
          <DialogContent>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}><Typography variant="body2"><strong>Supplier:</strong> {viewPurchase.supplierName}</Typography></Grid>
              <Grid item xs={6}><Typography variant="body2"><strong>Date:</strong> {new Date(viewPurchase.purchaseDate).toLocaleDateString('en-IN')}</Typography></Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Medicine</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewPurchase.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.medicineName}</TableCell>
                    <TableCell align="right">{it.quantity}</TableCell>
                    <TableCell align="right">₹{it.purchasePrice}</TableCell>
                    <TableCell align="right">₹{it.totalAmount.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <Typography variant="body2">Total: <strong>₹{viewPurchase.totalAmount.toFixed(2)}</strong></Typography>
              <Typography variant="body2" color="success.main">Paid: <strong>₹{viewPurchase.paidAmount.toFixed(2)}</strong></Typography>
              <Typography variant="body2" color={viewPurchase.balanceAmount > 0 ? 'error.main' : 'success.main'}>
                Pending: <strong>₹{viewPurchase.balanceAmount.toFixed(2)}</strong>
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip label={viewPurchase.paymentStatus.toUpperCase()} color={STATUS_COLORS[viewPurchase.paymentStatus]} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setViewPurchase(null)} variant="outlined">Close</Button>
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={() => handlePrintPurchase(viewPurchase._id)}
            >
              Print PO
            </Button>
            {viewPurchase.paymentStatus !== 'paid' && (
              <Button
                variant="contained" color="success"
                onClick={() => { setPaymentPurchase(viewPurchase); setPaymentAmount(''); setViewPurchase(null); }}
              >
                Record Payment
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}

      {/* ── Payment Dialog ── */}
      <Dialog open={!!paymentPurchase} onClose={() => setPaymentPurchase(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" mb={0.5}>Invoice: <strong>{paymentPurchase?.invoiceNumber}</strong></Typography>
            <Typography variant="body2" mb={2}>
              Pending Amount: <strong style={{ color: '#d32f2f' }}>₹{paymentPurchase?.balanceAmount?.toFixed(2)}</strong>
            </Typography>
            <TextField
              label="Payment Amount (₹)"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              fullWidth
              autoFocus
              inputProps={{ min: 0, max: paymentPurchase?.balanceAmount, step: 0.01 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPaymentPurchase(null)} color="inherit" variant="outlined">Cancel</Button>
          <Button onClick={handlePayment} variant="contained" color="success" disabled={!paymentAmount}>Record Payment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseList;
