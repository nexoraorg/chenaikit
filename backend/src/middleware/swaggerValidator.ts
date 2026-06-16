/**
 * @module middleware/swaggerValidator
 * @description Express middleware that validates incoming requests against the OpenAPI specification.
 * Checks that request bodies match the schemas defined in the spec before reaching route handlers.
 */

import { Request, Response, NextFunction } from "express";
import { swaggerSpec } from "../config/swagger";

/**
 * Resolved OpenAPI paths from the swagger spec.
 */
const getSpecPaths = (): Record<string, any> => {
  return (swaggerSpec as any).paths || {};
};

/**
 * Resolved OpenAPI component schemas from the swagger spec.
 */
const getSpecSchemas = (): Record<string, any> => {
  return (swaggerSpec as any).components?.schemas || {};
};

/**
 * Resolves a `$ref` string to the actual schema object.
 *
 * @param ref - A JSON reference string like `#/components/schemas/LoginRequest`
 * @returns The resolved schema object, or undefined if not found
 */
function resolveRef(ref: string): any {
  if (!ref.startsWith("#/components/schemas/")) return undefined;
  const schemaName = ref.split("/").pop();
  if (!schemaName) return undefined;
  return getSpecSchemas()[schemaName];
}

/**
 * Validates a value against an OpenAPI schema definition.
 * Supports type checking, required fields, enum validation, and minLength.
 *
 * @param value - The value to validate
 * @param schema - The OpenAPI schema object
 * @returns An array of validation error messages (empty if valid)
 */
function validateAgainstSchema(value: any, schema: any): string[] {
  const errors: string[] = [];

  if (!schema || !value) return errors;

  // Resolve $ref if present
  const resolved = schema.$ref ? resolveRef(schema.$ref) : schema;
  if (!resolved) return errors;

  // Type check
  if (
    resolved.type === "object" &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    // Check required fields
    if (resolved.required && Array.isArray(resolved.required)) {
      for (const field of resolved.required) {
        if (value[field] === undefined || value[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check individual properties
    if (resolved.properties) {
      for (const [key, propSchema] of Object.entries(resolved.properties) as [
        string,
        any,
      ][]) {
        if (value[key] !== undefined) {
          // Type validation
          if (propSchema.type === "string" && typeof value[key] !== "string") {
            errors.push(`Field '${key}' must be a string`);
          }
          if (propSchema.type === "number" && typeof value[key] !== "number") {
            errors.push(`Field '${key}' must be a number`);
          }
          if (
            propSchema.type === "integer" &&
            (typeof value[key] !== "number" || !Number.isInteger(value[key]))
          ) {
            errors.push(`Field '${key}' must be an integer`);
          }
          if (
            propSchema.type === "boolean" &&
            typeof value[key] !== "boolean"
          ) {
            errors.push(`Field '${key}' must be a boolean`);
          }

          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(value[key])) {
            errors.push(
              `Field '${key}' must be one of: ${propSchema.enum.join(", ")}`,
            );
          }

          // MinLength validation
          if (
            propSchema.minLength &&
            typeof value[key] === "string" &&
            value[key].length < propSchema.minLength
          ) {
            errors.push(
              `Field '${key}' must be at least ${propSchema.minLength} characters`,
            );
          }

          // Format validation (email)
          if (propSchema.format === "email" && typeof value[key] === "string") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value[key])) {
              errors.push(`Field '${key}' must be a valid email address`);
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Normalises an Express route path to match OpenAPI path format.
 * Converts Express `:param` to OpenAPI `{param}` style.
 *
 * @param expressPath - Express route path like `/api/accounts/:id`
 * @returns OpenAPI-style path like `/api/accounts/{id}`
 */
function normalisePathForSpec(expressPath: string): string {
  return expressPath.replace(/:([^/]+)/g, "{$1}");
}

/**
 * Express middleware that validates incoming request bodies against the OpenAPI spec.
 * Only applies to requests with JSON bodies on documented endpoints.
 * Returns 422 with validation errors if the body doesn't match the schema.
 *
 * @example
 * ```typescript
 * // Apply to all routes
 * app.use(validateRequestAgainstSpec);
 *
 * // Or apply to specific routes
 * app.use('/api/auth', validateRequestAgainstSpec);
 * ```
 */
export function validateRequestAgainstSpec(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only validate requests with JSON bodies
  if (!req.body || Object.keys(req.body).length === 0) {
    next();
    return;
  }

  const method = req.method.toLowerCase();
  const paths = getSpecPaths();

  // Try to find matching path in spec
  const normalisedPath = normalisePathForSpec(req.path);
  const pathSpec = paths[normalisedPath];

  if (!pathSpec || !pathSpec[method]) {
    // Path not in spec — skip validation
    next();
    return;
  }

  const operationSpec = pathSpec[method];
  const requestBodySpec = operationSpec.requestBody;

  if (!requestBodySpec) {
    // No request body defined in spec — skip validation
    next();
    return;
  }

  const jsonSchema = requestBodySpec.content?.["application/json"]?.schema;
  if (!jsonSchema) {
    next();
    return;
  }

  const errors = validateAgainstSchema(req.body, jsonSchema);

  if (errors.length > 0) {
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body does not match the API specification",
        details: errors.map((msg) => ({ field: "", message: msg })),
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
}
