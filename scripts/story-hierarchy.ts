#!/usr/bin/env bun

/**
 * story-hierarchy.ts — builds bk-user-stories-hierarchy.html from the synced PBI cache.
 *
 * Renders the full BK traceability tree as a self-contained dark-mode HTML org chart:
 *
 *   Project BK -> product Epics -> User Stories (status / points / module / Jira link)
 *   plus the QA-process Epics (BK-70 / BK-183 / BK-514 / BK-515) and a live
 *   "traceability findings" block (duplicate stories, orphan story folders,
 *   story folders parented under more than one Epic, empty Epics).
 *
 * SOURCES (both written by `bun run jira:sync-issues pull`, both gitignored):
 *   - .context/PBI/epic-tree.md
 *   - .context/PBI/qa-artifacts/_index.md
 *   - .context/PBI/epics/<EPIC>/stories/   (folder keys, only for the findings block)
 *
 * USAGE
 *   bun run hierarchy:build            render only (fast, offline)
 *   bun run hierarchy:refresh          pull from Jira first, then render
 *   bun scripts/story-hierarchy.ts --out <path> [--dry-run]
 *
 * FAILSAFE: an empty parse (0 product Epics or 0 Stories) never overwrites a
 * previously good HTML — the script logs the reason and exits 1 so the daily CI
 * job fails loudly instead of committing a blank diagram.
 *
 * Consumed by .github/workflows/story-hierarchy.yml (daily cron, commits the HTML).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Repo root — this file lives in <root>/scripts/. */
const ROOT = resolve(dirname(import.meta.filename), '..');

const DEFAULT_OUT = join(ROOT, 'bk-user-stories-hierarchy.html');
const TREE_PATH = join(ROOT, '.context/PBI/epic-tree.md');
const QA_INDEX_PATH = join(ROOT, '.context/PBI/qa-artifacts/_index.md');
const EPICS_DIR = join(ROOT, '.context/PBI/epics');

interface Story {
  key: string
  url: string
  title: string
  mod: string
  pts: number
  status: string
}

interface Epic {
  key: string
  url: string
  name: string
  status: string
  declaredStories: number
  points: number
  items: Story[]
}

interface QaEpic {
  key: string
  url: string
  name: string
}

interface Findings {
  duplicates: string[]
  orphans: string[]
  multiParent: string[]
  emptyEpics: string[]
}

const COLORS = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#bc8cff',
  '#39c5cf',
  '#f778ba',
  '#7ee787',
  '#ffa657',
  '#79c0ff',
  '#e3b341',
  '#a5d6ff',
  '#d2a8ff',
  '#9ecbff',
  '#ffd670',
  '#8ddb8c',
  '#ff9bce',
];

const STATUS_COLOR: Record<string, string> = {
  'Backlog': '#8b949e',
  'QA Approved': '#3fb950',
  'Ready For Release': '#2ea043',
  'Ready For QA': '#bc8cff',
  'Ready For Dev': '#39c5cf',
  'In Test': '#d29922',
  'Estimation': '#79c0ff',
  'ABORTED': '#f85149',
  'Planning': '#8b949e',
};

const DEFAULT_STATUS_COLOR = '#8b949e';
const LEGEND_ORDER = [
  'Ready For Release',
  'QA Approved',
  'Ready For QA',
  'In Test',
  'Ready For Dev',
  'Estimation',
  'Backlog',
  'ABORTED',
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `parseLink('[BK-1](https://jira…/BK-1) Title')` -> `{ key, url }`. */
function parseLink(segment: string): { key: string, url: string } | null {
  const match = segment.match(/^\[(BK-\d+)\]\(([^)]+)\)/);
  if (!match) { return null; }
  return { key: match[1], url: match[2] };
}

function parseEpicTree(markdown: string): Epic[] {
  const epics: Epic[] = [];
  let current: Epic | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (.+?) - (.+)$/);
    if (heading) {
      const link = parseLink(heading[1]);
      if (link) {
        current = {
          key: link.key,
          url: link.url,
          name: heading[2].trim(),
          status: '',
          declaredStories: 0,
          points: 0,
          items: [],
        };
        epics.push(current);
        continue;
      }
    }
    if (!current) { continue; }

    const meta = line.match(/^\*\*Status:\*\* (.+?) \| \*\*Stories:\*\* (\d+) \| \*\*Points:\*\* (-?\d+)/);
    if (meta) {
      current.status = meta[1];
      current.declaredStories = Number.parseInt(meta[2], 10);
      current.points = Number.parseInt(meta[3], 10);
      continue;
    }

    if (!line.startsWith('- ')) { continue; }
    const link = parseLink(line.slice(2));
    if (!link) { continue; }
    const rest = line.slice(2).replace(/^\[[^\]]+\]\([^)]+\)\s*/, '').trim();
    const pointsMatch = rest.match(/^(.*?) _\((-|\d+) pts?, ([^)]+)\)_$/);
    if (!pointsMatch) { continue; }

    let title = pointsMatch[1].replace(/^🚀\s*/, '').trim();
    let mod = '';
    const splitAt = title.indexOf(' | ');
    if (splitAt > -1) {
      mod = title.slice(0, splitAt);
      title = title.slice(splitAt + 3);
    }
    current.items.push({
      key: link.key,
      url: link.url,
      title,
      mod,
      pts: pointsMatch[2] === '-' ? 0 : Number.parseInt(pointsMatch[2], 10),
      status: pointsMatch[3].trim(),
    });
  }

  return epics;
}

