import '../src/load-env.mjs';

const token = process.env.GITHUB_TOKEN || '';
const owner = process.env.GITHUB_REPO_OWNER || '';
const repo = process.env.GITHUB_REPO_NAME || '';

function hasCreds() {
  return token.trim() && owner.trim() && repo.trim();
}

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  return await res.json();
}

async function main() {
  if (!hasCreds()) {
    console.log(JSON.stringify({ ok: false, error: 'missing_env', required: ['GITHUB_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME'] }, null, 2));
    process.exit(1);
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const views = await get(`${base}/traffic/views`);
  const clones = await get(`${base}/traffic/clones`);
  const referrers = await get(`${base}/traffic/popular/referrers`);
  const paths = await get(`${base}/traffic/popular/paths`);
  const stars = await get(`${base}/stargazers?per_page=30`);
  const watchers = await get(`${base}/subscribers?per_page=30`);
  const forks = await get(`${base}/forks?per_page=30`);
  const out = {
    ok: true,
    summary: {
      views_total: views?.count ?? 0,
      views_uniques: views?.uniques ?? 0,
      clones_total: clones?.count ?? 0,
      clones_uniques: clones?.uniques ?? 0
    },
    referrers: Array.isArray(referrers) ? referrers.slice(0, 10) : [],
    popular_paths: Array.isArray(paths) ? paths.slice(0, 10) : [],
    stars_users: Array.isArray(stars) ? stars.map(u => ({ login: u.login, id: u.id })).slice(0, 30) : [],
    watchers_users: Array.isArray(watchers) ? watchers.map(u => ({ login: u.login, id: u.id })).slice(0, 30) : [],
    forks_users: Array.isArray(forks) ? forks.map(f => ({ owner: f.owner?.login, id: f.id, full_name: f.full_name })).slice(0, 30) : []
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ ok: false, error: e?.message || String(e) }, null, 2));
  process.exit(1);
});
