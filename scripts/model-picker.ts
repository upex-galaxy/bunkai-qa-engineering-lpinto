/**
 * Shared interactive model picker.
 *
 * Extracted from qa-model-selector.ts so both halves of harness-config (the
 * session main model + the per-role subagent models) present the SAME
 * searchable, grouped selection UI instead of two divergent ones.
 */

import type { ModelEntry } from './qa-model-parsers.ts';
import { input, select, Separator } from '@inquirer/prompts';
import { log } from './log.ts';
import { detectProvider, inferUnderlyingProvider } from './qa-model-parsers.ts';

export interface SelectModelOptions {
  /** What is being chosen — used in the prompts (a role id, or "session model"). */
  subject: string
  /** Optional description appended to the picker title. */
  hint?: string
  /** Label for the cancel/back entry. Defaults to "← back". */
  backLabel?: string
}

/**
 * Interactive, searchable model selector. Returns the chosen model id, or
 * null when the user picks the back/cancel entry.
 */
export async function selectModel(
  models: ModelEntry[],
  currentModel: string | null,
  opts: SelectModelOptions,
): Promise<string | null> {
  const { subject, hint, backLabel = '← back' } = opts;
  const title = hint ? `Model for ${subject} — ${hint}` : `Model for ${subject}`;

  // Separate free tier models from paid models
  const zenFreeModels: ModelEntry[] = [];
  const paidModels: ModelEntry[] = [];
  for (const m of models) {
    if (m.source === 'https://opencode.ai/zen/v1/models' && m.id.endsWith('-free')) {
      zenFreeModels.push(m);
    }
    else {
      paidModels.push(m);
    }
  }

  // Loop to allow searching again
  while (true) {
    log.dim(`  ${models.length} models available. Type to filter, or press Enter to see all.\n`);
    const filter = await input({
      message: `Search models for ${subject} (e.g. "gemini", "claude", "gpt")`,
    });
    const filterLower = filter.trim().toLowerCase();

    // Search in model ID and name only (not provider, which groups unrelated models)
    const filterModel = (m: ModelEntry): boolean => {
      if (!filterLower) { return true; }
      const searchStr = `${m.id} ${m.name || ''}`.toLowerCase();
      return filterLower.split(/\s+/).every((term) => {
        // Match whole words (surrounded by word boundaries or separators)
        const regex = new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, 'i');
        return regex.test(searchStr);
      });
    };

    const filteredZenFreeModels = zenFreeModels.filter(filterModel);
    const filteredPaidModels = paidModels.filter(filterModel);

    // Re-group filtered paid models by endpoint, then by underlying provider
    const filteredByEndpoint: Record<string, Record<string, ModelEntry[]>> = {};
    for (const m of filteredPaidModels) {
      const endpoint = m.source || 'unknown';
      if (!filteredByEndpoint[endpoint]) {
        filteredByEndpoint[endpoint] = {};
      }
      const underlying = inferUnderlyingProvider(m.id);
      if (!filteredByEndpoint[endpoint][underlying]) {
        filteredByEndpoint[endpoint][underlying] = [];
      }
      filteredByEndpoint[endpoint][underlying].push(m);
    }

    // Build choices with free tier first, then paid models
    const choices: (string | { value: string, name: string } | Separator)[] = [];

    // Add "back" option at the top
    choices.push({ value: '__back', name: backLabel });
    choices.push(new Separator());

    // Free tier section (at the top)
    if (filteredZenFreeModels.length > 0) {
      choices.push(new Separator(`─ opencode zen free tier (${filteredZenFreeModels.length}) ─`));
      const byUnderlying: Record<string, ModelEntry[]> = {};
      for (const m of filteredZenFreeModels) {
        const underlying = inferUnderlyingProvider(m.id);
        if (!byUnderlying[underlying]) {
          byUnderlying[underlying] = [];
        }
        byUnderlying[underlying].push(m);
      }
      for (const [underlying, underModels] of Object.entries(byUnderlying)) {
        choices.push(new Separator(`  ${underlying}`));
        for (const m of underModels) {
          const marker = m.id === currentModel ? ' (current)' : '';
          choices.push({
            value: m.id,
            name: `    ${m.name || m.id}${marker}`,
          });
        }
      }
    }

    // Paid models by endpoint
    for (const [endpoint, providers] of Object.entries(filteredByEndpoint)) {
      const endpointName = detectProvider(endpoint);
      const displayName = endpointName === 'opencode' ? 'opencode zen' : endpointName;
      // Mask API keys in endpoint URL for security
      const maskedEndpoint = endpoint.replace(/([?&]key=)[^&]+/, '$1***');
      const totalCount = Object.values(providers).reduce((sum, arr) => sum + arr.length, 0);
      choices.push(new Separator(`─ ${displayName} (${totalCount}) ${maskedEndpoint} ─`));
      for (const [underlying, underModels] of Object.entries(providers)) {
        choices.push(new Separator(`  ${underlying}`));
        for (const m of underModels) {
          const marker = m.id === currentModel ? ' (current)' : '';
          choices.push({
            value: m.id,
            name: `    ${m.name || m.id}${marker}`,
          });
        }
      }
    }

    // Check if we have any results (model choices, not nav separators)
    const hasResults = filteredZenFreeModels.length > 0 || filteredPaidModels.length > 0;
    if (!hasResults) {
      log.warn(`No models matching "${filter.trim()}". Showing all models.`);
      continue;
    }

    const result = await select({
      message: title,
      // eslint-disable-next-line ts/no-explicit-any
      choices: choices as any[],
      loop: false,
    });

    // If user wants to go back, return null
    if (result === '__back') {
      return null;
    }

    return result;
  }
}
