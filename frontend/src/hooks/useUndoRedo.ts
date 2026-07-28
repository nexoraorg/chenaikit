import { useCallback } from 'react';
import { useUndoRedoContext } from '../contexts/UndoRedoContext';
import type {
  ActionType,
  UndoRedoAction,
  SerializableActionEntry,
} from '../contexts/UndoRedoContext';
import { generateActionId } from '../contexts/UndoRedoContext';

export interface TrackActionOptions {
  type: ActionType;
  description: string;
  execute: () => void;
  undo: () => void;
  group?: string;
  metadata?: Record<string, unknown>;
  replaceLast?: boolean;
}

export interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undoStack: UndoRedoAction[];
  redoStack: UndoRedoAction[];
  undo: () => void;
  redo: () => void;
  jumpTo: (targetIndex: number) => void;
  clear: () => void;
  trackAction: (
    type: ActionType,
    description: string,
    execute: () => void,
    undo: () => void,
  ) => void;
  trackActionWithOptions: (options: TrackActionOptions) => void;
  batchActions: (
    actions: Array<{
      type: ActionType;
      description: string;
      execute: () => void;
      undo: () => void;
    }>,
    batchDescription: string,
  ) => void;
  persistActions: () => void;
  restoreActions: () => SerializableActionEntry[];
}

const useUndoRedo = (): UseUndoRedoReturn => {
  const ctx = useUndoRedoContext();

  const trackAction = useCallback(
    (
      type: ActionType,
      description: string,
      execute: () => void,
      undo: () => void,
    ) => {
      ctx.execute({
        id: generateActionId(),
        type,
        description,
        timestamp: Date.now(),
        execute,
        undo,
      });
    },
    [ctx],
  );

  const trackActionWithOptions = useCallback(
    (options: TrackActionOptions) => {
      const action: UndoRedoAction = {
        id: generateActionId(),
        type: options.type,
        description: options.description,
        timestamp: Date.now(),
        execute: options.execute,
        undo: options.undo,
        group: options.group,
        metadata: options.metadata,
      };

      if (options.replaceLast) {
        ctx.replaceLast(action);
      } else {
        ctx.execute(action);
      }
    },
    [ctx],
  );

  const batchActions = useCallback(
    (
      actions: Array<{
        type: ActionType;
        description: string;
        execute: () => void;
        undo: () => void;
      }>,
      batchDescription: string,
    ) => {
      if (actions.length === 0) return;

      actions.forEach((a, i) => {
        const action: UndoRedoAction = {
          id: generateActionId(),
          type: a.type,
          description: a.description,
          timestamp: Date.now() + i,
          execute: a.execute,
          undo: a.undo,
          group: batchDescription,
        };
        ctx.execute(action);
      });
    },
    [ctx],
  );

  return {
    canUndo: ctx.canUndo,
    canRedo: ctx.canRedo,
    undoStack: ctx.undoStack,
    redoStack: ctx.redoStack,
    undo: ctx.undo,
    redo: ctx.redo,
    jumpTo: ctx.jumpTo,
    clear: ctx.clear,
    trackAction,
    trackActionWithOptions,
    batchActions,
    persistActions: ctx.persistActions,
    restoreActions: ctx.restoreActions,
  };
};

export default useUndoRedo;
