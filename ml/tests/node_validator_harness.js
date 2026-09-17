const {
  validateFeatureVector,
  imputeFeatureVector,
  validateModelResult,
  EXAMPLE_FEATURE_VECTOR,
  EXAMPLE_FEATURE_VECTOR_WITH_GAPS,
  EXAMPLE_MODEL_RESULT,
  EXAMPLE_MODEL_RESULT_WITH_IMPUTATION,
} = require("../../packages/chenai-mlflow/dist/index.js");

const command = process.argv[2];
const payloadStr = process.argv[3];

try {
  if (command === "validate-feature-vector") {
    const payload = JSON.parse(payloadStr);
    const validated = validateFeatureVector(payload);
    process.stdout.write(JSON.stringify({ success: true, result: validated }));
  } else if (command === "impute-feature-vector") {
    const payload = JSON.parse(payloadStr);
    const imputed = imputeFeatureVector(payload);
    process.stdout.write(JSON.stringify({ success: true, result: imputed }));
  } else if (command === "validate-model-result") {
    const payload = JSON.parse(payloadStr);
    const validated = validateModelResult(payload);
    process.stdout.write(JSON.stringify({ success: true, result: validated }));
  } else if (command === "export-examples") {
    process.stdout.write(
      JSON.stringify({
        EXAMPLE_FEATURE_VECTOR,
        EXAMPLE_FEATURE_VECTOR_WITH_GAPS,
        EXAMPLE_MODEL_RESULT,
        EXAMPLE_MODEL_RESULT_WITH_IMPUTATION,
      }),
    );
  } else {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exit(1);
  }
} catch (err) {
  process.stdout.write(
    JSON.stringify({
      success: false,
      error: err.message,
      issues: err.issues || [],
    }),
  );
}