function parseQaIndex(markdown: string): QaEpic[] {
  const epics: QaEpic[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const row = line.match(/^\| (.+?) \| (.+?) \|/);
    if (!row || row[1].startsWith('---') || row[1].toLowerCase().startsWith('key')) { continue; }
    const link = parseLink(row[1]);
    if (link) { epics.push({ key: link.key, url: link.url, name: row[2].trim() }); }
  }
  return epics;
}

/** Keys of every local STORY folder, mapped to the Epics that hold them. */
function localStoryParents(): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  if (!existsSync(EPICS_DIR)) { return parents; }
  for (const epicDir of readdirSync(EPICS_DIR)) {
    const storiesDir = join(EPICS_DIR, epicDir, 'stories');
    if (!existsSync(storiesDir)) { continue; }
    for (const folder of readdirSync(storiesDir)) {
      const match = folder.match(/^STORY-(BK-\d+)/);
      if (!match) { continue; }
      const bucket = parents.get(match[1]) ?? [];
      bucket.push(epicDir);
      parents.set(match[1], bucket);
    }
  }
  return parents;
}

function findFindings(epics: Epic[]): Findings {
  const seen = new Map<string, string[]>();
  const duplicates: string[] = [];
  for (const epic of epics) {
    for (const story of epic.items) {
      const norm = `${story.title.toLowerCase()}|${story.pts}`;
      const owners = seen.get(norm) ?? [];
      if (owners.length > 0) {
        duplicates.push(`"<b>${escapeHtml(story.title)}</b>" aparece en ${[...owners, `${epic.key}/${story.key}`].join(' y ')}`);
      }
      owners.push(`${epic.key}/${story.key}`);
      seen.set(norm, owners);
    }
  }

  const orphans: string[] = [];
  const multiParent: string[] = [];
  const inTree = new Set(epics.flatMap(epic => epic.items.map(story => story.key)));
  for (const [key, parents] of localStoryParents()) {
    if (!inTree.has(key)) { orphans.push(`<code>${key}</code> existe como carpeta local (${parents.join(', ')}) pero no figura en el árbol sincronizado`); }
    if (parents.length > 1) { multiParent.push(`<code>${key}</code> tiene carpeta bajo ${parents.join(' y ')}`); }
  }

  const emptyEpics = epics
    .filter(epic => epic.items.length === 0)
    .map(epic => `<code>${epic.key}</code> (${escapeHtml(epic.name)}) tiene 0 user stories`);

  return { duplicates, orphans, multiParent, emptyEpics };
}

function renderStory(story: Story): string {
  const color = STATUS_COLOR[story.status] ?? DEFAULT_STATUS_COLOR;
  const mod = story.mod ? `<span class="mod">${escapeHtml(story.mod)}</span>` : '';
  const points = story.pts > 0 ? `${story.pts} pts` : '— pts';
  return `<a class="story" style="--st:${color}" href="${story.url}" target="_blank" rel="noopener">
        <div class="s-top"><span class="key">${story.key}</span>${mod}</div>
        <div class="s-title">${escapeHtml(story.title)}</div>
        <div class="s-foot"><span class="pts">${points}</span><span class="st" style="color:${color}">${story.status}</span></div>
      </a>`;
}

function renderEpic(epic: Epic, index: number): string {
  const accent = COLORS[index % COLORS.length];
  const children = epic.items.length
    ? epic.items.map(renderStory).join('\n          ')
    : '<div class="empty">Sin user stories vinculadas</div>';
  return `<section class="epic" style="--acc:${accent}">
        <header class="e-head">
          <div class="e-top"><a class="key" href="${epic.url}" target="_blank" rel="noopener">${epic.key}</a><span class="badge">${escapeHtml(epic.status || '—')}</span></div>
          <h3>${escapeHtml(epic.name)}</h3>
          <div class="e-meta"><span>${epic.items.length} stories</span><span>${epic.points} pts</span></div>
        </header>
        <div class="stories">
          ${children}
        </div>
      </section>`;
}

