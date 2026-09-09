import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  LocalPharmacy, ReceiptLongOutlined, Inventory2Outlined,
  NotificationsActiveOutlined, InsightsOutlined,
} from '@mui/icons-material';

const FEATURES = [
  { icon: ReceiptLongOutlined, title: 'Fast, GST-ready billing', desc: 'Print a clean tax invoice in seconds' },
  { icon: Inventory2Outlined, title: 'Stock down to the tablet', desc: 'Sell by strip, bottle, or single unit' },
  { icon: NotificationsActiveOutlined, title: 'Expiry alerts', desc: 'Never get caught selling expired stock' },
  { icon: InsightsOutlined, title: 'Reports that make sense', desc: 'Daily sales, profit, and GST — always in view' },
];

// Shared by every auth screen (Login, SignUp, ForgotPassword) so the
// background, branding, and feature panel stay pixel-identical across all
// of them — each page only supplies its own card as children.
const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 55%, #072a5e 100%)',
    }}
  >
    {/* Ambient glow + dot-grid texture — a flat gradient alone reads as
        empty at wide viewports, this gives the background actual depth. */}
    <Box
      sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
    <Box sx={{
      position: 'absolute', top: '-12%', left: '-6%', width: 520, height: 520,
      borderRadius: '50%', pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(100,181,246,0.45) 0%, rgba(100,181,246,0) 70%)',
    }} />
    <Box sx={{
      position: 'absolute', bottom: '-15%', left: '28%', width: 620, height: 620,
      borderRadius: '50%', pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(3,169,244,0.35) 0%, rgba(3,169,244,0) 70%)',
    }} />

    {/* Left: branding + feature list — hidden on small screens, where the
        centered form card alone is already the right mobile layout. */}
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        width: '50%',
        maxWidth: 600,
        py: 6,
        pl: { md: 10, lg: 12 },
        pr: 6,
        color: '#fff',
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <LocalPharmacy sx={{ fontSize: 26 }} />
        </Box>
        <Typography variant="h6" fontWeight={700}>MedMek</Typography>
      </Box>

      <Typography variant="h3" fontWeight={800} lineHeight={1.15} mb={2} sx={{ fontSize: { md: '2.6rem', lg: '3rem' } }}>
        Run your pharmacy<br />the simple way.
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, mb: 5, maxWidth: 420, fontSize: '1.05rem' }}>
        Billing, stock, and expiry — sorted, so you can focus on your customers, not your paperwork.
      </Typography>

      <Box
        sx={{
          display: 'flex', flexDirection: 'column', gap: 0.5,
          bgcolor: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 4, p: 1.5,
          backdropFilter: 'blur(6px)',
        }}
      >
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <Box
            key={title}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2, p: 1.75,
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}
          >
            <Box
              sx={{
                width: 42, height: 42, borderRadius: 2.5, flexShrink: 0,
                background: 'linear-gradient(135deg, #64b5f6 0%, #1e88e5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              <Icon sx={{ fontSize: 21, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.3}>{title}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>{desc}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>

    {/* Right: whatever card this page supplies */}
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, position: 'relative' }}>
      {children}
    </Box>
  </Box>
);

export default AuthShell;
