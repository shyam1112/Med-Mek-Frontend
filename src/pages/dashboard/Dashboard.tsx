import React, { useEffect, useState } from 'react';
import {
  Grid, Box, Typography, Card, CardContent, Chip, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import {
  AttachMoney, Medication, Warning, EventBusy, ShoppingCart, TrendingUp,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/common/StatCard';
import api from '../../api';

interface DashboardData {
  todaySales: { amount: number; grossAmount: number; returnsAmount: number; count: number };
  monthlySales: { amount: number; grossAmount: number; returnsAmount: number; count: number };
  totalMedicines: number;
  lowStock: number;
  expiredMedicines: number;
  expiringSoon30: number;
  expiringSoon60: number;
  recentSales: Array<{ _id: string; billNumber: string; customerName: string; totalAmount: number; saleDate: string }>;
  monthlyRevenue: Array<{ _id: number; revenue: number; count: number }>;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const found = data.monthlyRevenue.find((r) => r._id === day);
    return { day: `${day}`, revenue: found?.revenue || 0, orders: found?.count || 0 };
  });

  return (
    <Box>
      {/* Stat cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Today's Sales"
            value={formatCurrency(data.todaySales.amount)}
            subtitle={
              data.todaySales.returnsAmount > 0
                ? `${data.todaySales.count} bills · ${formatCurrency(data.todaySales.returnsAmount)} returned`
                : `${data.todaySales.count} bills today`
            }
            icon={<AttachMoney />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Monthly Sales"
            value={formatCurrency(data.monthlySales.amount)}
            subtitle={
              data.monthlySales.returnsAmount > 0
                ? `${data.monthlySales.count} bills · ${formatCurrency(data.monthlySales.returnsAmount)} returned`
                : `${data.monthlySales.count} bills this month`
            }
            icon={<TrendingUp />}
            color="#00897b"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Medicines"
            value={data.totalMedicines}
            subtitle={`${data.lowStock} low stock items`}
            icon={<Medication />}
            color="#7b1fa2"
            onClick={() => navigate('/medicines')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Expiry Alerts"
            value={data.expiringSoon30 + data.expiredMedicines}
            subtitle={`${data.expiredMedicines} already expired`}
            icon={<EventBusy />}
            color="#d32f2f"
            onClick={() => navigate('/expiry')}
          />
        </Grid>
      </Grid>

      {/* Alert chips */}
      {(data.lowStock > 0 || data.expiredMedicines > 0 || data.expiringSoon30 > 0) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {data.expiredMedicines > 0 && (
            <Chip
              label={`${data.expiredMedicines} Expired Medicines`}
              color="error"
              icon={<Warning />}
              onClick={() => navigate('/expiry')}
              clickable
            />
          )}
          {data.expiringSoon30 > 0 && (
            <Chip
              label={`${data.expiringSoon30} Expiring in 30 Days`}
              color="warning"
              icon={<Warning />}
              onClick={() => navigate('/expiry')}
              clickable
            />
          )}
          {data.lowStock > 0 && (
            <Chip
              label={`${data.lowStock} Low Stock Items`}
              color="info"
              icon={<ShoppingCart />}
              onClick={() => navigate('/medicines')}
              clickable
            />
          )}
        </Box>
      )}

      <Grid container spacing={2.5}>
        {/* Revenue chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={0.5}>Revenue Overview</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Monthly sales performance
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(v as number), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#1976d2" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick stats */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>Quick Stats</Typography>
              {[
                { label: 'Total Medicines', value: data.totalMedicines, color: '#7b1fa2' },
                { label: 'Low Stock Items', value: data.lowStock, color: '#ed6c02' },
                { label: 'Expired Medicines', value: data.expiredMedicines, color: '#d32f2f' },
                { label: 'Expiring (30 days)', value: data.expiringSoon30, color: '#f57c00' },
                { label: 'Expiring (60 days)', value: data.expiringSoon60, color: '#fbc02d' },
              ].map((item, idx) => (
                <React.Fragment key={item.label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: item.color }}>
                      {item.value}
                    </Typography>
                  </Box>
                  {idx < 4 && <Divider />}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent sales */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>Recent Sales</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bill No.</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recentSales.map((sale) => (
                    <TableRow key={sale._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="primary">
                          {sale.billNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{sale.customerName}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(sale.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(sale.saleDate).toLocaleString('en-IN', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recentSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                        No sales yet today
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
