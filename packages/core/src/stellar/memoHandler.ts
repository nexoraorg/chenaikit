
import { Memo, MemoType, Transaction } from '@stellar/stellar-sdk';

/**
 * Creates a transaction with a memo.
 *
 * @param {Transaction} transaction - The transaction to add the memo to.
 * @param {Memo} memo - The memo to add.
 * @returns {Transaction}
 */
export function addMemo(transaction: Transaction, memo: Memo): Transaction {
  transaction.memo = memo;
  return transaction;
}

/**
 * Reads a memo from a transaction.
 *
 * @param {Transaction} transaction - The transaction to read the memo from.
 * @returns {Memo | undefined}
 */
export function readMemo(transaction: Transaction): Memo | undefined {
  return transaction.memo;
}
