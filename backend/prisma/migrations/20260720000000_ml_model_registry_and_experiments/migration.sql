-- CreateTable
CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "taskType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ml_model_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'staging',
    "artifactUri" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "frameworkVersion" TEXT,
    "accuracy" REAL,
    "precision" REAL,
    "recall" REAL,
    "f1Score" REAL,
    "auc" REAL,
    "trainingDataUri" TEXT,
    "trainingDataHash" TEXT,
    "hyperparameters" TEXT NOT NULL DEFAULT '{}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "datasetVersion" TEXT,
    "codeCommit" TEXT,
    "trainingRunId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "promotedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ml_model_versions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ml_models" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "modelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "metric" TEXT NOT NULL,
    "minimumDetectableEffect" REAL,
    "significanceLevel" REAL NOT NULL DEFAULT 0.05,
    "power" REAL NOT NULL DEFAULT 0.8,
    "bonferroniCorrection" BOOLEAN NOT NULL DEFAULT false,
    "canaryThresholdPct" REAL NOT NULL DEFAULT 5.0,
    "canaryWindowHours" INTEGER NOT NULL DEFAULT 24,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "experiments_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ml_models" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiment_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "trafficWeight" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "experiment_variants_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experiment_variants_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ml_model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_assignments_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experiment_assignments_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "experiment_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiment_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metricName" TEXT,
    "metricValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_events_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experiment_events_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "experiment_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "model_drift_checks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelVersionId" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "baselineAuc" REAL NOT NULL,
    "observedAuc" REAL NOT NULL,
    "aucDrop" REAL NOT NULL,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_drift_checks_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ml_model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_models_name_key" ON "ml_models"("name");

-- CreateIndex
CREATE INDEX "ml_models_taskType_idx" ON "ml_models"("taskType");

-- CreateIndex
CREATE INDEX "ml_model_versions_modelId_stage_idx" ON "ml_model_versions"("modelId", "stage");

-- CreateIndex
CREATE INDEX "ml_model_versions_contentHash_idx" ON "ml_model_versions"("contentHash");

-- CreateIndex
CREATE INDEX "ml_model_versions_stage_idx" ON "ml_model_versions"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "ml_model_versions_modelId_version_key" ON "ml_model_versions"("modelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "experiments_key_key" ON "experiments"("key");

-- CreateIndex
CREATE INDEX "experiments_modelId_idx" ON "experiments"("modelId");

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "experiments"("status");

-- CreateIndex
CREATE INDEX "experiment_variants_experimentId_idx" ON "experiment_variants"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_variants_experimentId_name_key" ON "experiment_variants"("experimentId", "name");

-- CreateIndex
CREATE INDEX "experiment_assignments_experimentId_variantId_idx" ON "experiment_assignments"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "experiment_assignments_subjectId_idx" ON "experiment_assignments"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experimentId_subjectId_key" ON "experiment_assignments"("experimentId", "subjectId");

-- CreateIndex
CREATE INDEX "experiment_events_experimentId_variantId_idx" ON "experiment_events"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "experiment_events_experimentId_eventType_idx" ON "experiment_events"("experimentId", "eventType");

-- CreateIndex
CREATE INDEX "experiment_events_subjectId_idx" ON "experiment_events"("subjectId");

-- CreateIndex
CREATE INDEX "model_drift_checks_modelVersionId_idx" ON "model_drift_checks"("modelVersionId");

-- CreateIndex
CREATE INDEX "model_drift_checks_driftDetected_idx" ON "model_drift_checks"("driftDetected");

