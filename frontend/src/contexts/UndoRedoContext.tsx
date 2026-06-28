import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useMemo,
} from 'react';

const STORAGE_KEY = 'chenaikit_undo_history';

export type ActionType =
  | 'form_field_change'
  | 'filter_change'
  | 'settings_change'
  | 'data_modification'
  | 'layout_change';

export interface UndoRedoAction {
  id: string;
  type: ActionType;
  description: string;
  timestamp: number;
  execute: () => void;
  undo: () => void;
  group?: string;
  metadata?: Record<string, unknown>;
}

export interface SerializableActionEntry {
  id: string;
  type: ActionType;
  description: string;
  timestamp: number;
  group?: string;
  metadata?: Record<string, unknown>;
}

interface UndoRedoState {
  undoStack: UndoRedoAction[];
  redoStack: UndoRedoAction[];
}

type StackAction =
  | { type: 'EXECUTE'; action: UndoRedoAction; maxHistorySize: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'BATCH_UNDO'; count: number }
  | { type: 'CLEAR' }
  | { type: 'REPLACE_LAST'; action: UndoRedoAction }
  | { type: 'LOAD'; undoStack: UndoRedoAction[]; redoStack: UndoRedoAction[] };

function reducer(state: UndoRedoState, stackAction: StackAction): UndoRedoState {
  switch (stackAction.type) {
    case 'EXECUTE': {
      const undoStack = [...state.undoStack, stackAction.action];
      if (undoStack.length > stackAction.maxHistorySize) {
        undoStack.shift();
      }
      return { undoStack, redoStack: [] };
    }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const undoStack = [...state.undoStack];
      const action = undoStack.pop()!;
      return { undoStack, redoStack: [...state.redoStack, action] };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const redoStack = [...state.redoStack];
      const action = redoStack.pop()!;
      return { undoStack: [...state.undoStack, action], redoStack };
    }
    case 'BATCH_UNDO': {
      if (state.undoStack.length === 0 || stackAction.count <= 0) return state;
      const undoStack = [...state.undoStack];
      const undone: UndoRedoAction[] = [];
      for (let i = 0; i < stackAction.count && undoStack.length > 0; i++) {
        undone.push(undoStack.pop()!);
      }
      return { undoStack, redoStack: [...state.redoStack, ...undone.reverse()] };
    }
    case 'REPLACE_LAST': {
      if (state.undoStack.length === 0) {
        return { undoStack: [stackAction.action], redoStack: [] };
      }
      const undoStack = [...state.undoStack];
      undoStack[undoStack.length - 1] = stackAction.action;
      return { undoStack, redoStack: [] };
    }
    case 'CLEAR':
      return { undoStack: [], redoStack: [] };
    case 'LOAD':
      return { undoStack: stackAction.undoStack, redoStack: stackAction.redoStack };
    default:
      return state;
  }
}

export interface UndoRedoContextValue {
  undoStack: UndoRedoAction[];
  redoStack: UndoRedoAction[];
  canUndo: boolean;
  canRedo: boolean;
  maxHistorySize: number;
  execute: (action: UndoRedoAction) => void;
  undo: () => void;
  redo: () => void;
  jumpTo: (targetIndex: number) => void;
  clear: () => void;
  replaceLast: (action: UndoRedoAction) => void;
  persistActions: () => void;
  restoreActions: () => SerializableActionEntry[];
}

const UndoRedoContext = createContext<UndoRedoContextValue | undefined>(undefined);

interface UndoRedoProviderProps {
  children: React.ReactNode;
  maxHistorySize?: number;
  persistKey?: string;
  debounceMs?: number;
}

let _actionIdCounter = 0;
export const generateActionId = (): string =>
  `action-${Date.now()}-${++_actionIdCounter}`;

export const serializeAction = (action: UndoRedoAction): SerializableActionEntry => ({
  id: action.id,
  type: action.type,
  description: action.description,
  timestamp: action.timestamp,
  group: action.group,
  metadata: action.metadata,
});

