/**
 * MODEL CATALOG — shared cache I/O for the discovered AI model list.
 *
 * harness-manager fetches the provider catalogs on Re-scan and writes
 * `<root>/.models.catalog.json`; this module is the harness-side READ path
 * (the loader degrades gracefully when the file is missing/stale). It also
 * owns the ModelEntry shape plus the pure provider-inference helpers the
 * picker and `--list` display use for grouping. No fetching lives here.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './log.ts';

const REPO_ROOT = join(import.meta.dir, '..');

export interface ModelEntry {
  id: string
  name: string
  provider: string
  source: string
  capabilities: string[]
}

export interface ModelCatalog {
  models: ModelEntry[]
  fetchedAt: number
  sources: string[]
}

function getCacheFile(): string {
  const file = process.env.MODELS_CACHE_FILE;
  if (file) {
    return join(REPO_ROOT, file);
  }
  return join(REPO_ROOT, '.models.catalog.json');
}

function getCacheTtl(): number {
  const ttl = process.env.MODELS_CACHE_TTL;
  return ttl ? Number.parseInt(ttl, 10) * 1000 : 86400 * 1000; // 24h default
}

/**
 * Read the cached model catalog. Returns null when the file is missing,
 * unreadable, or older than MODELS_CACHE_TTL — callers treat null as
 * "no fresh catalog" and skip model-dependent features.
 */
export function loadCache(): ModelCatalog | null {
  const cacheFile = getCacheFile();
  if (!existsSync(cacheFile)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(cacheFile, 'utf8')) as ModelCatalog;
    const age = Date.now() - data.fetchedAt;
    if (age > getCacheTtl()) {
      log.dim('Model catalog expired — run a Re-scan in harness-manager to refresh `.models.catalog.json`.');
      return null;
    }
    return data;
  }
  catch {
    return null;
  }
}

/**
 * Resolve the underlying model vendor regardless of which provider prefix an
 * id carries (opencode/claude-…, anthropic/claude-…, openai/gpt-…, etc.).
 */
export function inferUnderlyingProvider(modelId: string): string {
  const id = modelId.replace(/^(?:opencode-go|opencode|openai|google|anthropic|deepseek|kimi)\//, '');
  if (id.startsWith('claude') || id.startsWith('sonnet') || id.startsWith('opus') || id.startsWith('haiku')) {
    return 'anthropic';
  }
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('codex')) {
    return 'openai';
  }
  if (id.startsWith('gemini')) {
    return 'google';
  }
  if (id.startsWith('deepseek')) {
    return 'deepseek';
  }
  if (id.startsWith('glm')) {
    return 'zhipu';
  }
  if (id.startsWith('kimi')) {
    return 'moonshot';
  }
  if (id.startsWith('qwen')) {
    return 'alibaba';
  }
  if (id.startsWith('grok')) {
    return 'xai';
  }
  if (id.startsWith('minimax')) {
    return 'minimax';
  }
  if (id.startsWith('nemotron')) {
    return 'nvidia';
  }
  if (id.startsWith('mimo') || id.startsWith('muse') || id.startsWith('ling') || id.startsWith('big-pickle')) {
    return 'opencode';
  }
  if (id.startsWith('hy') || id.startsWith('omen') || id.startsWith('longcat')) {
    return 'opencode';
  }
  return 'other';
}

/**
 * Identify the provider from an endpoint URL. Pure URL matching, plus a hint
 * for a custom OpenAI-compatible base (OPENAI_API_BASE proxy).
 */
export function detectProvider(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('opencode.ai/zen/go')) {
    return 'opencode-go';
  }
  if (lower.includes('opencode.ai/zen') || lower.includes('opencode')) {
    return 'opencode';
  }
  if (lower.includes('generativelanguage.googleapis.com') || lower.includes('google')) {
    return 'google';
  }
  if (lower.includes('api.anthropic.com')) {
    return 'anthropic';
  }
  if (lower.includes('api.openai.com')) {
    return 'openai-direct';
  }
  const openaiBase = process.env.OPENAI_API_BASE;
  if (openaiBase && lower.startsWith(openaiBase.toLowerCase())) {
    return 'openai-direct';
  }
  if (lower.includes('api.deepseek.com')) {
    return 'deepseek';
  }
  if (lower.includes('api.moonshot.cn')) {
    return 'kimi';
  }
  if (lower.includes('openai')) {
    return 'openai';
  }
  return 'custom';
}
