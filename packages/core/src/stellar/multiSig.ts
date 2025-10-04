
import StellarSdk, { Transaction, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { StellarConnector } from './connector';
import { MultiSigOptions, Signer } from './types';

/**
 * Adds a new signer to a multi-signature account.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {Signer} signer - The signer to add.
 * @returns {Promise<void>}
 */
export async function addSigner(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  signer: Signer
): Promise<void> {
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await stellarConnector.getAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.setOptions({
        signer: {
          ed25519PublicKey: signer.publicKey,
          weight: signer.weight,
        },
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  await stellarConnector.submitTransaction(transaction);
}

/**
 * Removes a signer from a multi-signature account.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {string} signerPublicKey - The public key of the signer to remove.
 * @returns {Promise<void>}
 */
export async function removeSigner(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  signerPublicKey: string
): Promise<void> {
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await stellarConnector.getAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.setOptions({
        signer: {
          ed25519PublicKey: signerPublicKey,
          weight: 0,
        },
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  await stellarConnector.submitTransaction(transaction);
}

/**
 * Sets the thresholds for a multi-signature account.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {MultiSigOptions} options - The multi-signature options.
 * @returns {Promise<void>}
 */
export async function setThresholds(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  options: MultiSigOptions
): Promise<void> {
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await stellarConnector.getAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.setOptions({
        lowThreshold: options.low,
        medThreshold: options.medium,
        highThreshold: options.high,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  await stellarConnector.submitTransaction(transaction);
}

/**
 * Creates and signs a multi-signature transaction.
 *
 * @param {string[]} signerSecrets - The secret keys of the signers.
 * @param {Transaction} transaction - The transaction to sign.
 * @returns {Transaction}
 */
export function signTransaction(
  signerSecrets: string[],
  transaction: Transaction
): Transaction {
  const keypairs = signerSecrets.map((secret) => Keypair.fromSecret(secret));
  transaction.sign(...keypairs);
  return transaction;
}
