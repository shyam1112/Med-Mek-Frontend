import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Divider, CircularProgress,
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel, Checkbox, Accordion, AccordionSummary, AccordionDetails,
  Chip, Alert,
} from '@mui/material';
import {
  Download, Refresh, TableChartOutlined, GridOnOutlined, PictureAsPdfOutlined, ExpandMore,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

// Local calendar date as YYYY-MM-DD — NOT toISOString(), which is UTC and can be
// a day behind local "today" for IST users (any time before 5:30 AM IST).
const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateLong = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Generic response → sections derivation ───────────────────────────────────
// Nothing below knows about "daily sales" or "profit" — it just looks at whatever
// object the API returned. A `summary` object becomes Metric/Value rows; every
// other array-of-objects key becomes its own section (table on screen, sheet in
// Excel, block in CSV). Add a field on the backend and it appears here with zero
// frontend changes — the field's own name (humanized) becomes its column header.

interface ReportSection {
  key: string;
  label: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ReportModel {
  title: string;
  metaLines: string[];
  sections: ReportSection[];
  primaryKey: string | null; // first non-summary section, in backend-defined order — prints on the PDF
}

const ACRONYMS: Record<string, string> = {
  gst: 'GST', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', mrp: 'MRP', id: 'ID', upi: 'UPI', dl: 'DL',
  uqc: 'UQC', hsn: 'HSN',
};

// camelCase / snake_case field name -> human label, e.g. "gstPercentage" -> "GST Percentage"
const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => ACRONYMS[w] || w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const PERCENT_WORDS = ['margin', 'percentage', 'percent'];
const MONEY_WORDS = ['amount', 'revenue', 'cost', 'profit', 'value', 'price', 'paid', 'balance', 'loss', 'tax', 'discount'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const wordsOf = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_]+/).filter(Boolean);

// Formats a raw API value for display, using only the field's own name as a hint —
// no per-report knowledge. Dates are detected by content (ISO 8601), not by name.
// Money takes priority whenever a money word is present (e.g. "stockValue" also
// contains the non-money word "stock", but it's still a currency amount).
const formatValue = (key: string, value: unknown): string | number => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  if (typeof value === 'number') {
    const words = wordsOf(key);
    if (words.some((w) => PERCENT_WORDS.includes(w))) return `${Math.round(value * 10) / 10}%`;
    if (words.some((w) => MONEY_WORDS.includes(w))) return value.toFixed(2);
    return value;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildSectionsFromResponse = (d: Record<string, unknown>): ReportSection[] => {
  const sections: ReportSection[] = [];

  const summary = d.summary as Record<string, unknown> | undefined;
  if (summary && typeof summary === 'object') {
    sections.push({
      key: 'summary',
      label: 'Summary',
      columns: ['Metric', 'Value'],
      rows: Object.entries(summary).map(([k, v]) => [humanizeKey(k), formatValue(k, v)]),
    });
  }

  Object.entries(d).forEach(([sectionKey, value]) => {
    if (sectionKey === 'summary' || !Array.isArray(value)) return;
    const rows = value as Array<Record<string, unknown>>;
    // Union of keys across all rows (in first-seen order) so one row missing an
    // occasional field doesn't silently drop a column for everyone else.
    const columnKeys: string[] = [];
    rows.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => { if (!columnKeys.includes(k)) columnKeys.push(k); });
      }
    });
    sections.push({
      key: sectionKey,
      label: humanizeKey(sectionKey),
      columns: columnKeys.map(humanizeKey),
      rows: rows.map((row) => columnKeys.map((k) => formatValue(k, row[k]))),
    });
  });

  return sections;
};

