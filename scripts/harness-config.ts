#!/usr/bin/env bun
import { join } from 'node:path';
import { select } from '@inquirer/prompts';

// harness-config — umbrella entry point for agent-harness configuration.
//   session -> MCPs + main session model   (gitignored config, regenerated per session)
//   roles   -> per-subagent QA role models (committed agent files)
//   help    -> usage
// The two halves have different lifecycles, so each keeps its own script; this
// dispatcher only routes. `harness-config-default` (direnv) bypasses it entirely
// and never prompts.

const REPO_ROOT = join(import.meta.dir, '..');

const SCRIPTS: Record<string, string> = {
  session: 'harness-config-builder.ts',
  roles: 'qa-model-selector.ts',
};

function printHelp(): void {
  console.log('');
  console.log('harness-config - config del harness de agentes');
  console.log('');
  console.log('Uso:');
  console.log('  bun run harness-config                  # menu (session | roles)');
  console.log('  bun run harness-config session [perfil] # MCPs + modelo principal (por sesion)');
  console.log('  bun run harness-config roles [flags]    # modelos por subagente (committed)');
  console.log('  bun run harness-config help');
  console.log('');
  console.log('Aliases:');
  console.log('  bun run harness-config-default          # session base, no interactivo (direnv)');
  console.log('  bun run qa-role:model:select            # == harness-config roles');
  console.log('');
}

function run(script: string, args: string[]): number {
  const proc = Bun.spawnSync(['bun', join(REPO_ROOT, 'scripts', script), ...args], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  return proc.exitCode ?? 1;
}

async function main(): Promise<number> {
  const [sub, ...rest] = process.argv.slice(2);

  let command = sub;
  if (!command) {
    if (!process.stdin.isTTY) {
      printHelp();
      return 0;
    }
    command = await select({
      message: 'harness-config:',
      loop: false,
      choices: [
        { value: 'session', name: 'session - MCPs + modelo principal (por sesion, gitignored)' },
        { value: 'roles', name: 'roles - modelos por subagente (archivos committed)' },
        { value: '__help', name: 'help' },
      ],
    });
  }

  switch (command) {
    case 'session':
      return run(SCRIPTS.session, rest);
    case 'roles':
      return run(SCRIPTS.roles, rest);
    case 'help':
    case '__help':
    case '-h':
    case '--help':
      printHelp();
      return 0;
    default:
      console.error(`Comando desconocido: ${command}\n`);
      printHelp();
      return 1;
  }
}

process.exit(await main());