function renderQaEpic(epic: QaEpic, index: number): string {
  const accent = COLORS[(index + 6) % COLORS.length];
  return `<section class="epic" style="--acc:${accent}">
        <header class="e-head">
          <div class="e-top"><a class="key" href="${epic.url}" target="_blank" rel="noopener">${epic.key}</a><span class="badge">QA</span></div>
          <h3>${escapeHtml(epic.name)}</h3>
          <div class="e-meta"><span>0 stories espejadas</span></div>
        </header>
        <div class="stories"><div class="empty">El contenido vive bajo cada artefacto, no en .context/PBI/</div></div>
      </section>`;
}

function renderFindings(findings: Findings): string {
  const rows = [
    ...findings.duplicates.map(text => `<b>Duplicada en Jira</b>: ${text}`),
    ...findings.orphans.map(text => `<b>Carpeta local huérfana</b>: ${text}`),
    ...findings.multiParent.map(text => `<b>Carpeta mal padreada</b>: ${text}`),
    ...findings.emptyEpics.map(text => `<b>Épica vacía</b>: ${text}`),
  ];
  if (rows.length === 0) {
    return `<section class="notes">
  <h2>Hallazgos de trazabilidad</h2>
  <ul>
    <li>Sin hallazgos: las stories del caché local y el árbol sincronizado coinciden.</li>
  </ul>
</section>`;
  }
  return `<section class="notes">
  <h2>Hallazgos de trazabilidad (${rows.length})</h2>
  <ul>
${rows.map(row => `    <li>${row}</li>`).join('\n')}
  </ul>
</section>`;
}

function renderLegend(statusCount: Record<string, number>): string {
  return LEGEND_ORDER
    .filter(status => statusCount[status])
    .map(status => `<span class="chip" style="--st:${STATUS_COLOR[status] ?? DEFAULT_STATUS_COLOR}"><i></i>${status}<b>${statusCount[status]}</b></span>`)
    .join('');
}

