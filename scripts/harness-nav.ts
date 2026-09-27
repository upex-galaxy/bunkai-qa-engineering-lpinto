/**
 * Shared navigation contract between the harness-config dispatcher and its
 * sub-tools.
 *
 * When a sub-tool's menu offers "← volver", it calls goBackOrExit():
 *   - if launched by the dispatcher (PARENT_ENV set) it exits with GO_BACK_CODE
 *     so the dispatcher re-opens its menu;
 *   - if launched directly, it cancels cleanly.
 */

/** Exit code a sub-tool returns to ask the dispatcher to re-open its menu. */
export const GO_BACK_CODE = 3;

/** Set by the dispatcher on the child env so the child knows a parent menu exists. */
export const PARENT_ENV = 'HARNESS_CONFIG_PARENT';

export function goBackOrExit(): never {
  if (process.env[PARENT_ENV]) {
    process.exit(GO_BACK_CODE);
  }
  console.log('Cancelado.');
  process.exit(0);
}
