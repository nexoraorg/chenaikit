import React from 'react';
import { IconButton, Tooltip, Badge, useMediaQuery, useTheme } from '@mui/material';
import { Undo as UndoIcon, Redo as RedoIcon } from '@mui/icons-material';
import useUndoRedo from '../hooks/useUndoRedo';

interface UndoRedoButtonsProps {
  size?: 'small' | 'medium' | 'large';
  showHistoryBadge?: boolean;
  showShortcutHints?: boolean;
}

export const UndoRedoButtons: React.FC<UndoRedoButtonsProps> = ({
  size = 'small',
  showHistoryBadge = false,
  showShortcutHints = true,
}) => {
  const { canUndo, canRedo, undo, redo, undoStack, redoStack } = useUndoRedo();
  const theme = useTheme();
  const isMac = useMediaQuery('(any-hover: none)') ? false : navigator.platform?.includes('Mac');

  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <>
      <Tooltip
        title={
          showShortcutHints
            ? `Undo (${modKey}+Z)${undoStack.length > 0 ? ` · ${undoStack.length}` : ''}`
            : 'Undo'
        }
      >
        <span>
          <IconButton
            onClick={undo}
            disabled={!canUndo}
            size={size}
            aria-label="Undo"
            sx={{
              opacity: canUndo ? 1 : 0.5,
              transition: theme.transitions.create('opacity'),
            }}
          >
            {showHistoryBadge ? (
              <Badge badgeContent={undoStack.length} color="primary" max={99}>
                <UndoIcon />
              </Badge>
            ) : (
              <UndoIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={
          showShortcutHints
            ? `Redo (${modKey}+Y)${redoStack.length > 0 ? ` · ${redoStack.length}` : ''}`
            : 'Redo'
        }
      >
        <span>
          <IconButton
            onClick={redo}
            disabled={!canRedo}
            size={size}
            aria-label="Redo"
            sx={{
              opacity: canRedo ? 1 : 0.5,
              transition: theme.transitions.create('opacity'),
            }}
          >
            {showHistoryBadge ? (
              <Badge badgeContent={redoStack.length} color="primary" max={99}>
                <RedoIcon />
              </Badge>
            ) : (
              <RedoIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
};

export default UndoRedoButtons;
