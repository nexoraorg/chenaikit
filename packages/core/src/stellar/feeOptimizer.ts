
import { FeeBumpTransaction, Transaction, Keypair, TransactionBuilder } from 'stellar-sdk';
import { StellarConnector } from './connector';

/**
 * Gets the current network fee.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @returns {Promise<string>}
 */
export async function getNetworkFee(stellarConnector: StellarConnector): Promise<string> {
  return await stellarConnector.getFee();
}

/**
 * Creates a fee-bump transaction.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} feeSourceSecret - The secret key of the fee source account.
 * @param {Transaction} transaction - The transaction to wrap in a fee-bump transaction.
 * @returns {Promise<FeeBumpTransaction>}
 */
export async function createFeeBumpTransaction(
  stellarConnector: StellarConnector,
  feeSourceSecret: string,
  transaction: Transaction
): Promise<FeeBumpTransaction> {
  const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);

  const feeBumpTransaction = TransactionBuilder.buildFeeBumpTransaction(
    feeSourceKeypair.publicKey(),
    await stellarConnector.getFee(),
    transaction,
    stellarConnector.getNetworkPassphrase()
  );

  feeBumpTransaction.sign(feeSourceKeypair);

  return feeBumpTransaction;
}
