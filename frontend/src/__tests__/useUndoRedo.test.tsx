import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UndoRedoProvider } from '../contexts/UndoRedoContext';
import useUndoRedo from '../hooks/useUndoRedo';

// ─── Test component ──────────────────────────────────────────────────────────

const TestComponent: React.FC = () => {
  const { canUndo, canRedo, undoStack, redoStack, trackAction, undo, redo, clear } = useUndoRedo();

  return (
    <div>
      <span data-testid="can-undo">{canUndo ? 'yes' : 'no'}</span>
      <span data-testid="can-redo">{canRedo ? 'yes' : 'no'}</span>
      <span data-testid="undo-size">{undoStack.length}</span>
      <span data-testid="redo-size">{redoStack.length}</span>
      <button
        data-testid="track-action"
        onClick={() =>
          trackAction(
            'settings_change',
            'Changed setting',
            jest.fn(),
            jest.fn(),
          )
        }
      >
        Track
      </button>
      <button data-testid="undo-btn" onClick={undo}>
        Undo
      </button>
      <button data-testid="redo-btn" onClick={redo}>
        Redo
      </button>
      <button data-testid="clear-btn" onClick={clear}>
        Clear
      </button>
    </div>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useUndoRedo', () => {
  it('should track an action and update state', () => {
    render(
      <UndoRedoProvider>
        <TestComponent />
      </UndoRedoProvider>,
    );

    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');

    act(() => {
      fireEvent.click(screen.getByTestId('track-action'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('1');
    expect(screen.getByTestId('can-undo')).toHaveTextContent('yes');
  });

  it('should undo a tracked action', () => {
    render(
      <UndoRedoProvider>
        <TestComponent />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('track-action'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('undo-btn'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('1');
    expect(screen.getByTestId('can-undo')).toHaveTextContent('no');
    expect(screen.getByTestId('can-redo')).toHaveTextContent('yes');
  });

  it('should redo after undo', () => {
    render(
      <UndoRedoProvider>
        <TestComponent />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('track-action'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('undo-btn'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('redo-btn'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('1');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
  });

  it('should clear all history', () => {
    render(
      <UndoRedoProvider>
        <TestComponent />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('track-action'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('clear-btn'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'useUndoRedoContext must be used within an UndoRedoProvider',
    );
    consoleSpy.mockRestore();
  });
});
