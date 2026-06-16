## Overview
Implement comprehensive API documentation using OpenAPI/Swagger specification.

## Current State
- No API documentation
- No OpenAPI specification
- No interactive API explorer
- Limited documentation for developers

## Requirements
1. **OpenAPI Specification**
   - Complete API specification
   - Request/response schemas
   - Authentication documentation
   - Error response documentation
   - Example requests/responses

2. **Interactive Documentation**
   - Swagger UI integration
   - Try-it-out functionality
   - Request builder
   - Response visualization
   - Authentication support

3. **Documentation Features**
   - Auto-generate from code
   - Keep in sync with code
   - Versioning support
   - Multiple environments
   - Export as JSON/YAML

4. **Integration**
   - Express middleware
   - TypeScript types generation
   - Client SDK generation
   - API testing integration
   - CI/CD validation

## Technical Details
- Use swagger-ui-express
- Use swagger-jsdoc for annotations
- Generate TypeScript types from OpenAPI
- Add validation against spec

## Files to Create/Modify
- `backend/src/config/swagger.ts` (create)
- `backend/src/swagger/` (create spec files)
- Add JSDoc comments to all routes
- `backend/src/index.ts` (add Swagger middleware)
- `backend/scripts/generate-types.ts` (create)

## Acceptance Criteria
- [ ] OpenAPI spec is complete
- [ ] Swagger UI is accessible
- [ ] Try-it-out works
- [ ] Documentation is auto-generated
- [ ] TypeScript types are generated
- [ ] Spec validates correctly
- [ ] Authentication works in UI
- [ ] Examples are comprehensive

## References
- Swagger UI: https://swagger.io/tools/swagger-ui/
- swagger-jsdoc: https://www.npmjs.com/package/swagger-jsdoc
- OpenAPI Specification: https://swagger.io/specification/