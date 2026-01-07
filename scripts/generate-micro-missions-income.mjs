import fs from 'fs';
import path from 'path';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonCell(obj) {
  try {
    return csvEscape(JSON.stringify(obj ?? {}));
  } catch {
    return csvEscape('{}');
  }
}

async function main() {
  const root = process.cwd();
  const historicDir = path.join(root, 'reports', 'historic');
  const sourcePath = path.join(historicDir, 'restored-missions.json');
  const outPath = path.join(historicDir, 'micro_missions_income.csv');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source not found: ${path.relative(root, sourcePath)}`);
  }

  const missions = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(missions) || missions.length === 0) {
    throw new Error('restored-missions.json is empty or not an array');
  }

  const headers = [
    'id',
    'title',
    'type',
    'status',
    'priority',
    'assigned_agent_ids',
    'mission_parameters',
    'progress_data',
    'estimated_duration_hours',
    'actual_duration_hours',
    'deadline',
    'completion_notes',
    'revenue_generated',
    'created_date',
    'updated_date',
    'created_by_id',
    'created_by',
    'is_sample'
  ];

  const now = new Date().toISOString();
  const rows = [headers.join(',')];

  for (const m of missions) {
    const assignedAgents = csvEscape('[]');
    const params = jsonCell(m.parameters);
    const progress = jsonCell({});
    const estimated = '';
    const actual = '';
    const deadline = '';
    const completion = '';
    const revenue = '0';
    const created = csvEscape(now);
    const updated = csvEscape(now);
    const createdById = '';
    const createdBy = '';

    const row = [
      csvEscape(m.id),
      csvEscape(m.title),
      csvEscape('operations'),
      csvEscape('active'),
      csvEscape(m.priority ?? ''),
      assignedAgents,
      params,
      progress,
      estimated,
      actual,
      deadline,
      completion,
      revenue,
      created,
      updated,
      createdById,
      createdBy,
      String(!!m.is_sample)
    ].join(',');
    rows.push(row);
  }

  fs.writeFileSync(outPath, rows.join('\n'));
  console.log(`✅ Generated ${missions.length} rows -> ${path.relative(root, outPath)}`);
}

main().catch((e) => {
  console.error('❌ Generation failed:', e.message);
  process.exit(1);
});
