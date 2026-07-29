import { createSignerProviderFromSeed, createSignedReceipt, verifySignedReceipt } from '../attestation/signature';
import { buildReceiptBatch, buildReceiptProof, verifyReceiptInclusion } from '../attestation/merkle';
import type { InferenceReceiptV1, SignedInferenceReceipt } from '../attestation/types';

const sampleReceipt: InferenceReceiptV1 = {
  schemaVersion: 1,
  receiptId: 'rct-123',
  nonce: 'nonce-xyz',
  issuedAt: '2026-07-28T00:00:00.000Z',
  subjectCommitment: 'subject-commitment',
  modelId: 'credit-score',
  modelVersionId: 'v1.0.0',
  artifactHash: 'f'.repeat(64),
  featureSchemaHash: 'a'.repeat(64),
  featureCommitment: 'b'.repeat(64),
  outputCommitment: 'c'.repeat(64),
  keyId: 'signer-1',
  network: 'testnet',
};

describe('attestation utilities', () => {
  it('creates and verifies a signed receipt', async () => {
    const seed = new Uint8Array(32).fill(1);
    const signer = createSignerProviderFromSeed(seed, 'signer-1');
    const signed = await createSignedReceipt(sampleReceipt, signer);

    expect(signed.signatureScheme).toBe('ed25519');
    expect(signed.signature).toHaveLength(128);

    const valid = await verifySignedReceipt(signed, async () => signer.getPublicKey());
    expect(valid).toBe(true);
  });

  it('builds a batch and verifies inclusion', async () => {
    const signer = createSignerProviderFromSeed(new Uint8Array(32).fill(2), 'signer-2');
    const receipts: SignedInferenceReceipt[] = [];
    for (let i = 0; i < 4; i += 1) {
      const receipt = await createSignedReceipt({
        ...sampleReceipt,
        receiptId: `rct-${i}`,
        nonce: `nonce-${i}`,
      }, signer);
      receipts.push(receipt);
    }

    const batch = buildReceiptBatch(receipts);
    expect(batch.count).toBe(4);
    expect(batch.root).toMatch(/^[a-f0-9]{64}$/i);

    const proof = batch.receipts.map((receipt, index) => ({
      receipt,
      proof: buildReceiptProof(receipts, index),
    }));

    for (const entry of proof) {
      expect(verifyReceiptInclusion(batch.root, entry.proof)).toBe(true);
    }
  });
});
