import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UndoRedoProvider } from '../../contexts/UndoRedoContext';
import { UndoRedoButtons } from '../UndoRedoButtons';
import { useUndoRedoContext } from '../../contexts/UndoRedoContext';

// ─── Helper to execute an action ─────────────────────────────────────────────

const ActionTrigger: React.FC = () => {
  const ctx = useUndoRedoContext();
  return (
    <button
      data-testid="trigger-action"
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
      Trigger
    </button>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UndoRedoButtons', () => {
  it('should render with buttons disabled when no history', () => {
    render(
      <UndoRedoProvider>
        <UndoRedoButtons />
      </UndoRedoProvider>,
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('should enable undo after an action', () => {
    render(
      <UndoRedoProvider>
        <UndoRedoButtons />
        <ActionTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-action'));
    });

    const buttons = screen.getAllByRole('button');
    const undoBtn = buttons[0];
    const redoBtn = buttons[1];
    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it('should enable redo after undo', () => {
    render(
      <UndoRedoProvider>
        <UndoRedoButtons />
        <ActionTrigger />
      </UndoRedoProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('trigger-action'));
    });

    let buttons = screen.getAllByRole('button');
    const undoBtn = buttons[0];

    act(() => {
      fireEvent.click(undoBtn);
    });

    buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it('should have proper aria-labels', () => {
    render(
      <UndoRedoProvider>
        <UndoRedoButtons />
      </UndoRedoProvider>,
    );

    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });
});
