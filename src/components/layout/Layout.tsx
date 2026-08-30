import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, AppBar, Toolbar, IconButton, Typography, Avatar, Menu, MenuItem, Divider, Badge, Tooltip,
  ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon, NotificationsOutlined, Logout, Person, KeyboardArrowDown,
  EventBusy, Warning, Inventory2Outlined, CheckCircleOutline,
} from '@mui/icons-material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/medicines': 'Medicine Management',
  '/inventory': 'Inventory Management',
  '/suppliers': 'Supplier Management',
  '/purchases': 'Purchase Management',
  '/customers': 'Customer Management',
  '/doctors': 'Doctor Management',
  '/billing': 'Billing System',
  '/sales': 'Sales & Returns',
  '/expiry': 'Expiry Alerts',
  '/reports/daily': 'Daily Sales Report',
  '/reports/monthly': 'Monthly Sales Report',
  '/reports/profit': 'Profit Report',
  '/reports/purchase': 'Purchase Report',
  '/reports/doctor-wise': 'Doctor-wise Sales Report',
  '/reports/hsn-summary': 'GST HSN Summary',
  '/reports/inventory': 'Inventory Report',
  '/reports/expiry-loss': 'Expiry Loss Report',
  '/profile': 'My Profile',
};

interface AlertIds {
  expiredIds: string[];
  expiringIds: string[];
  lowStockIds: string[];
}

interface Alerts extends AlertIds {
  expired: number;
  expiringSoon: number;
  lowStock: number;
}

