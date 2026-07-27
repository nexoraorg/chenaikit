import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { useKeyboardShortcutContext, formatShortcutCombo } from '../contexts/KeyboardShortcutContext';
import type { ShortcutGroup } from '../contexts/KeyboardShortcutContext';

// ─── Props ───────────────────────────────────────────────────────────────────

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

// ─── Key component for rendering key combos ──────────────────────────────────

interface KeyProps {
  children: string;
}

const Key: React.FC<KeyProps> = ({ children }) => (
  <Chip
    label={children}
    size="small"
    variant="outlined"
    sx={{
      fontFamily: 'monospace',
      fontWeight: 700,
      fontSize: '0.75rem',
      minWidth: 28,
      height: 26,
      borderRadius: 1,
      borderColor: 'divider',
      backgroundColor: 'action.hover',
      '& .MuiChip-label': { px: 0.75 },
    }}
  />
);

// ─── Combo renderer ──────────────────────────────────────────────────────────

const ShortcutComboDisplay: React.FC<{ combo: string }> = ({ combo }) => {
  const parts = combo.split(' + ');
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <Typography variant="body2" sx={{ color: 'text.disabled', mx: 0.25 }}>
              +
            </Typography>
          )}
          <Key>{part}</Key>
        </React.Fragment>
      ))}
    </Box>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A dialog that displays all registered keyboard shortcuts grouped by category.
 */
const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose,
}) => {
  const { getGroups } = useKeyboardShortcutContext();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const groups = getGroups();
  const selectedCategory = activeCategory ?? groups[0]?.category ?? null;

  const shortcuts = groups.find((g) => g.category === selectedCategory)?.shortcuts ?? [];

  if (groups.length === 0) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="shortcuts-help-title"
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' },
        }}
      >
        <DialogTitle
          id="shortcuts-help-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 2.5,
            pb: 2,
            fontWeight: 700,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <KeyboardIcon color="primary" />
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Keyboard Shortcuts
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 3 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            No keyboard shortcuts are currently available.
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

  const categoryKeys = groups.map((g) => g.category);

  return (
    <Fade in={open} timeout={300}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="shortcuts-help-title"
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' },
        }}
        TransitionProps={{ timeout: 300 }}
      >
        <DialogTitle
          id="shortcuts-help-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 2.5,
            pb: 2,
            fontWeight: 700,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <KeyboardIcon color="primary" />
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Keyboard Shortcuts
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
            {categoryKeys.map((category) => (
              <Box
                key={category}
                onClick={() => setActiveCategory(category)}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  borderBottom: '2px solid',
                  borderColor: selectedCategory === category ? 'primary.main' : 'transparent',
                  color: selectedCategory === category ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {category}
              </Box>
            ))}
          </Box>

          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, pl: 3, width: 220 }}>
                    Shortcut
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, pr: 3 }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shortcuts.map((shortcut, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      '&:hover': { backgroundColor: 'action.hover' },
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <TableCell sx={{ pl: 3 }}>
                      <ShortcutComboDisplay combo={formatShortcutCombo(shortcut.combo)} />
                    </TableCell>
                    <TableCell sx={{ pr: 3 }}>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {shortcut.description}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Tip: Press{' '}
              <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
                ?
              </Typography>{' '}
              at any time to open this help dialog.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Fade>
  );
};

export default KeyboardShortcutsHelp;
