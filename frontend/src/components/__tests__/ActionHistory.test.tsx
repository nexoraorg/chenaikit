import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UndoRedoProvider } from '../../contexts/UndoRedoContext';
import { ActionHistory } from '../ActionHistory';
import { useUndoRedoContext } from '../../contexts/UndoRedoContext';

// ─── Helper ──────────────────────────────────────────────────────────────────

const ActionTrigger: React.FC = () => {
  const ctx = useUndoRedoContext();
  return (
    <button
      data-testid="trigger-action"
      onClick={() =>
        ctx.execute({
          id: `test-${Date.now()}`,
          type: 'filter_change',
          description: 'Changed time range',
          timestamp: Date.now(),
          execute: jest.fn(),
          undo: jest.fn(),
        })
      }
    >
      Trigger
    </button>
  );
};

const MultiTrigger: React.FC = () => {
  const ctx = useUndoRedoContext();
  return (
    <div>
      {['First change', 'Second change', 'Third change'].map((desc, i) => (
        <button
          key={i}
          data-testid={`trigger-${i}`}
          onClick={() =>
            ctx.execute({
              id: `test-${Date.now()}-${i}`,
              type: 'filter_change',
              description: desc,
              timestamp: Date.now(),
              execute: jest.fn(),
              undo: jest.fn(),
            })
          }
        >
          {desc}
        </button>
      ))}
    </div>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ActionHistory', () => {
  it('should show empty state when no actions', () => {
    render(
      <UndoRedoProvider>
        <ActionHistory />
      </UndoRedoProvider>,
    );

    expect(screen.getByText('No actions recorded yet')).toBeInTheDocument();
    expect(screen.getByText('Action History')).toBeInTheDocument();
  });

  it('should show action after execution', () => {
    render(
      <UndoRedoProvider>
        <ActionHistory />
        <ActionTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-action'));
    });

    expect(screen.getByText('Changed time range')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('should show multiple actions', () => {
    render(
      <UndoRedoProvider>
        <ActionHistory />
        <MultiTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-0'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('trigger-1'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('trigger-2'));
    });

    expect(screen.getAllByText('First change').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Second change').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Third change').length).toBeGreaterThanOrEqual(1);
  });

  it('should show history count badge', () => {
    render(
      <UndoRedoProvider>
        <ActionHistory />
        <ActionTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-action'));
    });

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should clear history', () => {
    render(
      <UndoRedoProvider>
        <ActionHistory showClear />
        <ActionTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-action'));
    });

    expect(screen.getByText('Changed time range')).toBeInTheDocument();

    const clearBtn = screen.getByTestId('ClearAllIcon');
    act(() => {
      fireEvent.click(clearBtn.closest('button')!);
    });

    expect(screen.getByText('No actions recorded yet')).toBeInTheDocument();
  });
});
