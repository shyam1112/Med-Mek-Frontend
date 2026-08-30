import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Chip,
  Tab, Tabs,
} from '@mui/material';
import { Warning, ErrorOutline } from '@mui/icons-material';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import api from '../../api';
import { useSnackbar } from 'notistack';

interface ExpiryMedicine {
  _id: string;
  name: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  currentStock: number;
  purchasePrice: number;
  daysToExpiry: number;
  expiryStatus: 'expired' | 'critical' | 'warning' | 'watch';
}

interface Summary {
  expired: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
}

const STATUS_CONFIG = {
  expired: { label: 'Expired', color: 'error' as const },
  critical: { label: 'Critical (<30d)', color: 'error' as const },
  warning: { label: 'Warning (30-60d)', color: 'warning' as const },
  watch: { label: 'Watch (60-90d)', color: 'info' as const },
};

const DAYS_BY_TAB = [0, 30, 60, 90];

const ExpiryAlerts: React.FC = () => {
  const [medicines, setMedicines] = useState<ExpiryMedicine[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    api.get('/expiry/summary')
      .then(({ data }) => setSummary(data.data))
      .catch(() => enqueueSnackbar('Failed to load expiry summary', { variant: 'error' }));
  }, [enqueueSnackbar]);

  useEffect(() => {
    setLoading(true);
    const days = tab === 0 ? 0 : DAYS_BY_TAB[tab];
    const params: Record<string, unknown> = { page: page + 1, limit: 20 };
    if (tab > 0) params.days = days;

    // For tab 0, we want only expired
    const url = tab === 0 ? '/expiry/alerts' : '/expiry/alerts';
    if (tab === 0) params.days = 0;

    api.get(url, { params })
      .then(({ data }) => {
        let filtered = data.data as ExpiryMedicine[];
        if (tab === 0) filtered = filtered.filter((m) => m.expiryStatus === 'expired');
        else if (tab === 1) filtered = filtered.filter((m) => m.expiryStatus === 'critical' || m.expiryStatus === 'expired');
        setMedicines(filtered);
        setTotal(data.pagination?.total || filtered.length);
      })
      .catch(() => enqueueSnackbar('Failed to load expiry alerts', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [tab, page, enqueueSnackbar]);

  const columns = [
    {
      id: 'name', label: 'Medicine', minWidth: 200,
      render: (row: ExpiryMedicine) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
          <Typography variant="caption" color="text.secondary">{row.genericName}</Typography>
        </Box>
      ),
    },
    { id: 'batchNumber', label: 'Batch No.', minWidth: 120 },
    {
      id: 'expiryDate', label: 'Expiry Date', minWidth: 120,
      render: (row: ExpiryMedicine) => new Date(row.expiryDate).toLocaleDateString('en-IN'),
    },
    {
      id: 'daysToExpiry', label: 'Days Left', minWidth: 100, align: 'center' as const,
      render: (row: ExpiryMedicine) => (
        <Chip
          label={row.daysToExpiry < 0 ? `${Math.abs(row.daysToExpiry)}d ago` : `${row.daysToExpiry}d`}
          color={STATUS_CONFIG[row.expiryStatus].color}
          size="small"
        />
      ),
    },
    {
      id: 'currentStock', label: 'Stock', minWidth: 80, align: 'right' as const,
    },
    {
      id: 'loss', label: 'Est. Loss', minWidth: 110, align: 'right' as const,
      render: (row: ExpiryMedicine) => (
        <Typography variant="body2" fontWeight={600} color="error.main">
          ₹{(row.currentStock * row.purchasePrice).toFixed(2)}
        </Typography>
      ),
    },
    {
      id: 'status', label: 'Status', minWidth: 120,
      render: (row: ExpiryMedicine) => (
        <Chip
          label={STATUS_CONFIG[row.expiryStatus].label}
          color={STATUS_CONFIG[row.expiryStatus].color}
          size="small"
          variant="outlined"
        />
      ),
    },
  ];

  return (
    <Box>
      {/* Summary cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Expired"
            value={summary?.expired || 0}
            subtitle="Need immediate action"
            icon={<ErrorOutline />}
            color="#d32f2f"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Expiring <30 days"
            value={summary?.expiring30 || 0}
            subtitle="Critical attention"
            icon={<Warning />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="30-60 Days"
            value={summary?.expiring60 || 0}
            subtitle="Plan for return"
            icon={<Warning />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="60-90 Days"
            value={summary?.expiring90 || 0}
            subtitle="Monitor closely"
            icon={<Warning />}
            color="#fbc02d"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ mb: 2 }}>
            <Tab label="Expired" />
            <Tab label="< 30 Days" />
            <Tab label="< 60 Days" />
            <Tab label="< 90 Days" />
          </Tabs>

          <DataTable
            columns={columns}
            rows={medicines}
            loading={loading}
            total={total}
            page={page}
            rowsPerPage={20}
            onPageChange={setPage}
            keyExtractor={(row) => row._id}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExpiryAlerts;
