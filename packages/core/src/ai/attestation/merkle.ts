import { createHash } from 'crypto';
import { canonicalize } from './canonicalize';
import type { ReceiptProof, SignedInferenceReceipt, ReceiptBatch } from './types';

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function hashLeaf(data: string): string {
  return hashBytes(Buffer.from(data, 'utf8'));
}

function hashNode(left: string, right: string): string {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return hashBytes(Buffer.concat([leftBytes, rightBytes]));
}

export function buildMerkleTree(leaves: string[]): { root: string; levels: string[][] } {
  if (leaves.length === 0) {
    return { root: hashLeaf(''), levels: [['']] };
  }

  let currentLevel = leaves.map(hashLeaf);
  const levels: string[][] = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
      nextLevel.push(hashNode(left, right));
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return { root: currentLevel[0], levels };
}

export function buildReceiptBatch(receipts: SignedInferenceReceipt[]): ReceiptBatch {
  const sortedReceipts = [...receipts].sort((a, b) => a.receiptId.localeCompare(b.receiptId));
  const rawLeaves = sortedReceipts.map((receipt) => canonicalize(receipt));
  const { root, levels } = buildMerkleTree(rawLeaves);
  const leafHashes = levels[0];
  return {
    batchId: `batch-${root.slice(0, 16)}`,
    root,
    count: sortedReceipts.length,
    receipts: sortedReceipts,
    leafHashes,
  };
}

export function buildReceiptProof(receipts: SignedInferenceReceipt[], index: number): ReceiptProof {
  const sortedReceipts = [...receipts].sort((a, b) => a.receiptId.localeCompare(b.receiptId));
  const rawLeaves = sortedReceipts.map((receipt) => canonicalize(receipt));
  const { levels } = buildMerkleTree(rawLeaves);

  const leafHashes = levels[0];

  if (index < 0 || index >= leafHashes.length) {
    throw new RangeError('Receipt index is out of range');
  }

  const proofHashes: string[] = [];
  let currentIndex = index;

  for (let layer = 0; layer < levels.length - 1; layer += 1) {
    const layerNodes = levels[layer];
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    const siblingHash = layerNodes[siblingIndex] ?? layerNodes[currentIndex];
    proofHashes.push(siblingHash);
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leafIndex: index,
    hashes: proofHashes,
    leafHash: levels[0][index],
  };
}

export function verifyReceiptInclusion(root: string, proof: ReceiptProof): boolean {
  let computed = proof.leafHash;
  let currentIndex = proof.leafIndex;

  for (let i = 0; i < proof.hashes.length; i += 1) {
    const sibling = proof.hashes[i];
    if (currentIndex % 2 === 0) {
      computed = hashNode(computed, sibling);
    } else {
      computed = hashNode(sibling, computed);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }

  return computed === root;
}
