import React, { useState } from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Collapse, Avatar,
} from '@mui/material';
import {
  Dashboard, Medication, Inventory, LocalShipping, ShoppingCart,
  People, Receipt, Warning, BarChart, ExpandLess, ExpandMore,
  LocalPharmacy, ReceiptLong, MedicalServices,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/' },
  { label: 'Billing', icon: <Receipt />, path: '/billing' },
  { label: 'Sales', icon: <ReceiptLong />, path: '/sales' },
  { label: 'Customers', icon: <People />, path: '/customers' },
  { label: 'Doctors', icon: <MedicalServices />, path: '/doctors' },
  { label: 'Medicines', icon: <Medication />, path: '/medicines' },
  { label: 'Inventory', icon: <Inventory />, path: '/inventory' },
  { label: 'Suppliers', icon: <LocalShipping />, path: '/suppliers' },
  { label: 'Purchases', icon: <ShoppingCart />, path: '/purchases' },
  { label: 'Expiry Alerts', icon: <Warning />, path: '/expiry' },
  {
    label: 'Reports',
    icon: <BarChart />,
    children: [
      { label: 'Daily Sales', path: '/reports/daily' },
      { label: 'Monthly Sales', path: '/reports/monthly' },
      { label: 'Profit Report', path: '/reports/profit' },
      { label: 'Purchase Report', path: '/reports/purchase' },
      { label: 'Doctor-wise Sales', path: '/reports/doctor-wise' },
      { label: 'GST HSN Summary', path: '/reports/hsn-summary' },
      { label: 'Inventory Report', path: '/reports/inventory' },
      { label: 'Expiry Loss', path: '/reports/expiry-loss' },
    ],
  },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<Props> = ({ mobileOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [openReports, setOpenReports] = useState(location.pathname.startsWith('/reports'));

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const isActive = (path?: string) => path && location.pathname === path;
  const isChildActive = (children?: { path: string }[]) =>
    children?.some((c) => location.pathname === c.path);

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LocalPharmacy sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
            MedMek
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Pharmacy Manager
          </Typography>
        </Box>
      </Box>

      {/* Store info */}
      <Box sx={{ mx: 2, mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
          Store
        </Typography>
        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
          {user?.storeName || 'My Pharmacy'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1, pt: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          if (item.children) {
            return (
              <React.Fragment key={item.label}>
                <ListItemButton
                  onClick={() => setOpenReports(!openReports)}
                  sx={{
                    borderRadius: 2, mb: 0.5,
                    bgcolor: isChildActive(item.children) ? 'rgba(255,255,255,0.08)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                    color: '#fff',
                  }}
                >
                  <ListItemIcon sx={{ color: 'rgba(255,255,255,0.75)', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }} />
                  {openReports ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={openReports}>
                  <List disablePadding>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.path}
                        onClick={() => handleNav(child.path)}
                        sx={{
                          position: 'relative',
                          borderRadius: 2, ml: 2, mb: 0.5, py: 0.75,
                          bgcolor: isActive(child.path) ? 'rgba(66,165,245,0.2)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                          color: isActive(child.path) ? '#fff' : 'rgba(255,255,255,0.7)',
                          '&::before': isActive(child.path) ? {
                            content: '""', position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
                            borderRadius: 4, backgroundColor: '#64B5F6',
                          } : undefined,
                        }}
                      >
                        <ListItemText
                          primary={child.label}
                          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: isActive(child.path) ? 600 : 400 }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }
          return (
            <ListItemButton
              key={item.path}
              onClick={() => handleNav(item.path!)}
              sx={{
                position: 'relative',
                borderRadius: 2, mb: 0.5,
                bgcolor: isActive(item.path) ? 'rgba(66,165,245,0.2)' : 'transparent',
                '&:hover': { bgcolor: isActive(item.path) ? 'rgba(66,165,245,0.28)' : 'rgba(255,255,255,0.06)' },
                color: isActive(item.path) ? '#fff' : 'rgba(255,255,255,0.85)',
                '&::before': isActive(item.path) ? {
                  content: '""', position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
                  borderRadius: 4, backgroundColor: '#64B5F6',
                } : undefined,
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? '#90CAF9' : 'rgba(255,255,255,0.75)',
                  minWidth: 36,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isActive(item.path) ? 700 : 500,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* User info — click to open profile */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />
      <Box
        onClick={() => handleNav('/profile')}
        sx={{
          p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
          cursor: 'pointer', borderRadius: 2, mx: 1, mb: 1,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          transition: 'background 0.2s',
        }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>
          {user?.name?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {sidebarContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          width: DRAWER_WIDTH, flexShrink: 0,
        }}
      >
        {sidebarContent}
      </Drawer>
    </>
  );
};

export default Sidebar;
