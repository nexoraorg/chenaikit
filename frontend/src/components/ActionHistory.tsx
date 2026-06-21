import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Paper,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  History as HistoryIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ClearAll as ClearAllIcon,
  RestorePage as RestoreIcon,
  FormField as FormIcon,
  FilterList as FilterIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  ViewCompact as LayoutIcon,
} from '@mui/icons-material';
import useUndoRedo from '../hooks/useUndoRedo';
import type { ActionType, UndoRedoAction, SerializableActionEntry } from '../contexts/UndoRedoContext';

const ACTION_ICONS: Record<ActionType, React.ReactElement> = {
  form_field_change: <FormIcon fontSize="small" />,
  filter_change: <FilterIcon fontSize="small" />,
  settings_change: <SettingsIcon fontSize="small" />,
  data_modification: <EditIcon fontSize="small" />,
  layout_change: <LayoutIcon fontSize="small" />,
};

const ACTION_LABELS: Record<ActionType, string> = {
  form_field_change: 'Form',
  filter_change: 'Filter',
  settings_change: 'Settings',
  data_modification: 'Data',
  layout_change: 'Layout',
};

const ACTION_COLORS: Record<ActionType, string> = {
  form_field_change: '#3B82F6',
  filter_change: '#10B981',
  settings_change: '#F59E0B',
  data_modification: '#8B5CF6',
  layout_change: '#EC4899',
};

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

interface ActionHistoryProps {
  maxVisible?: number;
  showClear?: boolean;
  showRedoItems?: boolean;
}

export const ActionHistory: React.FC<ActionHistoryProps> = ({
  maxVisible = 20,
  showClear = true,
  showRedoItems = true,
}) => {
  const { undoStack, redoStack, jumpTo, canUndo, canRedo, clear, restoreActions } =
    useUndoRedo();
  const [persistedCount, setPersistedCount] = useState(0);

  useEffect(() => {
    const entries = restoreActions();
    setPersistedCount(entries.length);
  }, [undoStack.length, restoreActions]);

  const visibleUndo: UndoRedoAction[] = undoStack.slice(-maxVisible);
  const visibleRedo: UndoRedoAction[] = redoStack.slice(-maxVisible);
  const hasHistory = undoStack.length > 0 || redoStack.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        maxHeight: 400,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Action History
          </Typography>
          {undoStack.length > 0 && (
            <Chip label={undoStack.length} size="small" color="primary" />
          )}
          {undoStack.length === 0 && persistedCount > 0 && (
            <Chip label={`${persistedCount} saved`} size="small" variant="outlined" />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {persistedCount > 0 && undoStack.length === 0 && (
            <Tooltip title={`${persistedCount} actions from previous session`}>
              <IconButton size="small" color="default">
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasHistory && showClear && (
            <Tooltip title="Clear history">
              <IconButton size="small" onClick={clear}>
                <ClearAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {!hasHistory ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
            px: 2,
            color: 'text.disabled',
          }}
        >
          <HistoryIcon sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="body2">No actions recorded yet</Typography>
          <Typography variant="caption">
            Changes to forms, filters, and settings will appear here
          </Typography>
          {persistedCount > 0 && (
            <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
              {persistedCount} action(s) from previous session available
            </Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {showRedoItems && redoStack.length > 0 && (
            <>
              <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RedoIcon fontSize="inherit" /> Redo ({redoStack.length})
                </Typography>
              </Box>
              <List dense disablePadding>
                {[...visibleRedo].reverse().map((action) => (
                  <ListItem
                    key={action.id}
                    disablePadding
                    sx={{
                      px: 2,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: 'divider',
                      opacity: 0.7,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: ACTION_COLORS[action.type] }}>
                      {ACTION_ICONS[action.type]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 180, fontStyle: 'italic' }}>
                          {action.description}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Chip
                            label={ACTION_LABELS[action.type]}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: 10,
                              bgcolor: `${ACTION_COLORS[action.type]}20`,
                              color: ACTION_COLORS[action.type],
                              fontWeight: 600,
                            }}
                          />
                          <Typography variant="caption" color="text.disabled">
                            {formatTimestamp(action.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              <Divider />
            </>
          )}

          <List dense disablePadding>
            {[...visibleUndo].reverse().map((action, displayIndex) => {
              const realIndex = undoStack.length - 1 - displayIndex;
              const isLatest = displayIndex === 0;

              return (
                <ListItem
                  key={action.id}
                  disablePadding
                  secondaryAction={
                    <Tooltip title="Undo to this point">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => jumpTo(realIndex)}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                  sx={{
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: isLatest ? 'action.selected' : 'transparent',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon
                    sx={{ minWidth: 36, color: ACTION_COLORS[action.type] }}
                  >
                    {ACTION_ICONS[action.type]}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {action.description}
                      </Typography>
                    }
                    secondary={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.25,
                        }}
                      >
                        <Chip
                          label={ACTION_LABELS[action.type]}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            bgcolor: `${ACTION_COLORS[action.type]}20`,
                            color: ACTION_COLORS[action.type],
                            fontWeight: 600,
                          }}
                        />
                        <Typography variant="caption" color="text.disabled">
                          {formatTimestamp(action.timestamp)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {undoStack.length > maxVisible && (
            <Box
              sx={{
                px: 2,
                py: 1,
                textAlign: 'center',
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.disabled">
                + {undoStack.length - maxVisible} more actions
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ActionHistory;
