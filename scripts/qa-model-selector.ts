#!/usr/bin/env bun

/**
 * ============================================================================
 * QA MODEL SELECTOR — Interactive CLI to select AI models per QA role
 * ============================================================================
 *
 * Reads the `.models.catalog.json` cache written by harness-manager's
 * Re-scan, and lets you interactively assign models to each QA role (qa-plan,
 * qa-code, qa-review, qa-bulk, qa-write, qa-vision).
 *
 * Updates agent markdown files across all harnesses:
 *   .opencode/agents/, .codex/agents/, .claude/agents/
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   bun run harness-config roles                          # interactive (default)
 *   bun run harness-config roles --dry-run                # print changes, do not write
 *   bun run harness-config roles --role qa-plan --model x # set single role
 *   bun run harness-config roles --list                   # list available models
 *   bun run harness-config roles --refresh                # pointer to harness-manager (no fetch)
 *   bun run harness-config roles --help                   # show help
 *
 * ============================================================================
 * ENVIRONMENT VARIABLES
 * ============================================================================
 *
 *   MODELS_CACHE_TTL       Cache TTL in seconds (default: 86400 = 24h).
 *   MODELS_CACHE_FILE      Cache file path (default: .models.catalog.json).
 *
 * ============================================================================
 */

import type { ModelEntry } from './model-catalog.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { confirm, select, Separator } from '@inquirer/prompts';
import { goBackOrExit } from './harness-nav.ts';
import { colors, err, log, out } from './log.ts';
import { detectProvider, inferUnderlyingProvider, loadCache } from './model-catalog.ts';
import { selectModel } from './model-picker.ts';

// ============================================================================
// CONSTANTS
// ============================================================================

const REPO_ROOT = join(import.meta.dir, '..');

type QaRole = string;

interface QaRoleDef {
  id: string
  description: string
}

const ROLES_FILE = join(REPO_ROOT, '.agents', 'qa-roles.json');

const DEFAULT_ROLE_DEFS: QaRoleDef[] = [
  { id: 'qa-plan', description: 'Reasoning/analysis — shift-left, test planning, GO/NO-GO' },
  { id: 'qa-code', description: 'Code generation — KATA, Playwright, TypeScript' },
  { id: 'qa-review', description: 'Code review — KATA compliance, doctrine checking' },
  { id: 'qa-bulk', description: 'Mechanical/bulk — TC creation, CI monitoring, CLI ops' },
  { id: 'qa-write', description: 'Prose — Jira comments, ATR/ATP bodies, reports' },
  { id: 'qa-vision', description: 'Visual — screenshots, bug annotation, UI inspection' },
];

// Roles + descriptions are data-driven (.agents/qa-roles.json); the hardcoded
// list above is only the fallback when the file is missing or malformed.
function loadRoleDefs(): QaRoleDef[] {
  try {
    const data = JSON.parse(readFileSync(ROLES_FILE, 'utf8')) as unknown;
    if (Array.isArray(data) && data.length > 0) {
      const defs = data.filter((r): r is QaRoleDef =>
        typeof (r as QaRoleDef).id === 'string' && typeof (r as QaRoleDef).description === 'string');
      if (defs.length > 0) { return defs; }
    }
  }
  catch { /* fall through to defaults */ }
  return DEFAULT_ROLE_DEFS;
}

const QA_ROLES: string[] = loadRoleDefs().map(r => r.id);
const ROLE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  loadRoleDefs().map(r => [r.id, r.description]),
);

const HARNESS_DIRS = [
  '.opencode/agents',
  '.codex/agents',
  '.claude/agents',
];

const PREF_FILE = join(REPO_ROOT, '.selected-qa-models');

// ============================================================================
// TYPES
// ============================================================================

interface CliFlags {
  dryRun: boolean
  list: boolean
  refresh: boolean
  role: string | null
  model: string | null
  help: boolean
}

// ============================================================================
// CLI DETECTION
// ============================================================================

type ActiveCli = 'opencode' | 'claude-code' | 'codex';

