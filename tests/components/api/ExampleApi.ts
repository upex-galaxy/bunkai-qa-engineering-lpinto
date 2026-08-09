/**
 * KATA Architecture - Layer 3: Example API Component
 *
 * ⚠️  REFERENCE PATTERN - component demoing the KATA API-component shape
 * against REAL Bunkai endpoints (adapted 2026-08-09 after `bun run api:sync`).
 * The /api/v1/auth/* and /api/v1/health routes below exist on staging.
 *
 * To create your own functional component:
 * 1. Copy this file to tests/components/api/YourApi.ts
 * 2. Replace fictional endpoints with your real API endpoints
 * 3. Update types to match your API's request/response schemas
 * 4. Register in ApiFixture.ts
 * 5. Run: bun run kata:manifest
 *
 * KATA Principles Demonstrated:
 * - ATCs are COMPLETE test cases (mini-flows), NOT single API calls
 * - Each ATC has a UNIQUE expected output (Equivalence Partitioning)
 * - Tuple returns: [APIResponse, TBody, TPayload] for type-safe access
 * - Fixed assertions validate the ATC succeeded
 */

import type { APIResponse } from '@playwright/test';
import type { ErrorEnvelope, HealthResponse, SignInRequest, SignInResponse } from '@schemas/example.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from ExampleApi
export type { ErrorEnvelope, HealthResponse, SignInRequest, SignInResponse } from '@schemas/example.types';

// ============================================
// Example API Component
// ============================================

export class ExampleApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: POST /api/v1/auth/signin with valid credentials - expects success (200)
   *
   * Complete flow: POST credentials, validate response structure.
   * Returns the response tuple for test assertions.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-101'))
   * TODO: Point at your API's real sign-in endpoint
   */
  @atc('PROJ-101')
  async signInSuccessfully(
    payload: SignInRequest,
  ): Promise<[APIResponse, SignInResponse, SignInRequest]> {
    // TODO: Update endpoint
    const [response, body, sentPayload] = await this.apiPOST<SignInResponse, SignInRequest>(
      '/api/v1/auth/signin',
      payload,
    );

    // Fixed assertions - validates the operation succeeded
    expect(response.status()).toBe(200);
    expect(body.user).toBeDefined();
    expect(body.user.id).toBeDefined();

    // Optional: Store the auto-minted PAT for subsequent requests
    if (body.pat.token !== undefined && body.pat.token !== '') {
      this.setAuthToken(body.pat.token);
    }

    return [response, body, sentPayload];
  }

  /**
   * ATC: POST /api/v1/auth/signin with invalid credentials - expects error (401/422)
   *
   * Validates that invalid data returns the canonical error envelope.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-102'))
   * TODO: Update endpoint path
   */
  @atc('PROJ-102')
  async signInWithInvalidCredentials(
    payload: SignInRequest,
  ): Promise<[APIResponse, ErrorEnvelope, SignInRequest]> {
    // TODO: Update endpoint
    const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, SignInRequest>(
      '/api/v1/auth/signin',
      payload,
    );

    // Fixed assertions - validates error response
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.ok()).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /api/v1/health - expects success (200)
   *
   * Example of a GET ATC for fetching resources.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-103'))
   * TODO: Update endpoint path
   */
  @atc('PROJ-103')
  async getHealthStatus(): Promise<[APIResponse, HealthResponse]> {
    // TODO: Update endpoint
    const [response, body] = await this.apiGET<HealthResponse>('/api/v1/health');

    // Fixed assertions
    expect(response.status()).toBe(200);
    expect(body.service).toBeDefined();

    return [response, body];
  }
}
