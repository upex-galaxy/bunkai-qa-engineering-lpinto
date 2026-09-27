#!/usr/bin/env bun
import { clearPreference, generateHarnessConfigs, loadCatalog, resolveProfile } from './harness-config-builder.ts';

const BASE_PROFILE = 'base';

clearPreference();

const catalog = loadCatalog();
const selectedMcps = resolveProfile(BASE_PROFILE, catalog);

generateHarnessConfigs(selectedMcps, catalog, true);

process.exit(0);