const csvEscape = (value: string | number): string => {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const buildCsv = (model: ReportModel, sections: ReportSection[]): string => {
  const lines: string[] = [csvEscape(model.title), ...model.metaLines.map(csvEscape)];
  sections.forEach((section) => {
    lines.push('', csvEscape(section.label));
    lines.push(section.columns.map(csvEscape).join(','));
    if (section.rows.length === 0) {
      lines.push('No records found.');
    } else {
      section.rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
    }
  });
  return lines.join('\r\n');
};

const downloadCsv = (model: ReportModel, sections: ReportSection[], filenameSlug: string) => {
  // BOM so Excel renders ₹ / non-ASCII names correctly instead of mojibake.
  const blob = new Blob(['﻿' + buildCsv(model, sections)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `medmek-${filenameSlug}-${toLocalDateString(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadExcel = (model: ReportModel, sections: ReportSection[], filenameSlug: string) => {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  sections.forEach((section) => {
    const aoa: Array<Array<string | number>> = [];
    if (section.key === 'summary') {
      aoa.push([model.title]);
      model.metaLines.forEach((m) => aoa.push([m]));
      aoa.push([]);
    }
    aoa.push(section.columns);
    if (section.rows.length === 0) aoa.push(['No records found.']);
    else aoa.push(...section.rows);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Excel sheet names: max 31 chars, no [ ] : * ? / \, and must be unique.
    let name = section.label.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || section.key;
    let n = 2;
    while (usedNames.has(name)) { name = `${name.slice(0, 28)} ${n++}`; }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `medmek-${filenameSlug}-${toLocalDateString(new Date())}.xlsx`);
};

const printReport = (
  model: ReportModel, summarySection: ReportSection, primarySection: ReportSection | null,
  storeName: string, storeAddress: string
) => {
  const win = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes');
  if (!win) return;

  const statsHtml = summarySection.rows.map(([label, value]) => `
    <div class="stat">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `).join('');

  const tableHtml = primarySection ? `
    <div class="section-title">${primarySection.label}</div>
    <table>
      <thead><tr>${primarySection.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>
        ${primarySection.rows.length > 0
          ? primarySection.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${primarySection.columns.length}" class="empty">No records found for this report.</td></tr>`}
      </tbody>
    </table>
  ` : '';

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${model.title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 16px; max-width: 800px; margin: auto; }
    .header { text-align:center; }
    .store-name { font-size:20px; font-weight:700; letter-spacing:0.5px; }
    .store-sub { font-size:11px; color:#444; margin-top:2px; }
    .report-title { font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-top:10px; }
    .meta { font-size:11.5px; color:#333; margin-top:4px; }
    .solid { border-top:2px solid #000; margin:10px 0; }
    .stats { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
    .stat { flex:1; min-width:140px; border:1px solid #ccc; border-radius:4px; padding:8px 10px; text-align:center; }
    .stat-label { font-size:10px; text-transform:uppercase; letter-spacing:0.4px; color:#555; }
    .stat-value { font-size:15px; font-weight:700; margin-top:2px; }
    .section-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; margin-top:16px; color:#333; }
    table { width:100%; border-collapse:collapse; margin-top:6px; }
    th { font-size:10.5px; text-align:left; padding:6px; border-bottom:1.5px solid #000; border-top:1.5px solid #000; background:#f5f5f5; }
    td { font-size:11px; padding:6px; border-bottom:1px solid #eee; }
    .empty { text-align:center; color:#777; padding:16px; }
    .footer { text-align:center; margin-top:20px; font-size:10px; color:#777; }
    @media print {
      @page { size: A4; margin: 12mm; }
      body { max-width:100%; padding:0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${storeName || 'MedMek Pharmacy'}</div>
    ${storeAddress ? `<div class="store-sub">${storeAddress}</div>` : ''}
    <div class="report-title">${model.title}</div>
    <div class="meta">${model.metaLines.join(' &nbsp;·&nbsp; ')}</div>
  </div>
  <div class="solid"></div>
  <div class="stats">${statsHtml}</div>
  ${tableHtml}
  <div class="footer">Generated on ${generatedAt} — MedMek Pharmacy Management System</div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
  win.document.close();
};

const TITLES: Record<string, string> = {
  daily: 'Daily Sales Report',
  monthly: 'Monthly Sales Report',
  profit: 'Profit Report',
  purchase: 'Purchase Report',
  'doctor-wise': 'Doctor-wise Sales Report',
  'hsn-summary': 'GST HSN Summary',
  inventory: 'Inventory Report',
  'expiry-loss': 'Expiry Loss Report',
};

const Reports: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(toLocalDateString(new Date()).slice(0, 7) + '-01');
  const [endDate, setEndDate] = useState(toLocalDateString(new Date()));
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '';
      let params: Record<string, string> = {};
      switch (type) {
        case 'daily': url = '/reports/daily-sales'; params = { date }; break;
        case 'monthly':
          const [y, m] = date.split('-');
          url = '/reports/monthly-sales';
          params = { year: y, month: m };
          break;
        case 'profit': url = '/reports/profit'; params = { startDate, endDate }; break;
        case 'purchase': url = '/reports/purchase'; params = { startDate, endDate }; break;
        case 'doctor-wise': url = '/reports/doctor-wise'; params = { startDate, endDate }; break;
        case 'hsn-summary': url = '/reports/hsn-summary'; params = { startDate, endDate }; break;
        case 'inventory': url = '/reports/inventory'; break;
        case 'expiry-loss': url = '/reports/expiry-loss'; break;
        default: return;
      }
      const { data: res } = await api.get(url, { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  // Deliberately re-fetches only when the report type changes (i.e. navigating
  // to a different report) — not on every date-field edit. Applying a new date
  // range is an explicit action via the "Generate" button below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReport(); }, [type]);

  const renderFilters = () => {
    if (type === 'daily') return (
      <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
        size="small" InputLabelProps={{ shrink: true }} />
    );
    if (type === 'monthly') return (
      <TextField label="Month" type="month" value={date.slice(0, 7)} onChange={(e) => setDate(e.target.value + '-01')}
        size="small" InputLabelProps={{ shrink: true }} />
    );
    if (['profit', 'purchase', 'doctor-wise', 'hsn-summary'].includes(type || '')) return (
      <>
        <TextField label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          size="small" InputLabelProps={{ shrink: true }} />
      </>
    );
    return null;
  };

  // Meta line (Date: X / Period: X–Y / Month: X / As of: X) reflects the current
  // filter selection, not the API response — this is the one thing that's still
  // type-specific, since it's about the UI's date pickers, not report data.
  const buildMetaLines = (): string[] => {
    if (type === 'daily') return [`Date: ${formatDateLong(date)}`];
    if (type === 'monthly') {
      const [y, m] = date.split('-');
      const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return [`Month: ${monthLabel}`];
    }
    if (type === 'profit' || type === 'purchase' || type === 'doctor-wise' || type === 'hsn-summary') return [`Period: ${formatDateLong(startDate)} – ${formatDateLong(endDate)}`];
    if (type === 'inventory' || type === 'expiry-loss') return [`As of: ${formatDateLong(toLocalDateString(new Date()))}`];
    return [];
  };

  // The single source of truth for every "detail" table — on-screen accordions,
  // CSV, and Excel all read from this. It derives entirely from the API response
  // shape (see buildSectionsFromResponse above), so a new backend field shows up
  // here automatically with no changes needed in this file.
  const buildReportModel = (): ReportModel | null => {
    if (!data) return null;
    const sections = buildSectionsFromResponse(data as Record<string, unknown>);
    if (sections.length === 0) return null;
    const primaryKey = sections.length > 1 ? sections[1].key : null;
    return { title: TITLES[type || ''] || 'Report', metaLines: buildMetaLines(), sections, primaryKey };
  };

  const openExportDialog = () => {
    const model = buildReportModel();
    if (!model) return;
    const initial: Record<string, boolean> = {};
    model.sections.forEach((s) => { initial[s.key] = true; });
    setSelectedKeys(initial);
    setExportDialogOpen(true);
    setExportAnchor(null);
  };

  const handlePrintExport = () => {
    const model = buildReportModel();
    if (!model) return;
    const summarySection = model.sections.find((s) => s.key === 'summary')!;
    const primarySection = model.sections.find((s) => s.key === model.primaryKey) || null;
    printReport(model, summarySection, primarySection, user?.storeName || '', user?.storeAddress || '');
    setExportAnchor(null);
  };

  const selectedSections = (model: ReportModel) =>
    model.sections.filter((s) => s.key === 'summary' || selectedKeys[s.key]);

  const handleConfirmDownload = (format: 'csv' | 'xlsx') => {
    const model = buildReportModel();
    if (!model) return;
    const sections = selectedSections(model);
    if (format === 'csv') downloadCsv(model, sections, type || 'report');
    else downloadExcel(model, sections, type || 'report');
    setExportDialogOpen(false);
  };

  const renderContent = () => {
    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
    if (!data) return null;

    const d = data as Record<string, unknown>;

    if (type === 'daily') {
      const summary = d.summary as Record<string, number>;
      const bills = d.bills as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue || 0) },
              { label: 'Total Bills', value: summary.totalBills || 0 },
              { label: 'GST Collected', value: formatCurrency(summary.gstAmount || 0) },
              { label: 'Discounts', value: formatCurrency(summary.totalDiscount || 0) },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bill No.</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bills?.map((bill, i) => (
                <TableRow key={i}>
                  <TableCell>{bill.billNumber as string}</TableCell>
                  <TableCell>{bill.customerName as string}</TableCell>
                  <TableCell align="right">{formatCurrency(bill.totalAmount as number)}</TableCell>
                  <TableCell>{(bill.paymentMode as string)?.toUpperCase()}</TableCell>
                  <TableCell>{new Date(bill.saleDate as string).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    if (type === 'monthly') {
      const summary = d.summary as Record<string, number>;
      const daily = d.dailyBreakdown as Array<{ day: number; revenue: number; bills: number }>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Monthly Revenue', value: formatCurrency(summary?.totalRevenue || 0) },
              { label: 'Total Bills', value: summary?.totalBills || 0 },
            ].map(({ label, value }) => (
              <Grid item xs={6} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daily?.map((d) => ({ day: d.day, revenue: d.revenue }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(v as number), 'Revenue']} />
              <Bar dataKey="revenue" fill="#1976d2" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      );
    }

    if (type === 'inventory') {
      const summary = d.summary as Record<string, number>;
      const medicines = d.medicines as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Medicines', value: summary?.totalMedicines || 0 },
              { label: 'Stock Value (Cost)', value: formatCurrency(summary?.totalStockValue || 0) },
              { label: 'Stock Value (MRP)', value: formatCurrency(summary?.totalSellingValue || 0) },
              { label: 'Low Stock', value: summary?.lowStockCount || 0 },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Purchase Price</TableCell>
                <TableCell align="right">MRP</TableCell>
                <TableCell align="right">Stock Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicines?.map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{m.name as string}</TableCell>
                  <TableCell>{m.category as string}</TableCell>
                  <TableCell align="right">{m.currentStock as number}</TableCell>
                  <TableCell align="right">₹{(m.purchasePrice as number).toFixed(2)}</TableCell>
                  <TableCell align="right">₹{(m.sellingPrice as number).toFixed(2)}</TableCell>
                  <TableCell align="right">₹{(m.stockValue as number).toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    if (type === 'profit') {
      const summary = (d.summary || {}) as Record<string, number>;
      const totalRevenue = summary.totalRevenue || 0;
      const totalCost = summary.totalCost || 0;
      const grossProfit = summary.grossProfit || 0;
      const profitMargin = summary.profitMargin || 0;
      return (
        <Grid container spacing={2}>
          {[
            { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
            { label: 'Total Cost', value: formatCurrency(totalCost) },
            { label: 'Gross Profit', value: formatCurrency(grossProfit) },
            { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%` },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h6" fontWeight={700} color={label === 'Gross Profit' ? (grossProfit >= 0 ? 'success.main' : 'error.main') : undefined}>
                  {value}
                </Typography>
              </Box>
            </Grid>
          ))}
          {totalRevenue === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No sales in the selected date range.
              </Typography>
            </Grid>
          )}
        </Grid>
      );
    }

    if (type === 'purchase') {
      const summary = d.summary as Record<string, number>;
      const purchaseOrders = d.purchaseOrders as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Purchases', value: summary?.totalPurchaseOrders || 0 },
              { label: 'Total Amount', value: formatCurrency(summary?.totalAmount || 0) },
              { label: 'Total Paid', value: formatCurrency(summary?.totalPaid || 0) },
              { label: 'Balance Due', value: formatCurrency(summary?.totalBalance || 0) },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrders?.map((p, i) => (
                <TableRow key={i}>
                  <TableCell>{p.invoiceNumber as string}</TableCell>
                  <TableCell>{p.supplierName as string}</TableCell>
                  <TableCell align="right">{formatCurrency(p.totalAmount as number)}</TableCell>
                  <TableCell align="right">{formatCurrency(p.paidAmount as number)}</TableCell>
                  <TableCell align="right">{formatCurrency(p.balanceAmount as number)}</TableCell>
                </TableRow>
              ))}
              {(!purchaseOrders || purchaseOrders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                    No purchases in the selected date range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      );
    }

    if (type === 'doctor-wise') {
      const summary = d.summary as Record<string, number>;
      const byDoctor = d.byDoctor as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Doctors Referring', value: summary?.totalDoctors || 0 },
              { label: 'Referred Bills', value: summary?.totalReferredBills || 0 },
              { label: 'Referred Revenue', value: formatCurrency(summary?.totalReferredRevenue || 0) },
            ].map(({ label, value }) => (
              <Grid item xs={12} sm={4} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Doctor</TableCell>
                <TableCell align="right">Bills Referred</TableCell>
                <TableCell align="right">Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byDoctor?.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.doctorName as string}</TableCell>
                  <TableCell align="right">{row.totalBills as number}</TableCell>
                  <TableCell align="right">{formatCurrency(row.totalRevenue as number)}</TableCell>
                </TableRow>
              ))}
              {(!byDoctor || byDoctor.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                    No doctor-referred sales in the selected date range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      );
    }

    if (type === 'hsn-summary') {
      const summary = d.summary as Record<string, number>;
      const hsnSummary = d.hsnSummary as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'HSN Codes', value: summary?.totalHsnCodes || 0 },
              { label: 'Taxable Value', value: formatCurrency(summary?.totalTaxableValue || 0) },
              { label: 'Total Tax (CGST+SGST)', value: formatCurrency(summary?.totalTax || 0) },
              { label: 'Total Invoice Value', value: formatCurrency(summary?.totalInvoiceValue || 0) },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          {hsnSummary?.some((r) => r.hsnCode === 'Not Set') && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Some medicines don't have an HSN code set yet — their sales are grouped under
              "Not Set" below. Add HSN codes on those medicines for a filing-ready return.
            </Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HSN Code</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>UQC</TableCell>
                <TableCell align="right">GST Rate</TableCell>
                <TableCell align="right">Total Qty</TableCell>
                <TableCell align="right">Taxable Value</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">Total Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hsnSummary?.map((row, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: row.hsnCode === 'Not Set' ? 400 : 600 }}>
                    {row.hsnCode === 'Not Set'
                      ? <Typography variant="body2" color="warning.main">Not Set</Typography>
                      : row.hsnCode as string}
                  </TableCell>
                  <TableCell>{row.description as string}</TableCell>
                  <TableCell>{row.uqc as string}</TableCell>
                  <TableCell align="right">{row.gstRate as string}</TableCell>
                  <TableCell align="right">{row.totalQuantity as number}</TableCell>
                  <TableCell align="right">{formatCurrency(row.taxableValue as number)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.cgstAmount as number)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.sgstAmount as number)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.totalValue as number)}</TableCell>
                </TableRow>
              ))}
              {(!hsnSummary || hsnSummary.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                    No sales in the selected date range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      );
    }

    if (type === 'expiry-loss') {
      const summary = (d.summary || {}) as Record<string, number>;
      const expiredMedicines = d.expiredMedicines as Array<Record<string, unknown>>;
      return (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Expired Medicines</Typography>
                <Typography variant="h6" fontWeight={700}>{summary.expiredMedicineCount || 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Total Loss (Cost Value)</Typography>
                <Typography variant="h6" fontWeight={700} color="error.main">{formatCurrency(summary.totalLoss || 0)}</Typography>
              </Box>
            </Grid>
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Medicine</TableCell>
                <TableCell>Batch</TableCell>
                <TableCell>Expired On</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Loss</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expiredMedicines?.map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{m.name as string}</TableCell>
                  <TableCell>{(m.batchNumber as string) || '—'}</TableCell>
                  <TableCell>{m.expiryDate ? new Date(m.expiryDate as string).toLocaleDateString('en-IN') : '—'}</TableCell>
                  <TableCell align="right">{m.currentStock as number}</TableCell>
                  <TableCell align="right">{formatCurrency(m.loss as number)}</TableCell>
                </TableRow>
              ))}
              {(!expiredMedicines || expiredMedicines.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                    No expired medicines in stock.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      );
    }

    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>Report data loaded. {JSON.stringify(Object.keys(d))}</Typography>
      </Box>
    );
  };

  // Extra breakdown sections not already shown by renderContent() above — surfaced as
  // collapsed accordions so the additional detail is visible on screen too, not just
  // buried inside the export.
  const renderDetailAccordions = () => {
    const model = buildReportModel();
    if (!model) return null;
    const hiddenKeys = new Set(['summary', model.primaryKey]);
    const extraSections = model.sections.filter((s) => !hiddenKeys.has(s.key) && s.rows.length > 0);
    if (extraSections.length === 0) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5}>
          More details
        </Typography>
        {extraSections.map((section) => (
          <Accordion key={section.key} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', mb: 1, borderRadius: 2, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{section.label}</Typography>
              <Chip label={`${section.rows.length} row${section.rows.length !== 1 ? 's' : ''}`} size="small" sx={{ mr: 1 }} />
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {section.columns.map((c) => <TableCell key={c}>{c}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {section.rows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  const dialogModel = exportDialogOpen ? buildReportModel() : null;

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
              {TITLES[type || ''] || 'Report'}
            </Typography>
            {renderFilters()}
            <Button variant="contained" startIcon={<Refresh />} onClick={fetchReport} disabled={loading}>
              Generate
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              disabled={!data || loading}
            >
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
              <MenuItem onClick={handlePrintExport}>
                <ListItemIcon><PictureAsPdfOutlined fontSize="small" /></ListItemIcon>
                <ListItemText>Print / Save as PDF</ListItemText>
              </MenuItem>
              <MenuItem onClick={openExportDialog}>
                <ListItemIcon><TableChartOutlined fontSize="small" /></ListItemIcon>
                <ListItemText>Export data (CSV / Excel)…</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
          <Divider sx={{ mb: 3 }} />
          {renderContent()}
          {renderDetailAccordions()}
        </CardContent>
      </Card>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Export Report Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Choose which details to include. Summary is always included.
          </Typography>
          {dialogModel?.sections.filter((s) => s.key !== 'summary').map((section) => (
            <FormControlLabel
              key={section.key}
              sx={{ display: 'flex', width: '100%', m: 0, '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 } }}
              control={
                <Checkbox
                  checked={!!selectedKeys[section.key]}
                  onChange={(e) => setSelectedKeys((prev) => ({ ...prev, [section.key]: e.target.checked }))}
                />
              }
              label={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                  <span>{section.label}</span>
                  <Typography variant="caption" color="text.secondary">
                    {section.rows.length} row{section.rows.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              }
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setExportDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={() => handleConfirmDownload('csv')} startIcon={<TableChartOutlined />} variant="outlined">
            CSV
          </Button>
          <Button onClick={() => handleConfirmDownload('xlsx')} startIcon={<GridOnOutlined />} variant="contained">
            Excel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;
