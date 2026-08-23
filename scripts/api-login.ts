#!/usr/bin/env bun
/**
 * API Login CLI - Authentication Token Generator
 *
 * Authenticates against the project API and stores the token for:
 *   1. Playwright tests  → .auth/api-state.json
 *   2. OpenAPI MCP tools → .env (API_TOKEN var, consumed at MCP-server spawn
 *      via .mcp.json `${API_TOKEN}` and opencode.jsonc `{env:API_TOKEN}`)
 *
 * After running this command, RESTART the terminal session before re-launching
 * Claude Code or OpenCode — MCP servers cache env vars at spawn time.
 *
 * Usage:
 *   bun run api:login                 # Uses TEST_ENV from .env (default: local)
 *   bun run api:login local           # Authenticate against local environment
 *   bun run api:login staging         # Authenticate against staging environment
 *   bun run api:login --help          # Show help
 *
 * Environment URLs, credentials, and auth endpoints are sourced from
 * config/variables.ts (single source of truth). See that file to add
 * new environments or change URLs.
 */

import type { ApiState } from '@data/types';

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================
// Logging (must be defined early for validation errors)
// ============================================

const PREFIX = '[api-login]';

function log(msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const icons = { info: '\u2139', success: '\u2713', warn: '\u26A0', error: '\u2717' };
  const colors = { info: '\x1B[36m', success: '\x1B[32m', warn: '\x1B[33m', error: '\x1B[31m' };
  console.log(`${colors[type]}${icons[type]}\x1B[0m ${PREFIX} ${msg}`);
}

// ============================================
// CLI Argument Parsing (BEFORE config import)
// ============================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Validate TEST_ENV from CLI arg
const validEnvs = ['local', 'staging']; // Must match Environment type in config/variables.ts
const envArg = args[0];
if (envArg) {
  if (!validEnvs.includes(envArg)) {
    log(`Unknown environment: "${envArg}"`, 'error');
    log(`Available environments: ${validEnvs.join(', ')}`, 'info');
    process.exit(1);
  }
}

// Force-read .env into process.env so config/variables.ts picks up the
// latest values even if Bun auto-loaded a stale cached version.
const projectRoot = resolve(import.meta.dir, '..');
const envPath = resolve(projectRoot, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { continue; }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) { continue; }
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

// CLI arg overrides .env value for TEST_ENV
if (envArg) {
  process.env.TEST_ENV = envArg;
}

// Dynamic import: config/variables.ts reads TEST_ENV at evaluation time,
// so we must set it above BEFORE this import runs.
const { config, env } = await import('@variables');

// ============================================
// Constants
// ============================================

const PROJECT_ROOT = resolve(import.meta.dir, '..');
const ENV_FILE = resolve(PROJECT_ROOT, '.env');
const ENV_TOKEN_KEY = 'API_TOKEN';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  PROJECT-SPECIFIC: Bunkai Auth Flow                             ║
// ║  Multi-step: signin → (signup → OTP via Resend → confirm)      ║
// ║  Saves the PAT (long-lived) as primary token.                   ║
// ╚══════════════════════════════════════════════════════════════════╝

const BUNKAI_HEADERS = { 'Accept': '*/*', 'Content-Type': 'application/json' };

interface BunkaiAuthResult {
  pat: string
  accessToken: string
  expiresIn: number
  refreshToken: string | null
}

/**
 * Try direct signin (works if email is already confirmed).
 */