function detectActiveCli(): ActiveCli {
  // Authoritative signal = the env var set by the running CLI. Directory-based
  // fallbacks are ambiguous: this repo commits .opencode/, .claude/ AND .codex/
  // simultaneously, so any dir check would always resolve to the first match
  // regardless of which CLI is actually running.
  if (process.env.OPENCODE === '1' || process.env.OPENCODE_PID) {
    return 'opencode';
  }
  if (process.env.CLAUDE_CODE === '1' || process.env.CLAUDE_CODE_SESSION) {
    return 'claude-code';
  }
  if (process.env.CODEX === '1' || process.env.CODEX_SESSION) {
    return 'codex';
  }
  // Safe default for this boilerplate.
  return 'opencode';
}

function getAgentDirForCli(cli: ActiveCli): string {
  switch (cli) {
    case 'claude-code': return '.claude/agents';
    case 'codex': return '.codex/agents';
    case 'opencode': return '.opencode/agents';
  }
}

export function filterModelsForCli(models: ModelEntry[], cli: ActiveCli): ModelEntry[] {
  switch (cli) {
    case 'claude-code':
      // Claude Code only supports Anthropic models
      return models.filter(m => inferUnderlyingProvider(m.id) === 'anthropic');
    case 'codex':
      // Codex only supports OpenAI models
      return models.filter(m => inferUnderlyingProvider(m.id) === 'openai');
    case 'opencode':
      // OpenCode supports all models
      return models;
  }
}

export function toHarnessModelId(cli: ActiveCli, modelId: string): string {
  if (cli !== 'claude-code') { return modelId; }
  // Claude Code agent `model:` uses short aliases (opus/sonnet/haiku), not
  // catalog IDs like opencode/claude-opus-5. Map by model family.
  const id = modelId.toLowerCase();
  if (id.includes('opus')) { return 'opus'; }
  if (id.includes('sonnet')) { return 'sonnet'; }
  if (id.includes('haiku')) { return 'haiku'; }
  return modelId.replace(/^(?:opencode-go|opencode|anthropic)\//, '');
}

// ============================================================================
// CLI PARSING
// ============================================================================

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    dryRun: false,
    list: false,
    refresh: false,
    role: null,
    model: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--list':
        flags.list = true;
        break;
      case '--refresh':
        flags.refresh = true;
        break;
      case '--role':
        flags.role = argv[++i] ?? null;
        break;
      case '--model':
        flags.model = argv[++i] ?? null;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      default:
        log.warn(`Unknown flag: ${arg} (ignored)`);
    }
  }
  return flags;
}

function printHelp(): void {
  out(`harness-config roles — select AI models per QA role

USAGE:
  bun run harness-config roles [flags]

FLAGS:
  --dry-run            Print changes without writing files.
  --list               List available models and exit.
  --refresh            Print where catalog refresh moved (no fetch from here).
  --role <role>        Set model for a single role (non-interactive).
  --model <model>      Model ID to assign (use with --role).
  --help, -h           Show this help.

ENVIRONMENT VARIABLES:
  MODELS_CACHE_TTL       Cache TTL in seconds (default: 86400).
  MODELS_CACHE_FILE      Cache file path (default: .models.catalog.json).

EXAMPLES:
  bun run harness-config roles                    # interactive selector
  bun run harness-config roles --list             # show available models
  bun run harness-config roles --role qa-plan --model opencode-go/glm-5.3
`);
}

// ============================================================================
// INTERACTIVE SELECTION
// ============================================================================

