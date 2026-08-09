/**
 * KATA Framework - Type Facade: Example Domain
 *
 * ⚠️  REFERENCE PATTERN — this file demonstrates the Type Facade Pattern
 * for organizing OpenAPI types, now bound to REAL Bunkai schemas
 * (adapted 2026-08-09 after `bun run api:sync` replaced the stub spec).
 *
 * To create a new type facade:
 * 1. Copy this file to api/schemas/{domain}.types.ts
 * 2. Replace the schemas below with your real OpenAPI schema names
 * 3. Add re-export to api/schemas/index.ts
 * 4. Import in your component: import type { X } from '@schemas/{domain}.types'
 *
 * Prerequisites:
 * - Run `bun run api:sync` to generate api/openapi-types.ts
 * - Check available schemas: open api/openapi-types.ts and search for 'schemas'
 *
 * Sections:
 * 1. Schema Types — domain models from components['schemas']
 * 2. Endpoint Types — request/response types from paths[...], grouped by endpoint
 * 3. Custom Types — types NOT in the spec (error shapes, test helpers, etc.)
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

/** Canonical error envelope returned by every /api/v1 route on failure */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];

// ============================================================================
// Endpoint Types - POST /api/v1/auth/signin
// ============================================================================

/** Private helper: extracts the POST operation type for cleaner access */
type SignInPath = paths['/api/v1/auth/signin']['post'];

/** Request body for headless password sign-in */
export type SignInRequest = SignInPath['requestBody']['content']['application/json'];

/** Successful response (200) — session + auto-minted PAT */
export type SignInResponse = SignInPath['responses']['200']['content']['application/json'];

// ============================================================================
// Endpoint Types - GET /api/v1/health
// ============================================================================

type HealthPath = paths['/api/v1/health']['get'];

/** Successful response (200) — service identity + probe timestamp */
export type HealthResponse = HealthPath['responses']['200']['content']['application/json'];

// ============================================================================
// Custom Types (not in OpenAPI spec)
// ============================================================================

/**
 * Types that are NOT in the OpenAPI spec go here.
 * Common cases: error response shapes not documented, test helpers,
 * or types for endpoints that lack schema definitions.
 */
export interface AuthErrorResponse {
  error: string
  message?: string
  statusCode?: number
}