async function trySignin(email: string, password: string): Promise<BunkaiAuthResult | null> {
  const url = `${config.apiUrl}${config.auth.loginEndpoint}`;
  log(`Trying signin at ${url}...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: BUNKAI_HEADERS,
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    log(`Signin failed (${res.status}): ${body}`, 'warn');
    return null;
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = data.session as Record<string, unknown> | undefined;
  const pat = data.pat as Record<string, unknown> | undefined;

  if (!pat?.token) {
    log('Signin response missing pat.token', 'warn');
    return null;
  }

  return {
    pat: String(pat.token),
    accessToken: String(session?.access_token ?? ''),
    expiresIn: Number(session?.expires_in ?? 3600),
    refreshToken: session?.refresh_token ? String(session.refresh_token) : null,
  };
}

/**
 * Register new account via signup endpoint.
 */
async function signup(email: string, password: string): Promise<boolean> {
  const url = `${config.apiUrl}${config.auth.signupEndpoint}`;
  log(`Signing up at ${url}...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: BUNKAI_HEADERS,
    body: JSON.stringify({ email, password }),
  });

  const body = await res.text();
  if (!res.ok) {
    log(`Signup failed (${res.status}): ${body}`, 'error');
    return false;
  }

  log(`Signup response: ${body}`, 'info');
  return true;
}

/**
 * Resend confirmation email for existing unconfirmed account.
 */
