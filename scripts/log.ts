/**
 * Shared console logger + ANSI colors for CLI scripts.
 *
 * Extracted from qa-model-selector.ts so model-catalog.ts and harness-config
 * share one output style instead of duplicating the same helpers.
 */

export const colors = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  cyan: '\x1B[36m',
};

export function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

export function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

export const log = {
  info: (msg: string) => err(`${colors.blue}i${colors.reset} ${msg}`),
  success: (msg: string) => err(`${colors.green}+${colors.reset} ${msg}`),
  warn: (msg: string) => err(`${colors.yellow}!${colors.reset} ${msg}`),
  error: (msg: string) => err(`${colors.red}x${colors.reset} ${msg}`),
  dim: (msg: string) => err(`${colors.dim}${msg}${colors.reset}`),
  header: (msg: string) => err(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
};
