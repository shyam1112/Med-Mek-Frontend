import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Card, CardContent, Grid, TextField, Button, MenuItem,
  Typography, CircularProgress, Divider, Autocomplete, Chip,
  InputAdornment, Paper, Alert,
} from '@mui/material';
import { Save, ArrowBack, Search, AutoFixHigh, LocalPrintshop } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { printShelfLabel } from '../../utils/printLabel';

const CATEGORIES = [
  'Analgesic', 'Antibiotic', 'Antacid', 'Antifungal', 'Antihistamine',
  'Antiviral', 'Cardiovascular', 'Diabetes', 'Dermatology', 'ENT',
  'Eye/Ear', 'Gastrointestinal', 'Hormones', 'Nutritional', 'Orthopedic',
  'Pediatric', 'Psychiatric', 'Respiratory', 'Surgical', 'Vitamins', 'Other',
];

const GST_OPTIONS = [0, 5, 12, 18, 28];

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment',
  'Cream', 'Gel', 'Lotion', 'Drops', 'Inhaler', 'Spray', 'Powder',
  'Sachet', 'Suppository', 'Patch',
];

const UNIT_OPTIONS = ['Strip', 'Bottle', 'Box', 'Tube', 'Vial', 'Piece'];

const SCHEDULE_CLASSES: Record<string, string> = {
  None: 'No schedule — sold over the counter',
  H: 'Schedule H — prescription required',
  H1: 'Schedule H1 — prescription required, register entry mandatory',
  X: 'Schedule X — narcotic/psychotropic, special record-keeping',
};

const INITIAL_FORM = {
  name: '', genericName: '', category: '', manufacturer: '',
  batchNumber: '', expiryDate: '', purchasePrice: '', sellingPrice: '',
  gstPercentage: '12', currentStock: '0', minimumStockLevel: '10', barcode: '',
  dosageForm: '', strength: '', packSize: '',
  hsnCode: '', scheduleClass: 'None', unitOfMeasure: 'Strip', storageCondition: '',
  location: '',
};

const REQUIRED_FIELDS = ['name', 'category', 'batchNumber', 'expiryDate', 'purchasePrice', 'sellingPrice'] as const;
type RequiredField = typeof REQUIRED_FIELDS[number];

interface CatalogItem {
  _id: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  gstPercentage: number;
  suggestedMRP: number;
}

const MedicineForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromCatalog, setFromCatalog] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, boolean>>>({});
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/medicines/${id}`)
      .then(({ data }) => {
        const m = data.data;
        setForm({
          name: m.name, genericName: m.genericName || '', category: m.category,
          manufacturer: m.manufacturer || '', batchNumber: m.batchNumber,
          expiryDate: m.expiryDate ? m.expiryDate.split('T')[0] : '',
          purchasePrice: String(m.purchasePrice), sellingPrice: String(m.sellingPrice),
          gstPercentage: String(m.gstPercentage), currentStock: String(m.currentStock),
          minimumStockLevel: String(m.minimumStockLevel), barcode: m.barcode || '',
          dosageForm: m.dosageForm || '', strength: m.strength || '', packSize: m.packSize || '',
          hsnCode: m.hsnCode || '', scheduleClass: m.scheduleClass || 'None',
          unitOfMeasure: m.unitOfMeasure || 'Strip', storageCondition: m.storageCondition || '',
          location: m.location || '',
        });
      })
      .catch(() => enqueueSnackbar('Failed to load medicine', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id, isEdit, enqueueSnackbar]);

  // Debounced catalog search
  const searchCatalog = useCallback((q: string) => {
    clearTimeout(catalogTimer.current);
    if (q.length < 1) { setCatalogOptions([]); return; }
    setCatalogLoading(true);
    catalogTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/catalog/search?q=${encodeURIComponent(q)}&limit=10`);
        setCatalogOptions(data.data || []);
      } catch {
        setCatalogOptions([]);
      } finally {
        setCatalogLoading(false);
      }
    }, 280);
  }, []);

  const handleCatalogSelect = (item: CatalogItem | null) => {
    if (!item) return;
    setForm((prev) => ({
      ...prev,
      name: item.name,
      genericName: item.genericName,
      category: item.category,
      manufacturer: item.manufacturer,
      gstPercentage: String(item.gstPercentage),
      sellingPrice: item.suggestedMRP > 0 ? String(item.suggestedMRP) : prev.sellingPrice,
      dosageForm: item.dosageForm || prev.dosageForm,
      strength: item.strength || prev.strength,
    }));
    setFromCatalog(true);
    setCatalogQuery('');
    setCatalogOptions([]);
    enqueueSnackbar(`Auto-filled from catalog: ${item.name}`, { variant: 'success', autoHideDuration: 2500 });
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (value && (REQUIRED_FIELDS as readonly string[]).includes(field)) {
      setErrors((prev) => ({ ...prev, [field]: false }));
    }
    if (['name', 'genericName', 'category', 'manufacturer', 'gstPercentage'].includes(field)) {
      setFromCatalog(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Partial<Record<RequiredField, boolean>> = {
      name: !form.name.trim(),
      category: !form.category,
      batchNumber: !form.batchNumber.trim(),
      expiryDate: !form.expiryDate,
      purchasePrice: !form.purchasePrice,
      sellingPrice: !form.sellingPrice,
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) {
      enqueueSnackbar('Please fill in the fields highlighted in red below', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        purchasePrice: parseFloat(form.purchasePrice),
        sellingPrice: parseFloat(form.sellingPrice),
        gstPercentage: parseInt(form.gstPercentage, 10),
        currentStock: parseInt(form.currentStock, 10),
        minimumStockLevel: parseInt(form.minimumStockLevel, 10),
      };

      if (isEdit) {
        await api.put(`/medicines/${id}`, payload);
        enqueueSnackbar('Medicine updated successfully', { variant: 'success' });
      } else {
        await api.post('/medicines', payload);
        enqueueSnackbar('Medicine created successfully', { variant: 'success' });
      }
      navigate('/medicines');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      enqueueSnackbar(msg || 'Failed to save medicine', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/medicines')} variant="outlined">
          Back
        </Button>
        {isEdit && (
          <Button
            startIcon={<LocalPrintshop />}
            variant="outlined"
            color="secondary"
            onClick={() => printShelfLabel(
              { name: form.name, batchNumber: form.batchNumber, barcode: form.barcode, location: form.location },
              user?.storeName
            )}
          >
            Print Shelf Label
          </Button>
        )}
      </Box>

      {/* ── Catalog search panel (new medicine only) ── */}
      {!isEdit && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5, mb: 3, border: '2px solid',
            borderColor: fromCatalog ? 'success.main' : 'primary.light',
            borderRadius: 2,
            background: fromCatalog
              ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
              : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <AutoFixHigh sx={{ color: fromCatalog ? 'success.main' : 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600} color={fromCatalog ? 'success.main' : 'primary.main'}>
              Smart Medicine Search
            </Typography>
            {fromCatalog && (
              <Chip label="Auto-filled from catalog" size="small" color="success" sx={{ ml: 1 }} />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Search from 150+ pre-loaded Indian medicines. Selecting one will auto-fill the medicine details below.
          </Typography>
          <Autocomplete
            freeSolo
            options={catalogOptions}
            loading={catalogLoading}
            inputValue={catalogQuery}
            getOptionLabel={(opt) =>
              typeof opt === 'string' ? opt : `${opt.name} — ${opt.genericName} ${opt.strength} (${opt.dosageForm})`
            }
            filterOptions={(x) => x}
            onInputChange={(_e, val) => {
              setCatalogQuery(val);
              searchCatalog(val);
            }}
            onChange={(_e, val) => {
              if (val && typeof val !== 'string') handleCatalogSelect(val as CatalogItem);
            }}
            renderOption={(props, opt) => {
              const item = opt as CatalogItem;
              return (
                <Box component="li" {...props} key={item._id}>
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip label={item.dosageForm} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        <Chip label={`GST ${item.gstPercentage}%`} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {item.genericName} · {item.strength} · {item.manufacturer}
                    </Typography>
                    {item.suggestedMRP > 0 && (
                      <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                        MRP ₹{item.suggestedMRP}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search by medicine name, salt/generic name, or manufacturer..."
                size="medium"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {catalogLoading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{ backgroundColor: 'white', borderRadius: 1 }}
              />
            )}
          />
          {fromCatalog && (
            <Alert severity="success" variant="outlined" sx={{ mt: 1.5, py: 0.5 }}>
              Medicine details auto-filled. Please complete batch number, expiry date, purchase price, and stock quantity below.
            </Alert>
          )}
        </Paper>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3}>
            {isEdit ? 'Edit Medicine' : 'Add New Medicine'}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" mb={2}>
            Basic Information
            {fromCatalog && (
              <Chip label="Auto-filled" size="small" color="success" sx={{ ml: 1, fontSize: 10, height: 20 }} />
            )}
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Medicine Name *"
                value={form.name}
                onChange={handleChange('name')}
                fullWidth
                error={!!errors.name}
                helperText={errors.name ? 'Medicine name is required' : ''}
                InputProps={fromCatalog ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Composition / Generic Name (Salt)"
                value={form.genericName}
                onChange={handleChange('genericName')}
                fullWidth
                InputProps={fromCatalog ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Category *"
                value={form.category}
                onChange={handleChange('category')}
                fullWidth
                error={!!errors.category}
                helperText={errors.category ? 'Category is required' : ''}
              >
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Manufacturer"
                value={form.manufacturer}
                onChange={handleChange('manufacturer')}
                fullWidth
                InputProps={fromCatalog ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                freeSolo
                options={DOSAGE_FORMS}
                value={form.dosageForm}
                onInputChange={(_e, v) => { setForm((prev) => ({ ...prev, dosageForm: v })); setFromCatalog(false); }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dosage Form"
                    placeholder="Tablet, Capsule, Syrup..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: fromCatalog && form.dosageForm
                        ? <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>
                        : params.InputProps.endAdornment,
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Strength"
                value={form.strength}
                onChange={handleChange('strength')}
                fullWidth
                placeholder="500mg, 10mg/5ml..."
                InputProps={fromCatalog && form.strength ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Pack Size"
                value={form.packSize}
                onChange={handleChange('packSize')}
                fullWidth
                placeholder="10 TAB, 1 STRIP, 100 ML..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Unit of Measure"
                value={form.unitOfMeasure}
                onChange={handleChange('unitOfMeasure')}
                fullWidth
              >
                {UNIT_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="HSN Code"
                value={form.hsnCode}
                onChange={handleChange('hsnCode')}
                fullWidth
                placeholder="3004"
                helperText="Needed for GST filing"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Schedule Classification"
                value={form.scheduleClass}
                onChange={handleChange('scheduleClass')}
                fullWidth
                helperText={SCHEDULE_CLASSES[form.scheduleClass]}
              >
                {Object.keys(SCHEDULE_CLASSES).map((s) => <MenuItem key={s} value={s}>{s === 'None' ? 'None' : `Schedule ${s}`}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Storage Condition"
                value={form.storageCondition}
                onChange={handleChange('storageCondition')}
                fullWidth
                placeholder="Store below 25°C, protect from light..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Rack / Shelf / Bin Location"
                value={form.location}
                onChange={handleChange('location')}
                fullWidth
                placeholder="Rack 3 - Shelf B, Fridge 1..."
                helperText="Where this medicine physically sits in the store"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" color="text.secondary" mb={2}>Batch &amp; Expiry</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Batch Number *"
                value={form.batchNumber}
                onChange={handleChange('batchNumber')}
                fullWidth
                error={!!errors.batchNumber}
                helperText={errors.batchNumber ? 'Batch number is required' : ''}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Barcode" value={form.barcode} onChange={handleChange('barcode')} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Expiry Date *"
                type="date"
                value={form.expiryDate}
                onChange={handleChange('expiryDate')}
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={!!errors.expiryDate}
                helperText={errors.expiryDate ? 'Expiry date is required' : ''}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" color="text.secondary" mb={2}>
            Pricing &amp; GST
            {fromCatalog && (
              <Chip label="GST % auto-filled" size="small" color="success" sx={{ ml: 1, fontSize: 10, height: 20 }} />
            )}
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Purchase Price (₹) *"
                type="number"
                value={form.purchasePrice}
                onChange={handleChange('purchasePrice')}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                error={!!errors.purchasePrice}
                helperText={errors.purchasePrice ? 'Purchase price is required' : ''}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Selling Price / MRP (₹) *"
                type="number"
                value={form.sellingPrice}
                onChange={handleChange('sellingPrice')}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                error={!!errors.sellingPrice}
                helperText={
                  errors.sellingPrice
                    ? 'Selling price is required'
                    : fromCatalog && form.sellingPrice ? 'Pre-filled from catalog MRP — adjust if needed' : ''
                }
                InputProps={fromCatalog && form.sellingPrice ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="GST %"
                value={form.gstPercentage}
                onChange={handleChange('gstPercentage')}
                fullWidth
                InputProps={fromCatalog ? {
                  endAdornment: <InputAdornment position="end"><AutoFixHigh sx={{ fontSize: 16, color: 'success.main' }} /></InputAdornment>,
                } : undefined}
              >
                {GST_OPTIONS.map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" color="text.secondary" mb={2}>Stock Settings</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Current Stock"
                type="number"
                value={form.currentStock}
                onChange={handleChange('currentStock')}
                fullWidth
                inputProps={{ min: 0 }}
                helperText={isEdit ? 'Use Inventory module to adjust stock' : ''}
                disabled={isEdit}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Minimum Stock Level"
                type="number"
                value={form.minimumStockLevel}
                onChange={handleChange('minimumStockLevel')}
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Alert will trigger below this level"
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate('/medicines')} variant="outlined" color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              disabled={saving}
            >
              {isEdit ? 'Save Changes' : 'Add Medicine'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MedicineForm;