async function resendConfirmation(email: string): Promise<void> {
  const url = `${config.apiUrl}${config.auth.resendEndpoint}`;
  log(`Resending confirmation at ${url}...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: BUNKAI_HEADERS,
    body: JSON.stringify({ email }),
  });

  const body = await res.text();
  if (!res.ok) {
    log(`Resend failed (${res.status}): ${body}`, 'warn');
  }
  else {
    log(`Resend response: ${body}`, 'info');
  }
}

/**
 * Read the latest OTP from Resend inbox for the given email.
 * Uses the Resend CLI (resend emails receiving list/get) since the REST API
 * for receiving is not publicly available.
 */
async function readOtpFromResend(toEmail: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log('RESEND_API_KEY not set in .env — cannot read OTP automatically.', 'error');
    return null;
  }

  log('Reading OTP from Resend inbox via CLI...');

  try {
    // List recent received emails via CLI
    const listProc = Bun.spawnSync(['resend', 'emails', 'receiving', 'list', '-q'], {
      env: { ...process.env, RESEND_API_KEY: apiKey },
    });

    if (listProc.exitCode !== 0) {
      log(`Resend CLI list failed: ${listProc.stderr.toString()}`, 'error');
      return null;
    }

    const listData = JSON.parse(listProc.stdout.toString()) as { data?: Array<{ id: string, to: string[], subject: string, created_at: string }> };
    const emails = listData.data ?? [];

    // Find the most recent confirmation email for this address
    const match = emails.find(e =>
      e.to.some(t => t.toLowerCase() === toEmail.toLowerCase())
      && e.subject.toLowerCase().includes('confirm'),
    );

    if (!match) {
      log('No confirmation email found in Resend inbox.', 'error');
      return null;
    }

    log(`Found email ${match.id} (${match.created_at})`, 'info');

    // Get full email content via CLI
    const getProc = Bun.spawnSync(['resend', 'emails', 'receiving', 'get', match.id, '-q'], {
      env: { ...process.env, RESEND_API_KEY: apiKey },
    });

    if (getProc.exitCode !== 0) {
      log(`Resend CLI get failed: ${getProc.stderr.toString()}`, 'error');
      return null;
    }

    const emailData = JSON.parse(getProc.stdout.toString()) as { text?: string, html?: string };
    const text = emailData.text ?? emailData.html ?? '';

    // Extract 6-8 digit OTP
    const otpMatch = text.match(/\b(\d{6,8})\b/);
    if (!otpMatch) {
      log('Could not extract OTP from email content.', 'error');
      log(`Email text preview: ${text.slice(0, 200)}`, 'info');
      return null;
    }

    log(`OTP extracted: ${otpMatch[1]}`, 'success');
    return otpMatch[1];
  }
  catch (error) {
    log(`Resend read failed: ${String(error)}`, 'error');
    return null;
  }
}

/**
 * Confirm email with OTP and get PAT.
 */
async function confirmWithOtp(email: string, otp: string): Promise<BunkaiAuthResult | null> {
  const url = `${config.apiUrl}${config.auth.confirmEndpoint}`;
  log(`Confirming at ${url}...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: BUNKAI_HEADERS,
    body: JSON.stringify({ email, token: otp }),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    log(`Confirm failed (${res.status}): ${rawBody}`, 'error');
    return null;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawBody) as Record<string, unknown>;
  }
  catch {
    log(`Confirm returned invalid JSON: ${rawBody.slice(0, 200)}`, 'error');
    return null;
  }

  const session = data.session as Record<string, unknown> | undefined;
  const pat = data.pat as Record<string, unknown> | undefined;

  if (!pat?.token) {
    log('Confirm response missing pat.token', 'error');
    log(`Response: ${rawBody}`, 'info');
    return null;
  }

  log('Email confirmed, PAT received.', 'success');
  return {
    pat: String(pat.token),
    accessToken: String(session?.access_token ?? ''),
    expiresIn: Number(session?.expires_in ?? 3600),
    refreshToken: session?.refresh_token ? String(session.refresh_token) : null,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  END OF PROJECT-SPECIFIC CONFIGURATION                          ║
// ╚══════════════════════════════════════════════════════════════════╝

// ============================================
// Authentication (orchestrator)
// ============================================

async function authenticate(): Promise<ApiState | null> {
  const { email, password } = config.testUser;

  if (!email || !password) {
    const prefix = env.current.toUpperCase();
    log('Missing credentials in .env file:', 'error');
    if (!email) { log(`  - ${prefix}_USER_EMAIL is not set`, 'error'); }
    if (!password) { log(`  - ${prefix}_USER_PASSWORD is not set`, 'error'); }
    log('Set these in your .env file and try again.', 'info');
    return null;
  }

  try {
    // 1. Try direct signin (fast path — email already confirmed)
    const signinResult = await trySignin(email, password);
    if (signinResult) {
      return {
        token: signinResult.pat,
        tokenType: 'Bearer',
        expiresIn: signinResult.expiresIn,
        refreshToken: signinResult.refreshToken,
        source: 'api-login',
        createdAt: new Date().toISOString(),
      };
    }

    // 2. Signup → read OTP from Resend → confirm
    log('Signin failed — attempting signup + OTP confirm flow...', 'info');

    const signupOk = await signup(email, password);
    if (!signupOk) {
      // 409 = account exists but may not be confirmed — try resend + confirm anyway
      log('Signup returned error — trying resend + confirm (account may exist)...', 'info');
      await resendConfirmation(email);
    }

    // Wait for email delivery
    log('Waiting 5s for email delivery...', 'info');
    await new Promise(r => setTimeout(r, 5000));

    const otp = await readOtpFromResend(email);
    if (!otp) {
      log('Could not retrieve OTP. Check Resend inbox manually.', 'error');
      return null;
    }

    const confirmResult = await confirmWithOtp(email, otp);
    if (!confirmResult) { return null; }

    return {
      token: confirmResult.pat,
      tokenType: 'Bearer',
      expiresIn: confirmResult.expiresIn,
      refreshToken: confirmResult.refreshToken,
      source: 'api-login',
      createdAt: new Date().toISOString(),
    };
  }
  catch (error) {
    log('Connection failed. Is the server running?', 'error');
    log(`  ${String(error)}`, 'error');
    return null;
  }
}

// ============================================
// Token Storage: api-state.json
// ============================================

function saveApiState(apiState: ApiState): void {
  const apiStatePath = config.auth.apiStatePath;
  const dir = apiStatePath.substring(0, apiStatePath.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(apiStatePath, JSON.stringify(apiState, null, 2));
  log(`Token saved to ${apiStatePath}`, 'success');
}

// ============================================
// Token Storage: .env (consumed by MCP servers at spawn)
// ============================================
//
// Both .mcp.json (Claude Code) and opencode.jsonc (OpenCode) reference the
// API_TOKEN env var via expansion (`${API_TOKEN}` and `{env:API_TOKEN}`).
// We only need to keep .env in sync — never write secrets into the committed
// config files. After this runs, the user must restart their terminal
// session so MCP servers pick up the new value at spawn time.

function updateEnvFile(token: string): void {
  if (!existsSync(ENV_FILE)) {
    log(`.env not found at ${ENV_FILE} — copy .env.example to .env first.`, 'error');
    log('Token saved to .auth/api-state.json only. MCP servers will not see it.', 'warn');
    return;
  }

  const raw = readFileSync(ENV_FILE, 'utf-8');
  const trailingNewline = raw.endsWith('\n');
  const lines = raw.split('\n');
  const linePattern = new RegExp(`^${ENV_TOKEN_KEY}\\s*=`);
  const replacement = `${ENV_TOKEN_KEY}=${token}`;

  let replaced = false;
  const updated = lines.map((line) => {
    if (linePattern.test(line)) {
      replaced = true;
      return replacement;
    }
    return line;
  });

  if (!replaced) {
    if (trailingNewline) {
      // Drop the empty trailing element split() produced, append new line, restore newline.
      if (updated[updated.length - 1] === '') {
        updated.pop();
      }
      updated.push(replacement);
      updated.push('');
    }
    else {
      updated.push(replacement);
    }
  }

  const tmpFile = `${ENV_FILE}.tmp`;
  writeFileSync(tmpFile, updated.join('\n'));
  renameSync(tmpFile, ENV_FILE);
  log(`Token saved to .env (${ENV_TOKEN_KEY})`, 'success');
}

// ============================================
// Help
// ============================================

function showHelp(): void {
  console.log(`
\x1B[1mAPI Login\x1B[0m - Authenticate and store PAT for tests & MCP tools

\x1B[1mUSAGE\x1B[0m
  bun run api:login [environment]

\x1B[1mENVIRONMENTS\x1B[0m
  local       Authenticate against local dev server (default)
  staging     Authenticate against Bunkai staging server

\x1B[1mFLOW (staging)\x1B[0m
  1. Try signin (fast path if email already confirmed)
  2. If fails: signup → read OTP from Resend → confirm email
  3. Save PAT (long-lived token) to storage

\x1B[1mEXAMPLES\x1B[0m
  bun run api:login                  # Uses TEST_ENV from .env
  bun run api:login local            # Force local environment
  bun run api:login staging          # Force staging environment

\x1B[1mTOKEN STORAGE\x1B[0m
  .auth/api-state.json    Used by Playwright test fixtures
  .env (API_TOKEN)        Read by .mcp.json (\${API_TOKEN}) and
                          opencode.jsonc ({env:API_TOKEN}) at MCP-server spawn.
                          RESTART your terminal after login so MCPs pick it up.

\x1B[1mREQUIRED .env VARIABLES\x1B[0m
  For local:    LOCAL_USER_EMAIL, LOCAL_USER_PASSWORD
  For staging:  STAGING_USER_EMAIL, STAGING_USER_PASSWORD, RESEND_API_KEY

\x1B[1mCONFIGURATION\x1B[0m
  Environment URLs:   config/variables.ts (envDataMap)
  Auth flow:          scripts/api-login.ts (Bunkai multi-step section)

\x1B[1mOPTIONS\x1B[0m
  -h, --help    Show this help
`);
}

// ============================================
// Main Execution
// ============================================

console.log(`\n\x1B[1mAPI Login\x1B[0m — ${env.current}\n`);

log(`User: ${config.testUser.email}`);

// 1. Authenticate
const apiState = await authenticate();
if (!apiState) {
  process.exit(1);
}

log('Authentication successful', 'success');
log(`Token type: ${apiState.tokenType}`);
log(`Expires in: ${apiState.expiresIn} seconds`);

// 2. Save token to api-state.json
saveApiState(apiState);

// 3. Sync API_TOKEN into .env so MCP servers pick it up at next spawn.
updateEnvFile(apiState.token);

console.log('\n\x1B[32m\u2713 Login completed!\x1B[0m');
console.log('\n\x1B[33m\u26A0\x1B[0m  RESTART your terminal session before re-launching Claude Code or OpenCode.');
console.log('   MCP servers cache env vars at spawn time \u2014 they will not pick up the');
console.log('   new API_TOKEN until the parent shell is restarted.\n');