function buildHtml(epics: Epic[], qaEpics: QaEpic[], syncedOn: string): string {
  const totalStories = epics.reduce((sum, epic) => sum + epic.items.length, 0);
  const totalPoints = epics.reduce((sum, epic) => sum + epic.points, 0);
  const statusCount: Record<string, number> = {};
  for (const epic of epics) {
    for (const story of epic.items) {
      statusCount[story.status] = (statusCount[story.status] ?? 0) + 1;
    }
  }
  const findings = findFindings(epics);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BK · Jerarquía de User Stories</title>
<style>
  :root{
    --bg:#0b0f14; --panel:#11161d; --card:#161b22; --card2:#1b2129;
    --line:#30363d; --txt:#e6edf3; --dim:#9aa4b1; --mut:#6e7681;
    --acc:#58a6ff;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background:radial-gradient(1200px 600px at 50% -10%, #131a24 0%, var(--bg) 60%);
    color:var(--txt);
    font:14px/1.45 "Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
    padding-bottom:64px;
  }
  a{color:inherit;text-decoration:none}
  .head{max-width:1180px;margin:0 auto;padding:36px 24px 8px}
  h1{margin:0 0 6px;font-size:26px;letter-spacing:-.3px}
  h1 span{color:var(--acc)}
  .sub{margin:0;color:var(--dim);font-size:13.5px}
  .stats{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 14px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:132px}
  .stat b{display:block;font-size:20px;line-height:1.2}
  .stat span{color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.6px}
  .legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px;padding-top:14px;border-top:1px solid var(--line)}
  .legend .lbl{color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;margin-right:4px}
  .chip{display:inline-flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:12.5px;color:var(--dim)}
  .chip i{width:9px;height:9px;border-radius:50%;background:var(--st);box-shadow:0 0 8px color-mix(in srgb,var(--st) 60%, transparent)}
  .chip b{color:var(--txt);background:#21262d;border-radius:6px;padding:1px 6px;font-size:11.5px}

  .scrollhint{max-width:1180px;margin:18px auto 0;padding:0 24px;color:var(--mut);font-size:12.5px;display:flex;gap:8px;align-items:center}
  .scrollhint kbd{background:#21262d;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:1px 6px;font:11.5px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dim)}

  .scroll{overflow-x:auto;overflow-y:visible;padding:26px 0 8px}
  .scroll::-webkit-scrollbar{height:14px}
  .scroll::-webkit-scrollbar-track{background:#0e1319}
  .scroll::-webkit-scrollbar-thumb{background:#30363d;border-radius:8px;border:3px solid #0e1319}
  .scroll::-webkit-scrollbar-thumb:hover{background:#484f58}
  .canvas{width:max-content;margin:0 auto;padding:0 48px 24px}

  .tree{display:flex;flex-direction:column}
  .tree.center{align-items:center}
  .tree.left{align-items:flex-start}
  .rootbox{width:300px;text-align:center;flex:none}
  .root{display:inline-block;background:linear-gradient(180deg,#1c2430,#151b23);border:1px solid #3d4753;border-radius:12px;padding:12px 22px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
  .root b{display:block;font-size:17px;letter-spacing:.4px}
  .root span{display:block;color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.8px;margin-top:2px}
  .root.qa{border-color:#4b3a1f;background:linear-gradient(180deg,#241d12,#1a1610)}
  .stem{width:2px;height:30px;margin:0 auto;background:var(--line)}
  .wrap{position:relative;padding-top:34px}
  .bus{position:absolute;top:0;left:150px;right:150px;height:2px;background:var(--line)}
  .row{display:flex;gap:40px;align-items:flex-start}

  .epic{width:300px;flex:none;position:relative}
  .epic::before{content:"";position:absolute;top:-34px;left:50%;width:2px;height:34px;background:linear-gradient(180deg,var(--line),var(--acc))}
  .e-head{background:linear-gradient(180deg,#171d26,#131920);border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:10px 10px 0 0;padding:11px 13px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  .e-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px}
  .key{font:600 12.5px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--acc);letter-spacing:.3px}
  a.key:hover{text-decoration:underline}
  .badge{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);border:1px solid var(--line);background:#0f141a;border-radius:999px;padding:2px 8px}
  .e-head h3{margin:0;font-size:14.5px;line-height:1.3;font-weight:600}
  .e-meta{display:flex;gap:12px;margin-top:8px;font-size:11.5px;color:var(--mut)}
  .e-meta span{background:#0f141a;border:1px solid var(--line);border-radius:6px;padding:2px 7px}
  .stories{display:flex;flex-direction:column;gap:8px;padding-top:8px}
  .story{display:block;background:var(--card);border:1px solid var(--line);border-left:3px solid color-mix(in srgb,var(--st) 65%, #1b2129);border-radius:8px;padding:9px 11px;transition:border-color .12s,transform .12s,background .12s}
  .story:hover{background:var(--card2);border-color:color-mix(in srgb,var(--st) 55%, var(--line));transform:translateX(2px)}
  .s-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .mod{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);background:#0f141a;border:1px solid var(--line);border-radius:5px;padding:1px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
  .s-title{margin-top:5px;font-size:13px;line-height:1.35;color:#d7dde4}
  .s-foot{display:flex;justify-content:space-between;align-items:center;margin-top:7px;font-size:11.5px}
  .pts{color:var(--mut);font:600 11.5px ui-monospace,SFMono-Regular,Consolas,monospace}
  .st{font-weight:600}
  .empty{border:1px dashed var(--line);border-radius:8px;padding:14px 12px;text-align:center;color:var(--mut);font-size:12.5px;background:#0e1319}

  .sec-title{max-width:1180px;margin:46px auto 0;padding:0 24px}
  .sec-title h2{margin:0 0 4px;font-size:18px}
  .sec-title p{margin:0;color:var(--mut);font-size:13px}

  .notes{max-width:1180px;margin:44px auto 0;padding:0 24px}
  .notes h2{font-size:18px;margin:0 0 12px}
  .notes ul{margin:0;padding:0;list-style:none;display:grid;gap:9px}
  .notes li{background:var(--panel);border:1px solid var(--line);border-left:3px solid #d29922;border-radius:8px;padding:11px 14px;font-size:13.5px;color:#cdd5dd;line-height:1.5}
  .notes code{font:12.5px ui-monospace,SFMono-Regular,Consolas,monospace;background:#0f141a;border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:#9ecbff}
  .foot{max-width:1180px;margin:34px auto 0;padding:16px 24px 0;border-top:1px solid var(--line);color:var(--mut);font-size:12.5px}
  @media (max-width:760px){ .head,.notes,.sec-title,.scrollhint,.foot{padding-left:16px;padding-right:16px} }
</style>
</head>
<body>

<header class="head">
  <h1>BK · Jerarquía de <span>User Stories</span> y trazabilidad</h1>
  <p class="sub">Proyecto BK → Épicas → User Stories. Cada tarjeta enlaca a su ticket en Jira. Fuente: <code style="font-family:ui-monospace,Consolas,monospace;color:#9ecbff">.context/PBI/epic-tree.md</code> (sincronizado ${syncedOn}).</p>
  <div class="stats">
    <div class="stat"><b>${epics.length}</b><span>Épicas de producto</span></div>
    <div class="stat"><b>${totalStories}</b><span>User stories</span></div>
    <div class="stat"><b>${totalPoints}</b><span>Story points</span></div>
    <div class="stat"><b>${qaEpics.length}</b><span>Épicas de proceso QA</span></div>
    <div class="stat"><b>${Object.keys(statusCount).length}</b><span>Estados en uso</span></div>
  </div>
  <div class="legend"><span class="lbl">Estados de story</span>${renderLegend(statusCount)}</div>
</header>

<div class="scrollhint"><kbd>↔</kbd> Desplaza la barra horizontal para recorrer las ${epics.length} épicas · <kbd>rueda</kbd> para bajar por las stories</div>

<div class="scroll">
  <div class="canvas">
    <div class="tree center">
      <div class="rootbox"><div class="root"><b>BK</b><span>Proyecto · TMS</span></div><div class="stem"></div></div>
      <div class="wrap">
        <div class="bus"></div>
        <div class="row">
${epics.map(renderEpic).join('\n')}
        </div>
      </div>
    </div>
  </div>
</div>

<div class="sec-title">
  <h2>Épicas de proceso QA (trazabilidad de artefactos)</h2>
  <p>No contienen producto: alojan el repositorio de tests, la gestión de defectos, el master test plan y los artefactos de ejecución.</p>
</div>

<div class="scroll">
  <div class="canvas">
    <div class="tree left">
      <div class="rootbox"><div class="root qa"><b>QA</b><span>Artefactos y proceso</span></div><div class="stem"></div></div>
      <div class="wrap">
        <div class="bus"></div>
        <div class="row">
${qaEpics.map(renderQaEpic).join('\n')}
        </div>
      </div>
    </div>
  </div>
</div>

${renderFindings(findings)}

<div class="foot">Generado desde .context/PBI/epic-tree.md + qa-artifacts/_index.md · ${epics.length} épicas · ${totalStories} user stories · ${totalPoints} pts</div>

</body>
</html>
`;
}

function pullFromJira(): boolean {
  const bun = process.execPath;
  console.log('[story-hierarchy] pulling Jira -> .context/PBI …');
  const result = spawnSync(bun, ['run', 'jira:sync-issues', 'pull'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[story-hierarchy] jira:sync-issues pull failed (exit ${result.status ?? 'signal'})`);
    return false;
  }
  return true;
}

function parseArgs(argv: string[]): { out: string, dryRun: boolean, sync: boolean } {
  let out = DEFAULT_OUT;
  let dryRun = false;
  let sync = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) { throw new Error('--out requires a path'); }
      out = resolve(ROOT, value);
    }
    else if (arg === '--dry-run') { dryRun = true; }
    else if (arg === '--sync') { sync = true; }
    else { throw new Error(`unknown argument: ${arg}`); }
  }
  return { out, dryRun, sync };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.sync && !pullFromJira()) { process.exit(1); }

  if (!existsSync(TREE_PATH)) {
    console.error(`[story-hierarchy] missing ${TREE_PATH} — run \`bun run jira:sync-issues pull\` first`);
    process.exit(1);
  }

  const epics = parseEpicTree(readFileSync(TREE_PATH, 'utf8'));
  const qaEpics = existsSync(QA_INDEX_PATH) ? parseQaIndex(readFileSync(QA_INDEX_PATH, 'utf8')) : [];
  const totalStories = epics.reduce((sum, epic) => sum + epic.items.length, 0);

  if (epics.length === 0 || totalStories === 0) {
    console.error(`[story-hierarchy] refusing to write: parsed ${epics.length} épicas / ${totalStories} stories — keeping the previous HTML`);
    process.exit(1);
  }

  const syncedOn = statSync(TREE_PATH).mtime.toISOString().slice(0, 10);
  const html = buildHtml(epics, qaEpics, syncedOn);

  if (args.dryRun) {
    console.log(`[story-hierarchy] dry-run: would write ${args.out} (${(html.length / 1024).toFixed(1)} KB)`);
    return;
  }

  writeFileSync(args.out, html, 'utf8');
  console.log(`[story-hierarchy] wrote ${args.out} (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`[story-hierarchy] épicas=${epics.length} stories=${totalStories} pts=${epics.reduce((sum, epic) => sum + epic.points, 0)} qa-épicas=${qaEpics.length} sync=${syncedOn}`);
}

main();