async function interactiveSelect(
  models: ModelEntry[],
  currentAssignment: Record<QaRole, string>,
  dryRun: boolean,
): Promise<Record<QaRole, string> | '__back' | null> {
  log.header('QA Model Selector — interactive mode');
  log.dim(`${models.length} model(s) available from ${new Set(models.map(m => m.provider)).size} provider(s)\n`);

  const newAssignment = { ...currentAssignment };

  while (true) {
    // Show current assignments with role selection
    log.header('Current assignments');
    const choices: (string | { value: string, name: string } | Separator)[] = [];
    for (const role of QA_ROLES) {
      choices.push({
        value: role,
        name: `${role.padEnd(12)} ${colors.dim}${newAssignment[role]}${colors.reset}`,
      });
    }
    choices.push(new Separator());
    choices.push({ value: '__done', name: 'done — save assignments' });
    choices.push({ value: '__cancel', name: 'cancel — discard changes' });
    choices.push({ value: '__back', name: '← volver' });

    const selected = await select({
      message: 'Select a role to edit',
      choices,
      loop: false,
    });

    if (selected === '__done') {
      break;
    }

    if (selected === '__cancel') {
      log.warn('Cancelled. No changes saved.');
      return null;
    }

    if (selected === '__back') {
      return '__back';
    }

    // Edit the selected role
    const role = selected;
    const current = newAssignment[role];
    const newModel = await selectModel(models, current, { subject: role, hint: ROLE_DESCRIPTIONS[role], backLabel: '← back to roles' });
    // null means user went back, so we skip the update
    if (newModel !== null && newModel !== current) {
      newAssignment[role] = newModel;
    }
  }

  // Summary
  log.header('Assignment summary');
  for (const role of QA_ROLES) {
    const changed = newAssignment[role] !== currentAssignment[role];
    const marker = changed ? `${colors.green}*${colors.reset}` : ' ';
    err(`  ${marker} ${role.padEnd(12)} ${newAssignment[role]}`);
  }

  const proceed = await confirm({
    message: dryRun ? 'Show changes? (dry-run — nothing will be written)' : 'Save these assignments?',
    default: true,
  });

  if (!proceed) {
    log.warn('Cancelled. No changes saved.');
    return null;
  }

  return newAssignment;
}

// ============================================================================
// AGENT FILE UPDATES
// ============================================================================

function findAgentFiles(agentDir?: string): string[] {
  const files: string[] = [];
  const dirs = agentDir ? [agentDir] : HARNESS_DIRS;
  for (const dir of dirs) {
    const fullPath = join(REPO_ROOT, dir);
    if (!existsSync(fullPath)) { continue; }
    for (const role of QA_ROLES) {
      const file = join(fullPath, `${role}.md`);
      if (existsSync(file)) {
        files.push(file);
      }
    }
  }
  return files;
}

function updateModelInFile(filePath: string, newModel: string): boolean {
  const content = readFileSync(filePath, 'utf8');
  // Remove ALL existing model lines and add one new one
  const lines = content.split('\n');
  const newLines: string[] = [];
  let modelAdded = false;

  for (const line of lines) {
    if (line.startsWith('model:')) {
      if (!modelAdded) {
        newLines.push(`model: ${newModel}`);
        modelAdded = true;
      }
      // Skip duplicate model lines
    }
    else {
      newLines.push(line);
    }
  }

  // If no model line was found, insert after mode: subagent
  if (!modelAdded) {
    const insertedLines: string[] = [];
    for (const line of newLines) {
      insertedLines.push(line);
      if (line === 'mode: subagent') {
        insertedLines.push(`model: ${newModel}`);
        modelAdded = true;
      }
    }
    if (modelAdded) {
      writeFileSync(filePath, insertedLines.join('\n'), 'utf8');
      return true;
    }
    return false;
  }

  writeFileSync(filePath, newLines.join('\n'), 'utf8');
  return true;
}

