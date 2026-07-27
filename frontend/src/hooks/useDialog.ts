import { useCallback } from 'react';
import { useModalContext } from '../contexts/ModalContext';
import type { ModalConfig, ConfirmDialogOptions, ModalSize } from '../contexts/ModalContext';

/**
 * Hook for conveniently managing modal dialogs.
 *
 * Usage:
 * ```tsx
 * const dialog = useDialog();
 *
 * // Open a simple modal
 * dialog.open({
 *   title: 'Hello',
 *   content: <div>World</div>,
 * });
 *
 * // Open a confirmation dialog
 * const confirmed = await dialog.confirm({
 *   title: 'Delete?',
 *   message: 'Are you sure?',
 *   variant: 'danger',
 * });
 *
 * // Close the current modal
 * dialog.close();
 * ```
 */
const useDialog = () => {
  const ctx = useModalContext();

  /**
   * Open a modal with the given configuration.
   * Returns the modal ID so you can close it programmatically.
   */
  const open = useCallback(
    (config: Omit<ModalConfig, 'id'>): string => ctx.open(config),
    [ctx]
  );

  /**
   * Open a simple info modal with just a title and content.
   */
  const info = useCallback(
    (title: React.ReactNode, content: React.ReactNode, size?: ModalSize): string =>
      ctx.open({ title, content, size: size ?? 'sm' }),
    [ctx]
  );

  /**
   * Open a confirmation dialog.
   * Resolves to `true` if the user confirms, `false` otherwise.
   */
  const confirm = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => ctx.confirm(options),
    [ctx]
  );

  /**
   * Open a danger/s destructive confirmation dialog.
   */
  const confirmDanger = useCallback(
    (message: React.ReactNode, title = 'Confirm Action'): Promise<boolean> =>
      ctx.confirm({ title, message, variant: 'danger' }),
    [ctx]
  );

  /**
   * Close a specific modal by ID.
   */
  const close = useCallback(
    (id?: string) => {
      if (id) {
        ctx.close(id);
      } else {
        ctx.closeTop();
      }
    },
    [ctx]
  );

  /**
   * Close all open modals.
   */
  const closeAll = useCallback(() => ctx.closeAll(), [ctx]);

  return {
    open,
    info,
    confirm,
    confirmDanger,
    close,
    closeAll,
    modals: ctx.modals,
  };
};

export default useDialog;
