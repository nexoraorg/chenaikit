CREATE TABLE "model_evaluation_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "modelVersionId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "reportJson" TEXT NOT NULL,
  "reportHash" TEXT NOT NULL,
  "policyJson" TEXT NOT NULL,
  "policyHash" TEXT NOT NULL,
  "artifactHash" TEXT NOT NULL,
  "datasetHash" TEXT NOT NULL,
  "codeCommit" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "decision" TEXT NOT NULL,
  "failureReasons" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_evaluation_reports_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ml_model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "model_evaluation_reports_modelVersionId_reportHash_key" ON "model_evaluation_reports"("modelVersionId", "reportHash");
CREATE INDEX "model_evaluation_reports_modelVersionId_createdAt_idx" ON "model_evaluation_reports"("modelVersionId", "createdAt");

CREATE TABLE "model_promotion_overrides" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "modelVersionId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "authorizedRole" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_promotion_overrides_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ml_model_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "model_promotion_overrides_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "model_evaluation_reports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "model_promotion_overrides_modelVersionId_idx" ON "model_promotion_overrides"("modelVersionId");
