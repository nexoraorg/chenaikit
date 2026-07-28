import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UndoRedoProvider } from '../../contexts/UndoRedoContext';
import { UndoRedoButtons } from '../UndoRedoButtons';
import { useUndoRedoContext } from '../../contexts/UndoRedoContext';

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

describe('UndoRedoButtons', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should render with buttons disabled when no history', () => {
    render(
      <UndoRedoProvider>
        <UndoRedoButtons />
      </UndoRedoProvider>,
    );

    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
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

    expect(screen.getByLabelText('Undo')).not.toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
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

    act(() => {
      fireEvent.click(screen.getByLabelText('Undo'));
    });

    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).not.toBeDisabled();
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
