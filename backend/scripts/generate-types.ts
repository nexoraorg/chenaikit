/**
 * Generate TypeScript types from the OpenAPI specification.
 *
 * Usage:
 *   npx ts-node scripts/generate-types.ts
 *   # or via npm script:
 *   pnpm --filter @chenaikit/backend run generate:api-types
 *
 * Output:
 *   src/types/generated-api.ts
 */

import fs from "fs";
import path from "path";

async function main() {
  // Dynamically import the swagger spec (it runs swagger-jsdoc at import time)
  const { swaggerSpec } = await import("../src/config/swagger");

  const specJson = JSON.stringify(swaggerSpec, null, 2);
  const outputDir = path.resolve(__dirname, "..", "src", "types");
  const specOutputPath = path.resolve(outputDir, "openapi-spec.json");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the resolved OpenAPI spec as JSON
  fs.writeFileSync(specOutputPath, specJson, "utf-8");
  console.log(`✅ OpenAPI spec written to ${specOutputPath}`);

  // Generate TypeScript types using openapi-typescript (if installed)
  try {
    const openapiTS = await import("openapi-typescript");
    const generateFn = openapiTS.default || openapiTS;

    if (typeof generateFn === "function") {
      const output = await generateFn(swaggerSpec as any);
      const tsOutputPath = path.resolve(outputDir, "generated-api.ts");
      const content = typeof output === "string" ? output : String(output);
      fs.writeFileSync(tsOutputPath, content, "utf-8");
      console.log(`✅ TypeScript types written to ${tsOutputPath}`);
    } else {
      console.log(
        "ℹ️  openapi-typescript loaded but generate function not found.",
      );
      console.log(
        "   The OpenAPI spec JSON has been saved — you can generate types manually with:",
      );
      console.log(
        `   npx openapi-typescript ${specOutputPath} -o ${path.resolve(outputDir, "generated-api.ts")}`,
      );
    }
  } catch {
    console.log(
      "ℹ️  openapi-typescript not installed. Skipping TypeScript type generation.",
    );
    console.log(
      "   Install it with: pnpm add -D openapi-typescript --filter @chenaikit/backend",
    );
    console.log("   Then re-run this script, or generate types manually with:");
    console.log(
      `   npx openapi-typescript ${specOutputPath} -o ${path.resolve(outputDir, "generated-api.ts")}`,
    );
  }
}

main().catch((err) => {
  console.error("Failed to generate types:", err);
  process.exit(1);
});
