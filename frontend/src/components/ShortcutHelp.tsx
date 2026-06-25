import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  RestartAlt as RestartAltIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { ShortcutId, SHORTCUT_CATEGORIES, getShortcutCategoryLabel, getShortcutDisplayLabel } from '../shortcuts';
import { useShortcutContext } from '../contexts/ShortcutContext';

interface ShortcutRecorderProps {
  shortcutId: ShortcutId;
}

const keyFromEvent = (event: React.KeyboardEvent<HTMLInputElement>): string => {
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return '';

  const parts = [
    event.ctrlKey ? 'ctrl' : '',
    event.metaKey ? 'meta' : '',
    event.altKey ? 'alt' : '',
    event.shiftKey ? 'shift' : '',
    key,
  ].filter(Boolean);

  return parts.join('+');
};

const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({ shortcutId }) => {
  const {
    getShortcutBinding,
    resetShortcutBinding,
    setShortcutBinding,
  } = useShortcutContext();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const currentBinding = getShortcutBinding(shortcutId);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      setDraft('');
      setMessage(null);
      return;
    }

    const next = keyFromEvent(event);
    if (!next) return;
    setDraft(next);
    setMessage(null);
  };

  const handleSave = () => {
    const result = setShortcutBinding(shortcutId, { keys: draft });
    if (result.ok) {
      setDraft('');
      setMessage('Saved');
      return;
    }
    setMessage(result.error ?? 'Shortcut could not be saved.');
  };

  const handleReset = () => {
    resetShortcutBinding(shortcutId);
    setDraft('');
    setMessage('Reset to default');
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
      <TextField
        value={draft || getShortcutDisplayLabel(currentBinding)}
        onKeyDown={handleKeyDown}
        size="small"
        inputProps={{
          'aria-label': `Record shortcut for ${shortcutId}`,
          readOnly: true,
        }}
        sx={{ minWidth: 180 }}
      />
      <Tooltip title="Save shortcut">
        <span>
          <IconButton
            aria-label={`Save shortcut for ${shortcutId}`}
            disabled={!draft}
            onClick={handleSave}
            size="small"
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset shortcut">
        <IconButton
          aria-label={`Reset shortcut for ${shortcutId}`}
          onClick={handleReset}
          size="small"
        >
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {message && (
        <Typography
          color={message === 'Saved' || message === 'Reset to default' ? 'success.main' : 'error.main'}
          variant="caption"
        >
          {message}
        </Typography>
      )}
    </Stack>
  );
};

export const ShortcutHelp: React.FC = () => {
  const {
    closeHelp,
    customBindings,
    getShortcutBinding,
    helpOpen,
    resetAllShortcutBindings,
    shortcuts,
  } = useShortcutContext();

  const groupedShortcuts = useMemo(
    () =>
      SHORTCUT_CATEGORIES.map((category) => ({
        ...category,
        shortcuts: shortcuts.filter((shortcut) => shortcut.category === category.id),
      })).filter((category) => category.shortcuts.length > 0),
    [shortcuts]
  );

  return (
    <Dialog
      aria-labelledby="shortcut-help-title"
      fullWidth
      maxWidth="md"
      onClose={closeHelp}
      open={helpOpen}
    >
      <DialogTitle id="shortcut-help-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyboardIcon color="primary" />
        Keyboard Shortcuts
        <IconButton
          aria-label="Close shortcut help"
          onClick={closeHelp}
          sx={{ ml: 'auto' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 3 }}>
          Shortcuts pause while you type in form fields. Existing buttons, links, and tabs remain available for every action.
        </Alert>

        <Stack spacing={3}>
          {groupedShortcuts.map((category) => (
            <Box key={category.id}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {category.label}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label={`${getShortcutCategoryLabel(category.id)} shortcuts`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Shortcut</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Customize</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {category.shortcuts.map((shortcut) => {
                      const binding = getShortcutBinding(shortcut.id);
                      const isCustomized = Boolean(customBindings[shortcut.id]);

                      return (
                        <TableRow key={shortcut.id}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {shortcut.title}
                            </Typography>
                            <Typography color="text.secondary" variant="caption">
                              {shortcut.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              component="kbd"
                              label={getShortcutDisplayLabel(binding)}
                              size="small"
                              variant={isCustomized ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label={shortcut.scope} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <ShortcutRecorder shortcutId={shortcut.id} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Typography color="text.secondary" variant="body2">
          Avoid browser-owned shortcuts such as refresh, print, bookmark, address bar, and tab controls. The shortcut recorder blocks those combinations and any duplicate app bindings.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAllShortcutBindings} startIcon={<RestartAltIcon />}>
          Reset All
        </Button>
        <Button onClick={closeHelp} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ShortcutFeedback: React.FC = () => {
  const { feedback } = useShortcutContext();

  if (!feedback) return null;

  return (
    <Box
      aria-live="polite"
      role="status"
      sx={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: (theme) => theme.zIndex.snackbar + 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 4,
        px: 2,
        py: 1,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {feedback.title}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        {feedback.label}
      </Typography>
    </Box>
  );
};

export default ShortcutHelp;