export const UndoRedoProvider: React.FC<UndoRedoProviderProps> = ({
  children,
  maxHistorySize = 50,
  persistKey = STORAGE_KEY,
  debounceMs = 300,
}) => {
  const [state, dispatch] = useReducer(reducer, {
    undoStack: [],
    redoStack: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const debounceMap = useRef<Map<string, number>>(new Map());

  const persistActions = useCallback(() => {
    try {
      const data: { undoStack: SerializableActionEntry[]; redoStack: SerializableActionEntry[] } = {
        undoStack: stateRef.current.undoStack.map(serializeAction),
        redoStack: stateRef.current.redoStack.map(serializeAction),
      };
      localStorage.setItem(persistKey, JSON.stringify(data));
    } catch {
    }
  }, [persistKey]);

  const restoreActions = useCallback((): SerializableActionEntry[] => {
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return [];
      const data = JSON.parse(raw) as { undoStack: SerializableActionEntry[] };
      return data.undoStack || [];
    } catch {
      return [];
    }
  }, [persistKey]);

  const execute = useCallback(
    (action: UndoRedoAction) => {
      if (debounceMs > 0) {
        const now = Date.now();
        const { undoStack, redoStack } = stateRef.current;
        const key = `${action.type}:${action.description}:${action.group || ''}:${undoStack.length}:${redoStack.length}`;
        const last = debounceMap.current.get(key);
        if (last && now - last < debounceMs) return;
        debounceMap.current.set(key, now);
      }

      action.execute();
      dispatch({ type: 'EXECUTE', action, maxHistorySize });
    },
    [maxHistorySize, debounceMs],
  );

  const replaceLast = useCallback(
    (action: UndoRedoAction) => {
      const prev = stateRef.current.undoStack;
      if (prev.length > 0) {
        prev[prev.length - 1].undo();
      }
      action.execute();
      dispatch({ type: 'REPLACE_LAST', action });
    },
    [],
  );

  const undo = useCallback(() => {
    const stack = stateRef.current.undoStack;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    action.undo();
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    const stack = stateRef.current.redoStack;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    action.execute();
    dispatch({ type: 'REDO' });
  }, []);

  const jumpTo = useCallback((targetIndex: number) => {
    const stack = stateRef.current.undoStack;
    if (targetIndex < 0 || targetIndex >= stack.length) return;
    const count = stack.length - 1 - targetIndex;
    if (count === 0) return;
    const actionsToUndo = stack.slice(targetIndex + 1);
    for (let i = actionsToUndo.length - 1; i >= 0; i--) {
      actionsToUndo[i].undo();
    }
    dispatch({ type: 'BATCH_UNDO', count });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    try {
      localStorage.removeItem(persistKey);
    } catch {
    }
  }, [persistKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => {
    const timer = setTimeout(persistActions, 500);
    return () => clearTimeout(timer);
  }, [state, persistActions]);

  const contextValue = useMemo<UndoRedoContextValue>(
    () => ({
      undoStack: state.undoStack,
      redoStack: state.redoStack,
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
      maxHistorySize,
      execute,
      undo,
      redo,
      jumpTo,
      clear,
      replaceLast,
      persistActions,
      restoreActions,
    }),
    [
      state.undoStack,
      state.redoStack,
      maxHistorySize,
      execute,
      undo,
      redo,
      jumpTo,
      clear,
      replaceLast,
      persistActions,
      restoreActions,
    ],
  );

  return (
    <UndoRedoContext.Provider value={contextValue}>
      {children}
    </UndoRedoContext.Provider>
  );
};

export const useUndoRedoContext = (): UndoRedoContextValue => {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) {
    throw new Error(
      'useUndoRedoContext must be used within an UndoRedoProvider',
    );
  }
  return ctx;
};

export default UndoRedoContext;
