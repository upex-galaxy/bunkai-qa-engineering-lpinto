#!/usr/bin/env bun
/**
 * Update pinned MCP package versions in opencode.jsonc and .mcp.json.
 *
 * Usage:
 *   bun scripts/update-mcp-versions.ts          # check + update
 *   bun scripts/update-mcp-versions.ts --check   # check only (exit 1 if outdated)
 *
 * Why pinned versions?
 *   bunx with @latest checks npm registry on every launch. On slow networks
 *   this exceeds opencode's 30s MCP startup timeout, causing servers to be
 *   marked disabled. Pinning avoids the registry check.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

const PACKAGES = [
  { name: '@bytebase/dbhub', opencodeKey: 'dbhub', mcpJsonKey: 'dbhub' },
  { name: '@playwright/mcp', opencodeKey: 'playwright', mcpJsonKey: 'playwright' },
];

interface VersionResult {
  name: string
  latest: string
  opencodeCurrent: string | null
  mcpJsonCurrent: string | null
}

async function getLatestVersion(pkg: string): Promise<string> {
  const proc = Bun.spawn(['npm', 'view', pkg, 'version'], { stdout: 'pipe' });
  const text = await new Response(proc.stdout).text();
  return text.trim();
}

function extractVersion(content: string, pkgName: string): string | null {
  // Match patterns like "@bytebase/dbhub@1.2.1" or "@playwright/mcp@0.0.79"
  const regex = new RegExp(`("${pkgName.replace('/', '\\/')}@)([^"]+)"`);
  const match = content.match(regex);
  return match ? match[2] : null;
}

function replaceVersion(content: string, pkgName: string, newVersion: string): string {
  const regex = new RegExp(`(${pkgName.replace('/', '\\/')}@)[^"]+`);
  return content.replace(regex, `$1${newVersion}`);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const results: VersionResult[] = [];

  for (const pkg of PACKAGES) {
    const latest = await getLatestVersion(pkg.name);
    const opencodePath = join(ROOT, 'opencode.jsonc');
    const mcpJsonPath = join(ROOT, '.mcp.json');

    const opencodeContent = readFileSync(opencodePath, 'utf-8');
    const mcpJsonContent = readFileSync(mcpJsonPath, 'utf-8');

    results.push({
      name: pkg.name,
      latest,
      opencodeCurrent: extractVersion(opencodeContent, pkg.name),
      mcpJsonCurrent: extractVersion(mcpJsonContent, pkg.name),
    });
  }

  // Print status
  console.log('\nMCP Package Versions:\n');
  const needsUpdate: VersionResult[] = [];

  for (const r of results) {
    const opencodeOk = r.opencodeCurrent === r.latest;
    const mcpJsonOk = r.mcpJsonCurrent === r.latest;
    const allOk = opencodeOk && mcpJsonOk;

    const icon = allOk ? '✓' : '↑';
    console.log(`  ${icon} ${r.name}`);
    console.log(`    latest:   ${r.latest}`);
    if (!opencodeOk) { console.log(`    opencode: ${r.opencodeCurrent} (needs update)`); }
    if (!mcpJsonOk) { console.log(`    .mcp.json: ${r.mcpJsonCurrent} (needs update)`); }
    if (allOk) { console.log('    both files: up to date'); }
    console.log();

    if (!allOk) { needsUpdate.push(r); }
  }

  if (needsUpdate.length === 0) {
    console.log('All MCP packages are up to date.');
    return;
  }

  if (checkOnly) {
    console.log(`${needsUpdate.length} package(s) need updating. Run without --check to update.`);
    process.exit(1);
  }

  // Apply updates
  const opencodePath = join(ROOT, 'opencode.jsonc');
  const mcpJsonPath = join(ROOT, '.mcp.json');

  let opencodeContent = readFileSync(opencodePath, 'utf-8');
  let mcpJsonContent = readFileSync(mcpJsonPath, 'utf-8');

  for (const r of needsUpdate) {
    if (r.opencodeCurrent !== r.latest) {
      opencodeContent = replaceVersion(opencodeContent, r.name, r.latest);
    }
    if (r.mcpJsonCurrent !== r.latest) {
      mcpJsonContent = replaceVersion(mcpJsonContent, r.name, r.latest);
    }
  }

  writeFileSync(opencodePath, opencodeContent);
  writeFileSync(mcpJsonPath, mcpJsonContent);

  console.log(`Updated ${needsUpdate.length} package(s) in opencode.jsonc and .mcp.json`);
  console.log('Restart opencode to pick up the new versions.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
