import nacl from 'tweetnacl';
import type { InferenceReceiptV1, SignedInferenceReceipt, SignerProvider } from './types';
import { canonicalizeReceipt } from './canonicalize';

const DOMAIN_TAG = 'CHENAIKIT:INFERENCE_RECEIPT_V1';

function toUint8(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

function receiptPayload(receipt: SignedInferenceReceipt | InferenceReceiptV1): InferenceReceiptV1 {
  const { signature, signatureScheme, ...rawPayload } = receipt as SignedInferenceReceipt;
  return rawPayload as InferenceReceiptV1;
}

function serializePayload(receipt: SignedInferenceReceipt | InferenceReceiptV1): Uint8Array {
  const payload = receiptPayload(receipt) as unknown;
  const serialized = canonicalizeReceipt(payload);
  const domain = `${DOMAIN_TAG}|`;
  return toUint8(`${domain}${serialized}`);
}

export async function createSignedReceipt(
  receipt: InferenceReceiptV1,
  signer: SignerProvider,
): Promise<SignedInferenceReceipt> {
  const payload = serializePayload(receipt);
  const signature = await signer.sign(payload);
  return {
    ...receipt,
    signature: Buffer.from(signature).toString('hex'),
    signatureScheme: 'ed25519',
  };
}

export async function verifySignedReceipt(
  signedReceipt: SignedInferenceReceipt,
  getPublicKey: (keyId: string) => Promise<Uint8Array | null>,
): Promise<boolean> {
  if (signedReceipt.signatureScheme !== 'ed25519') {
    return false;
  }

  const publicKey = await getPublicKey(signedReceipt.keyId);
  if (!publicKey) {
    return false;
  }

  const payload = serializePayload(signedReceipt);
  const signature = Buffer.from(signedReceipt.signature, 'hex');
  return nacl.sign.detached.verify(payload, signature, publicKey);
}

export function createSignerProviderFromSeed(seed: Uint8Array, keyId: string): SignerProvider {
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  return {
    getKeyId: () => keyId,
    getPublicKey: () => keyPair.publicKey,
    sign: async (message: Uint8Array) => nacl.sign.detached(message, keyPair.secretKey),
  };
}
