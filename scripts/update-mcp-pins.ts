#!/usr/bin/env bun
/**
 * update-mcp-pins.ts — refreshes pinned MCP package versions everywhere.
 *
 * MCP launch commands use bunx with PINNED versions (never @latest): bunx
 * resolves an @latest tag against the npm registry on EVERY launch, and on a
 * slow network that resolution alone can exceed the ~30s agent startup window,
 * after which the server is marked disabled. Pinned versions load instantly
 * from the local bunx cache — even offline.
 *
 * The cost of pinning is staleness, so this script closes the loop:
 *
 *   1. Scans the three harness MCP configs for `pkg@x.y.z` pins:
 *      .mcp.json (claude) · opencode.jsonc · .codex/config.toml
 *   2. Queries npm for each pinned package's latest published version.
 *   3. Rewrites outdated pins across those files AND
 *      scripts/agent-compatibility-contracts.ts — the cross-harness contract
 *      enforced by `agents:compat:check` (pre-commit) must expect exactly
 *      what the configs contain, or commits fail.
 *   4. Runs `agents:compat:check` to prove config/contract agreement.
 *
 * Scope: only ALREADY-PINNED packages are tracked. Unversioned bunx specs
 * (context7, openapi-mcp-server) resolve per-launch by upstream design and
 * are intentionally left alone.
 *
 * Usage: bun run mcp:update-pins
 * Exit code: 0 = pins current (or updated + gate green); 1 = check failed,
 * conflicting pins, or npm unreachable.
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import pc from 'picocolors';

const ROOT = join(import.meta.dir, '..');

const TARGET_FILES = [
  '.mcp.json',
  'opencode.jsonc',
  join('.codex', 'config.toml'),
  join('scripts', 'agent-compatibility-contracts.ts'),
];

// Scoped-or-plain npm name followed by strict semver. Dated tokens
// (`2024-11-05`) and viewport sizes (`1920x1080`) cannot match: the version
// segment requires dot-separated numerics.
const PIN_RE = /(?:@[a-z0-9-]+\/)?[a-z][\w.-]*@\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.]+)?/g;

function collectPins(): Array<{ pkg: string, current: string }> {
  const pins = new Map<string, string>();
  for (const rel of TARGET_FILES) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    for (const token of text.match(PIN_RE) ?? []) {
      const splitAt = token.lastIndexOf('@');
      const pkg = token.slice(0, splitAt);
      const ver = token.slice(splitAt + 1);
      const known = pins.get(pkg);
      if (known && known !== ver) {
        console.error(pc.red(`CONFLICT: ${pkg} is pinned to both ${known} and ${ver}. Align the configs by hand first.`));
        process.exit(1);
      }
      pins.set(pkg, ver);
    }
  }
  return [...pins].map(([pkg, current]) => ({ pkg, current }));
}

function latestVersion(pkg: string): string | null {
  try {
    const out = execSync(`npm view ${pkg} version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() || null;
  }
  catch {
    return null;
  }
}

const pins = collectPins();
if (pins.length === 0) {
  console.log(pc.yellow('No pinned MCP packages found — nothing to update.'));
  process.exit(0);
}

let updated = 0;
let failures = 0;

for (const { pkg, current } of pins) {
  process.stdout.write(`${pc.cyan(pkg)} ${pc.dim(current)} -> `);
  const latest = latestVersion(pkg);
  if (latest === null) {
    console.log(pc.red('npm lookup failed (offline?) — skipped'));
    failures += 1;
    continue;
  }
  if (latest === current) {
    console.log(pc.green('up to date'));
    continue;
  }
  let hits = 0;
  for (const rel of TARGET_FILES) {
    const path = join(ROOT, rel);
    const text = readFileSync(path, 'utf8');
    const next = text.replaceAll(`${pkg}@${current}`, `${pkg}@${latest}`);
    if (next !== text) {
      writeFileSync(path, next);
      hits += 1;
    }
  }
  console.log(pc.green(latest) + pc.dim(` (${hits} file(s) rewritten)`));
  updated += 1;
}

if (updated === 0 && failures === 0) {
  console.log(pc.green('\nAll MCP pins are current.'));
  process.exit(0);
}

if (updated === 0) {
  console.error(pc.red('\nCould not reach the npm registry — retry when online.'));
  process.exit(1);
}

console.log(pc.dim('\nVerifying cross-harness compatibility contract…'));
const check = spawnSync('bun', ['scripts/agent-compatibility.ts', '--check'], { stdio: 'inherit' });
if (check.status !== 0) {
  console.error(pc.red('\nagents:compat:check FAILED — fix before committing.'));
  process.exit(1);
}

console.log(pc.green(`\nDone: ${updated} package(s) updated. Commit the touched files, then restart your agent session so MCPs respawn with the new versions.`));
