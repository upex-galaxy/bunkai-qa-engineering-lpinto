#!/usr/bin/env bun

const W = 74;
const line = (s: string) => `│${s.padEnd(W)}│`;

console.log('');
console.log(`┌${'─'.repeat(W)}┐`);
console.log(line('  harness-config — config del harness de agentes'));
console.log(`├${'─'.repeat(W)}┤`);
console.log(line('  1. "bun run harness-config"          → menú (session | roles)'));
console.log(line('  2. "bun run harness-config session"  → MCPs + modelo principal (por sesión)'));
console.log(line('  3. "bun run harness-config roles"    → modelos por subagente (committed)'));
console.log(`├${'─'.repeat(W)}┤`);
console.log(line('  session: MCPs por sesión + modelo de IA principal por defecto.'));
console.log(line('           Escribe opencode.jsonc / .mcp.json / .codex/config.toml.'));
console.log(line('  roles:   un modelo por subagente (committed en .opencode/agents/qa-*.md).'));
console.log(line('  Roles: qa-plan, qa-code, qa-review, qa-bulk, qa-write, qa-vision'));
console.log(`└${'─'.repeat(W)}┘`);
console.log('');

process.exit(0);
