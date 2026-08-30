import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
} from '@mui/material';
import { WarningAmberRounded } from '@mui/icons-material';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmColor?: 'error' | 'primary' | 'warning';
}

const ConfirmDialog: React.FC<Props> = ({
  open, title = 'Confirm Action', message, onConfirm, onCancel,
  confirmText = 'Confirm', confirmColor = 'error',
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            bgcolor: `${confirmColor}.main`, opacity: 0.9,
          }}
        >
          <WarningAmberRounded sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} variant="outlined" color="inherit">Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
