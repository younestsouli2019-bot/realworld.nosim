import fs from 'fs';
import path from 'path';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return v == null ? fallback : String(v).trim();
}

function buildRawUrl(ownerRepo, branch, filePath) {
  return `https://raw.githubusercontent.com/${ownerRepo}/${branch}/${filePath}`;
}

async function download(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed (${res.status}): ${text}`);
  }
  return await res.text();
}

export async function installAbility({ name, ownerRepo, branch = 'main', repoPath, destDir } = {}) {
  if (!name) throw new Error('Missing ability name');
  if (!ownerRepo) throw new Error('Missing owner/repo');
  if (!repoPath) throw new Error('Missing repoPath');
  const root = process.cwd();
  const abilitiesDir = destDir ? path.resolve(destDir) : path.join(root, 'abilities');
  ensureDir(abilitiesDir);
  const targetPath = path.join(abilitiesDir, `${name}.mjs`);
  const token = getEnv('GITHUB_TOKEN', '');
  const headers = token ? { Authorization: `token ${token}` } : {};
  const url = buildRawUrl(ownerRepo, branch, repoPath);
  const content = await download(url, headers);
  fs.writeFileSync(targetPath, content);
  return { ok: true, path: targetPath };
}

export async function loadAbility(name, baseDir) {
  const root = process.cwd();
  const abilitiesDir = baseDir ? path.resolve(baseDir) : path.join(root, 'abilities');
  const targetPath = path.join(abilitiesDir, `${name}.mjs`);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Ability not installed: ${name}`);
  }
  const module = await import(pathToFileURL(targetPath).href);
  return module;
}

function pathToFileURL(p) {
  const url = new URL('file://');
  const full = path.resolve(p);
  const parts = full.split(path.sep);
  url.pathname = '/' + parts.map(encodeURIComponent).join('/');
  return url;
}
