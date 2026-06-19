/**
 * Generate TypeScript types from the ChenAIKit OpenAPI specification.
 *
 * Usage:
 *   pnpm docs:generate-types
 *
 * Output:
 *   src/types/openapi.ts  — auto-generated, do not edit manually
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SPEC_OUTPUT = path.join(process.cwd(), "src/swagger/openapi.json");
const TYPES_OUTPUT = path.join(process.cwd(), "src/types/openapi.ts");

async function main() {
  console.log("??  ChenAIKit — Generating OpenAPI types\n");

  // Step 1: Export the spec to JSON
  console.log("?? Exporting OpenAPI spec...");
  const { swaggerSpec } = await import("../src/config/swagger");
  fs.mkdirSync(path.dirname(SPEC_OUTPUT), { recursive: true });
  fs.writeFileSync(SPEC_OUTPUT, JSON.stringify(swaggerSpec, null, 2));
  console.log(`   ? Spec written to ${SPEC_OUTPUT}`);

  // Step 2: Generate TypeScript types from the spec
  console.log("\n?? Generating TypeScript types...");
  fs.mkdirSync(path.dirname(TYPES_OUTPUT), { recursive: true });
  execSync(
    `npx openapi-typescript ${SPEC_OUTPUT} --output ${TYPES_OUTPUT}`,
    { stdio: "inherit" }
  );
  console.log(`   ? Types written to ${TYPES_OUTPUT}`);

  // Step 3: Add header comment
  const existingContent = fs.readFileSync(TYPES_OUTPUT, "utf-8");
  const header = `/**
 * AUTO-GENERATED — DO NOT EDIT MANUALLY
 * Generated from OpenAPI spec by scripts/generate-types.ts
 * Run: pnpm docs:generate-types
 */\n\n`;
  fs.writeFileSync(TYPES_OUTPUT, header + existingContent);

  console.log("\n? Done! Import generated types:");
  console.log("   import type { paths, components } from '@/types/openapi';");
}

main().catch((err) => {
  console.error("? Type generation failed:", err);
  process.exit(1);
});