const EMPTY_SEEN: AlertIds = { expiredIds: [], expiringIds: [], lowStockIds: [] };

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [alertAnchor, setAlertAnchor] = useState<null | HTMLElement>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = PAGE_TITLES[location.pathname] || 'MedMek';

  // Fetches the actual flagged medicines (not just counts) so the badge can
  // tell "still the same problems you already saw" apart from "a genuinely
  // new item just triggered this category" — see markSeen below.
  const fetchAlerts = useCallback(async (): Promise<AlertIds | null> => {
    try {
      const [expiryRes, lowStockRes] = await Promise.all([
        api.get('/expiry/alerts', { params: { days: 30, limit: 500 } }),
        api.get('/medicines', { params: { lowStock: true, limit: 500 } }),
      ]);
      const expiryItems = expiryRes.data.data as Array<{ _id: string; expiryStatus: string }>;
      const expiredIds = expiryItems.filter((m) => m.expiryStatus === 'expired').map((m) => m._id);
      const expiringIds = expiryItems.filter((m) => m.expiryStatus === 'critical').map((m) => m._id);
      const lowStockIds = (lowStockRes.data.data as Array<{ _id: string }>).map((m) => m._id);
      setAlerts({
        expired: expiredIds.length, expiringSoon: expiringIds.length, lowStock: lowStockIds.length,
        expiredIds, expiringIds, lowStockIds,
      });
      return { expiredIds, expiringIds, lowStockIds };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Opening the bell acknowledges exactly what's currently flagged — updated
  // optimistically so the badge clears immediately, persisted server-side so
  // it stays cleared across reloads/devices. It reappears only once a
  // category contains an id that wasn't in this acknowledged set.
  const markSeen = async (ids: AlertIds) => {
    updateUser({ seenAlerts: ids });
    try {
      await api.put('/auth/seen-alerts', ids);
    } catch { /* best-effort — worst case it re-prompts next time */ }
  };

  const seen = user?.seenAlerts || EMPTY_SEEN;
  const hasUnseen = (currentIds: string[], seenIds: string[]) => currentIds.some((id) => !seenIds.includes(id));

  // Badge counts notification categories with something the owner hasn't
  // acknowledged yet, not the underlying medicine quantities within each
  // (e.g. "3 medicines low on stock" is 1 notification) and not categories
  // that are still nonzero but were already seen.
  const totalAlerts = alerts
    ? [
        alerts.expiredIds.length > 0 && hasUnseen(alerts.expiredIds, seen.expiredIds),
        alerts.expiringIds.length > 0 && hasUnseen(alerts.expiringIds, seen.expiringIds),
        alerts.lowStockIds.length > 0 && hasUnseen(alerts.lowStockIds, seen.lowStockIds),
      ].filter(Boolean).length
    : 0;

  // The dropdown's own empty-state ("You're all caught up") must reflect
  // whether there's anything currently flagged at all, not whether it's been
  // seen — acknowledging an alert clears the badge, it doesn't hide the alert.
  const hasAnyAlerts = !!alerts && (alerts.expired > 0 || alerts.expiringSoon > 0 || alerts.lowStock > 0);

  const goTo = (path: string) => {
    navigate(path);
    setAlertAnchor(null);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            color: 'text.primary',
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, color: '#1e293b' }}>
              {pageTitle}
            </Typography>

            <Tooltip title="Notifications">
              <IconButton
                size="small"
                onClick={async (e) => {
                  setAlertAnchor(e.currentTarget);
                  const ids = await fetchAlerts();
                  if (ids) markSeen(ids);
                }}
              >
                <Badge badgeContent={totalAlerts} color="error">
                  <NotificationsOutlined />
                </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={alertAnchor}
              open={Boolean(alertAnchor)}
              onClose={() => setAlertAnchor(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{ sx: { mt: 1, minWidth: 300, maxHeight: 360, overflowY: 'auto' } }}
            >
              {!hasAnyAlerts ? (
                <MenuItem disabled sx={{ opacity: '1 !important' }}>
                  <ListItemIcon><CheckCircleOutline color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="You're all caught up" secondary="No alerts right now" />
                </MenuItem>
              ) : (
                [
                  alerts && alerts.expired > 0 && (
                    <MenuItem key="expired" onClick={() => goTo('/expiry')}>
                      <ListItemIcon><EventBusy color="error" fontSize="small" /></ListItemIcon>
                      <ListItemText
                        primary={`${alerts.expired} medicine${alerts.expired > 1 ? 's' : ''} expired`}
                        secondary="Remove or write off from stock"
                      />
                    </MenuItem>
                  ),
                  alerts && alerts.expiringSoon > 0 && (
                    <MenuItem key="expiring" onClick={() => goTo('/expiry')}>
                      <ListItemIcon><Warning color="warning" fontSize="small" /></ListItemIcon>
                      <ListItemText
                        primary={`${alerts.expiringSoon} expiring within 30 days`}
                        secondary="Review expiry alerts"
                      />
                    </MenuItem>
                  ),
                  alerts && alerts.lowStock > 0 && (
                    <MenuItem key="lowstock" onClick={() => goTo('/medicines?lowStock=true')}>
                      <ListItemIcon><Inventory2Outlined color="info" fontSize="small" /></ListItemIcon>
                      <ListItemText
                        primary={`${alerts.lowStock} medicine${alerts.lowStock > 1 ? 's' : ''} low on stock`}
                        secondary="Consider restocking"
                      />
                    </MenuItem>
                  ),
                ].filter(Boolean)
              )}
            </Menu>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', ml: 1 }}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Admin
                </Typography>
              </Box>
              <KeyboardArrowDown fontSize="small" color="action" />
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{ sx: { mt: 1, minWidth: 180 } }}
            >
              <MenuItem onClick={() => { navigate('/profile'); setAnchorEl(null); }}>
                <Person fontSize="small" sx={{ mr: 1.5 }} /> Profile
              </MenuItem>
              <Divider />
              <MenuItem onClick={logout} sx={{ color: 'error.main' }}>
                <Logout fontSize="small" sx={{ mr: 1.5 }} /> Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
          <Outlet />
        </Box>

        <Box
          component="footer"
          sx={{
            py: 1.5, px: 3, borderTop: '1px solid #e2e8f0',
            bgcolor: '#fff', textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} MedMek Pharmacy Management System
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
