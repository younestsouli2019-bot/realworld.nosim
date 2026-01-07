import fs from 'fs';
import path from 'path';
import '../src/load-env.mjs';
import { installAbility } from '../src/swarm/ability-fetcher.mjs';

function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === ',') {
      out.push(field);
      field = '';
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    field += ch;
  }
  out.push(field);
  return out;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = cols[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function findAgentCsvCandidates(root) {
  const candidates = [];
  const names = fs.readdirSync(root);
  for (const n of names) {
    const lower = n.toLowerCase();
    if (lower.startsWith('agent_export') && lower.endsWith('.csv')) {
      candidates.push(path.join(root, n));
    }
  }
  const archive = path.join(root, 'archive');
  if (fs.existsSync(archive)) {
    for (const n of fs.readdirSync(archive)) {
      const lower = n.toLowerCase();
      if (lower.startsWith('agent_export') && lower.endsWith('.csv')) {
        candidates.push(path.join(archive, n));
      }
    }
  }
  return candidates;
}

function getDefaultAbilities() {
  const env = process.env.ABILITIES_DEFAULT_JSON || '';
  try {
    const parsed = JSON.parse(env);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [
    { name: 'rail_optimizer', repo: 'Base44AI/rank', path: 'abilities/rail_optimizer.mjs', branch: 'main' }
  ];
}

async function installDefaults(report) {
  const defaults = getDefaultAbilities();
  const installed = [];
  for (const a of defaults) {
    try {
      const res = await installAbility({ name: a.name, ownerRepo: a.repo, branch: a.branch || 'main', repoPath: a.path });
      installed.push({ name: a.name, path: res.path });
    } catch (e) {
      report.errors.push({ ability: a.name, error: e.message });
    }
  }
  return installed;
}

async function main() {
  const root = process.cwd();
  const arg = process.argv.find(a => a.startsWith('--csv='));
  const explicitCsv = arg ? arg.split('=')[1] : null;
  const report = { ok: true, csv: null, agents_processed: 0, upgrades: [], installed_abilities: [], errors: [] };
  let csvPath = explicitCsv;
  if (!csvPath) {
    const found = findAgentCsvCandidates(root);
    if (found.length === 0) {
      process.stdout.write(JSON.stringify({ ok: false, error: 'csv_not_found', candidates: [] }) + '\n');
      process.exit(2);
    }
    csvPath = found[0];
  }
  report.csv = csvPath;
  const rows = readCsv(csvPath);
  report.agents_processed = rows.length;
  const defaultsInstalled = await installDefaults(report);
  report.installed_abilities = defaultsInstalled;
  const upgrades = rows.map(r => ({
    agent_id: r.id || r.agent_id || '',
    agent_name: r.name || r.agent_name || '',
    status: 'upgraded_defaults'
  }));
  report.upgrades = upgrades;
  const outDir = path.join(root, 'exports', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `agent_upgrade_report_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ ok: true, report_path: outPath, summary: { agents: report.agents_processed, abilities: report.installed_abilities.length } }) + '\n');
}

main().catch(e => {
  process.stderr.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
  process.exitCode = 1;
});