function applyAssignment(
  assignment: Record<QaRole, string>,
  dryRun: boolean,
  partial = false,
  cli: ActiveCli = 'opencode',
): { updated: number, skipped: number, files: string[] } {
  const agentFiles = findAgentFiles(getAgentDirForCli(cli));
  let updated = 0;
  let skipped = 0;
  const changedFiles: string[] = [];

  for (const file of agentFiles) {
    const basename = relative(REPO_ROOT, file);
    const role = basename.split(sep).pop()?.replace('.md', '') as QaRole;

    if (!QA_ROLES.includes(role)) {
      skipped++;
      continue;
    }

    const catalogModel = assignment[role];
    if (!catalogModel) {
      // In partial mode, skip roles not in the assignment
      if (partial) {
        continue;
      }
      skipped++;
      continue;
    }
    const newModel = toHarnessModelId(cli, catalogModel);

    if (dryRun) {
      const content = readFileSync(file, 'utf8');
      const currentMatch = content.match(/^model: (.+)$/m);
      const currentModel = currentMatch?.[1]?.trim() ?? '(none)';
      if (currentModel !== newModel) {
        log.info(`DRY-RUN: ${basename} ${currentModel} -> ${newModel}`);
        changedFiles.push(basename);
      }
      else {
        log.dim(`UNCHANGED: ${basename} already on ${newModel}`);
      }
      updated++;
    }
    else {
      if (updateModelInFile(file, newModel)) {
        log.success(`${basename} -> ${newModel}`);
        changedFiles.push(basename);
        updated++;
      }
      else {
        log.warn(`SKIP: ${basename} — could not update`);
        skipped++;
      }
    }
  }

  return { updated, skipped, files: changedFiles };
}

// ============================================================================
// PREFS (save/load last assignment)
// ============================================================================

function loadPrefs(): Record<QaRole, string> | null {
  try {
    const data = JSON.parse(readFileSync(PREF_FILE, 'utf8')) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const role of QA_ROLES) {
      if (data[role]) { result[role] = data[role]; }
    }
    return Object.keys(result).length > 0 ? result : null;
  }
  catch {
    return null;
  }
}

