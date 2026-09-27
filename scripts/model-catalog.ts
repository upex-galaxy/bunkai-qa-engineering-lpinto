/**
 * MODEL CATALOG — shared cache I/O for the discovered AI model list.
 *
 * Extracted from qa-model-selector.ts so harness tools (harness-config) read
 * the same `.models.catalog.json` cache without duplicating path/TTL logic.
 * The provider fetch pipeline still lives in qa-model-selector.ts (its owner);
 * this module only reads/writes the cache.
 */

import type { ModelEntry } from './qa-model-parsers.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { log } from './log.ts';

const REPO_ROOT = join(import.meta.dir, '..');

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
      log.dim('Model cache expired — refresh with `bun run harness-config roles --refresh`.');
      return null;
    }
    return data;
  }
  catch {
    return null;
  }
}

export function saveCache(catalog: ModelCatalog): void {
  const cacheFile = getCacheFile();
  const dir = dirname(cacheFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(cacheFile, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}
