
import { Asset, Operation, TransactionBuilder, Keypair } from 'stellar-sdk';
import { StellarConnector } from './connector';

/**
 * Creates a trustline for a given asset.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {Asset} asset - The asset to create a trustline for.
 * @param {string} [limit] - The trust limit.
 * @returns {Promise<void>}
 */
export async function createTrustline(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  asset: Asset,
  limit?: string
): Promise<void> {
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await stellarConnector.getAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  await stellarConnector.submitTransaction(transaction);
}

/**
 * Removes a trustline for a given asset.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {Asset} asset - The asset to remove the trustline for.
 * @returns {Promise<void>}
 */
export async function removeTrustline(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  asset: Asset
): Promise<void> {
  await createTrustline(stellarConnector, sourceSecret, asset, '0');
}

/**
 * Issues a custom asset.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} issuerSecret - The secret key of the issuing account.
 * @param {string} distributionPublicKey - The public key of the distribution account.
 * @param {Asset} asset - The asset to issue.
 * @param {string} amount - The amount to issue.
 * @returns {Promise<void>}
 */
export async function issueAsset(
  stellarConnector: StellarConnector,
  issuerSecret: string,
  distributionPublicKey: string,
  asset: Asset,
  amount: string
): Promise<void> {
  const issuerKeypair = Keypair.fromSecret(issuerSecret);
  const issuerAccount = await stellarConnector.getAccount(issuerKeypair.publicKey());

  const transaction = new TransactionBuilder(issuerAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: distributionPublicKey,
        asset,
        amount,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);
  await stellarConnector.submitTransaction(transaction);
}

/**
 * Transfers a custom asset.
 *
 * @param {StellarConnector} stellarConnector - The Stellar connector instance.
 * @param {string} sourceSecret - The secret key of the source account.
 * @param {string} destinationPublicKey - The public key of the destination account.
 * @param {Asset} asset - The asset to transfer.
 * @param {string} amount - The amount to transfer.
 * @returns {Promise<void>}
 */
export async function transferAsset(
  stellarConnector: StellarConnector,
  sourceSecret: string,
  destinationPublicKey: string,
  asset: Asset,
  amount: string
): Promise<void> {
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await stellarConnector.getAccount(sourceKeypair.publicKey());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: await stellarConnector.getFee(),
    networkPassphrase: stellarConnector.getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  await stellarConnector.submitTransaction(transaction);
}
