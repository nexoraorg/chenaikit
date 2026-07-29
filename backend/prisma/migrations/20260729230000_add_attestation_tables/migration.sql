-- CreateTable
CREATE TABLE "attestation_signers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyId" TEXT NOT NULL UNIQUE,
    "publicKey" TEXT NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME,
    "revokedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "inference_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL UNIQUE,
    "nonce" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "requestId" TEXT,
    "correlationId" TEXT,
    "subjectCommitment" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "modelSemanticVersion" TEXT,
    "artifactHash" TEXT NOT NULL,
    "featureSchemaHash" TEXT NOT NULL,
    "featureCommitment" TEXT NOT NULL,
    "featureMerkleRoot" TEXT,
    "outputCommitment" TEXT NOT NULL,
    "publicResultSummary" TEXT,
    "keyId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "ledgerMin" INTEGER,
    "ledgerMax" INTEGER,
    "batchId" TEXT,
    "signature" TEXT NOT NULL,
    "signatureScheme" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "inference_receipts_modelVersionId_idx" ON "inference_receipts"("modelVersionId");
CREATE INDEX "inference_receipts_keyId_idx" ON "inference_receipts"("keyId");
CREATE INDEX "inference_receipts_batchId_idx" ON "inference_receipts"("batchId");
