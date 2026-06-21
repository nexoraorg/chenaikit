import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  UndoRedoProvider,
  useUndoRedoContext,
} from '../UndoRedoContext';

// ─── Test helper ─────────────────────────────────────────────────────────────

const TestConsumer: React.FC = () => {
  const ctx = useUndoRedoContext();
  return (
    <div>
      <span data-testid="can-undo">{ctx.canUndo ? 'yes' : 'no'}</span>
      <span data-testid="can-redo">{ctx.canRedo ? 'yes' : 'no'}</span>
      <span data-testid="undo-size">{ctx.undoStack.length}</span>
      <span data-testid="redo-size">{ctx.redoStack.length}</span>
      <button
        data-testid="execute"
        onClick={() =>
          ctx.execute({
            id: `test-${Date.now()}`,
            type: 'form_field_change',
            description: 'Test action',
            timestamp: Date.now(),
            execute: jest.fn(),
            undo: jest.fn(),
          })
        }
      >
        Execute
      </button>
      <button data-testid="undo" onClick={ctx.undo}>
        Undo
      </button>
      <button data-testid="redo" onClick={ctx.redo}>
        Redo
      </button>
      <button data-testid="clear" onClick={ctx.clear}>
        Clear
      </button>
      <button
        data-testid="jump-to-0"
        onClick={() => ctx.jumpTo(0)}
      >
        Jump to 0
      </button>
    </div>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UndoRedoContext', () => {
  it('should start with empty stacks', () => {
    render(
      <UndoRedoProvider>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    expect(screen.getByTestId('can-undo')).toHaveTextContent('no');
    expect(screen.getByTestId('can-redo')).toHaveTextContent('no');
    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
  });

  it('should add an action and allow undo', () => {
    render(
      <UndoRedoProvider>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('execute'));
    });

    expect(screen.getByTestId('can-undo')).toHaveTextContent('yes');
    expect(screen.getByTestId('can-redo')).toHaveTextContent('no');
    expect(screen.getByTestId('undo-size')).toHaveTextContent('1');

    act(() => {
      fireEvent.click(screen.getByTestId('undo'));
    });

    expect(screen.getByTestId('can-undo')).toHaveTextContent('no');
    expect(screen.getByTestId('can-redo')).toHaveTextContent('yes');
    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('1');
  });

  it('should allow redo after undo', () => {
    render(
      <UndoRedoProvider>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('execute'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('undo'));
    });

    expect(screen.getByTestId('can-redo')).toHaveTextContent('yes');

    act(() => {
      fireEvent.click(screen.getByTestId('redo'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('1');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
  });

  it('should clear both stacks', () => {
    render(
      <UndoRedoProvider>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('execute'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('clear'));
    });

    expect(screen.getByTestId('undo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('can-undo')).toHaveTextContent('no');
    expect(screen.getByTestId('can-redo')).toHaveTextContent('no');
  });

  it('should clear redo stack on new execute', () => {
    render(
      <UndoRedoProvider>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('execute'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('undo'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('execute'));
    });

    expect(screen.getByTestId('redo-size')).toHaveTextContent('0');
    expect(screen.getByTestId('undo-size')).toHaveTextContent('1');
  });

  it('should enforce maxHistorySize', () => {
    render(
      <UndoRedoProvider maxHistorySize={3}>
        <TestConsumer />
      </UndoRedoProvider>,
    );

    for (let i = 0; i < 5; i++) {
      act(() => {
        fireEvent.click(screen.getByTestId('execute'));
      });
    }

    expect(screen.getByTestId('undo-size')).toHaveTextContent('3');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useUndoRedoContext must be used within an UndoRedoProvider',
    );
    consoleSpy.mockRestore();
  });
});