function savePrefs(assignment: Record<QaRole, string>): void {
  writeFileSync(PREF_FILE, JSON.stringify(assignment, null, 2), 'utf8');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const flags = parseArgs(process.argv);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  // --refresh no longer fetches anything — it only points at the new owner.
  if (flags.refresh) {
    log.info('Model catalog refresh moved to harness-manager — run a Re-scan there to refresh .models.catalog.json.');
  }

  // Detect active CLI
  const activeCli = detectActiveCli();
  const agentDir = getAgentDirForCli(activeCli);

  log.header(`QA Model Selector — ${activeCli}`);
  log.dim(`Agent directory: ${agentDir}\n`);

  // Read the catalog written by harness-manager (this repo never fetches).
  const catalog = loadCache();

  if (!catalog || catalog.models.length === 0) {
    log.warn('No models in .models.catalog.json — run a Re-scan in harness-manager to refresh the catalog.');
  }

  // Filter models based on CLI
  const availableModels = filterModelsForCli(catalog?.models ?? [], activeCli);
  log.dim(`${availableModels.length} model(s) compatible with ${activeCli}\n`);

  // List mode
  if (flags.list) {
    log.header('Available models by endpoint');

    // Group by source endpoint, separating OpenCode Zen free tier
    const bySource: Record<string, ModelEntry[]> = {};
    const zenFreeModels: ModelEntry[] = [];
    for (const m of availableModels) {
      const source = m.source || 'unknown';
      // Separate OpenCode Zen free tier models
      if (source === 'https://opencode.ai/zen/v1/models' && m.id.endsWith('-free')) {
        zenFreeModels.push(m);
        continue;
      }
      if (!bySource[source]) {
        bySource[source] = [];
      }
      bySource[source].push(m);
    }

    for (const [url, models] of Object.entries(bySource)) {
      if (models.length === 0) {
        continue;
      }
      const provider = detectProvider(url);
      // Rename opencode to opencode zen for display
      const displayName = provider === 'opencode' ? 'opencode zen' : provider;
      // Mask API keys in URL for security
      const maskedUrl = url.replace(/([?&]key=)[^&]+/, '$1***');
      err(`\n  ${colors.bold}${colors.cyan}${displayName}${colors.reset} ${colors.dim}(${maskedUrl})${colors.reset}`);
      err(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);

      // Sub-group by underlying provider (anthropic, openai, google, etc.)
      const byUnderlying: Record<string, ModelEntry[]> = {};
      for (const m of models) {
        const underlying = inferUnderlyingProvider(m.id);
        if (!byUnderlying[underlying]) {
          byUnderlying[underlying] = [];
        }
        byUnderlying[underlying].push(m);
      }

      for (const [underlying, underModels] of Object.entries(byUnderlying)) {
        err(`    ${colors.bold}${underlying}${colors.reset} ${colors.dim}(${underModels.length})${colors.reset}`);
        for (const m of underModels) {
          err(`      ${m.id}`);
        }
      }
    }

    // Display OpenCode Zen free tier models as separate section
    if (zenFreeModels.length > 0) {
      err(`\n  ${colors.bold}${colors.cyan}opencode zen free tier${colors.reset} ${colors.dim}(https://opencode.ai/zen/v1/models)${colors.reset}`);
      err(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);
      // Sub-group by underlying provider
      const byUnderlying: Record<string, ModelEntry[]> = {};
      for (const m of zenFreeModels) {
        const underlying = inferUnderlyingProvider(m.id);
        if (!byUnderlying[underlying]) {
          byUnderlying[underlying] = [];
        }
        byUnderlying[underlying].push(m);
      }
      for (const [underlying, underModels] of Object.entries(byUnderlying)) {
        err(`    ${colors.bold}${underlying}${colors.reset} ${colors.dim}(${underModels.length})${colors.reset}`);
        for (const m of underModels) {
          err(`      ${m.id}`);
        }
      }
    }

    err(`\n  ${colors.dim}Total: ${availableModels.length} model(s) compatible with ${activeCli}${colors.reset}`);
    process.exit(0);
  }

  // Load current assignment from agent files, then prefs
  const currentAssignment: Record<QaRole, string> = {} as Record<QaRole, string>;

  // Read actual models from agent files (only from the active CLI's directory)
  for (const role of QA_ROLES) {
    const file = join(REPO_ROOT, agentDir, `${role}.md`);
    if (!existsSync(file)) {
      continue;
    }
    try {
      const content = readFileSync(file, 'utf8');
      const match = content.match(/^model: (.+)$/m);
      if (match) {
        currentAssignment[role] = match[1].trim();
      }
    }
    catch {
      /* skip */
    }
  }

  // Prefs override
  const saved = loadPrefs();
  if (saved) {
    Object.assign(currentAssignment, saved);
  }

  // Validate assigned models against available models
  const availableModelIds = new Set(availableModels.map(m => m.id));
  const orphaned: { role: QaRole, model: string }[] = [];
  for (const role of QA_ROLES) {
    const assigned = currentAssignment[role];
    if (assigned && !availableModelIds.has(assigned)) {
      orphaned.push({ role, model: assigned });
      delete currentAssignment[role];
    }
  }

  if (orphaned.length > 0) {
    log.warn(`Orphaned model(s) — no longer available in ${activeCli}:`);
    for (const o of orphaned) {
      log.warn(`  ${o.role}: ${o.model}`);
    }
    log.info('Re-select them with: bun run harness-config roles');
  }

  // Non-interactive: single role + model
  if (flags.role && flags.model) {
    const role = flags.role;
    if (!QA_ROLES.includes(role)) {
      log.error(`Invalid role: ${role}. Valid: ${QA_ROLES.join(', ')}`);
      process.exit(1);
    }
    const singleAssignment = { [role]: flags.model } as Record<QaRole, string>;
    applyAssignment(singleAssignment, flags.dryRun, true, activeCli);
    savePrefs({ ...currentAssignment, [role]: flags.model });
    log.success(flags.dryRun ? 'Dry run complete.' : 'Assignment saved.');
    process.exit(0);
  }

  // Interactive mode
  if (!process.stdin.isTTY) {
    log.error('Non-TTY detected. Use --role/--model or --list.');
    process.exit(1);
  }

  const newAssignment = await interactiveSelect(availableModels, currentAssignment, flags.dryRun);
  if (newAssignment === '__back') {
    goBackOrExit();
  }
  if (!newAssignment) {
    process.exit(0);
  }

  applyAssignment(newAssignment, flags.dryRun, false, activeCli);
  savePrefs(newAssignment);
  log.success(flags.dryRun ? 'Dry run complete.' : 'Assignments saved.');
}

try {
  if (import.meta.main) {
    void main();
  }
}
catch (error) {
  console.error('Unexpected error:', (error as Error).message);
  process.exit(1);
}
