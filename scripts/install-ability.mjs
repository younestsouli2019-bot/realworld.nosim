import '../src/load-env.mjs';
import { installAbility } from '../src/swarm/ability-fetcher.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (!n || n.startsWith('--')) {
      args[k] = true;
    } else {
      args[k] = n;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const name = String(args.name || '').trim();
  const ownerRepo = String(args.repo || '').trim();
  const repoPath = String(args.path || '').trim();
  const branch = String(args.branch || 'main').trim();
  const destDir = args.dest ? String(args.dest) : undefined;
  if (!name || !ownerRepo || !repoPath) {
    throw new Error('Usage: --name <ability> --repo <owner/repo> --path <file> [--branch main] [--dest ./abilities]');
  }
  const result = await installAbility({ name, ownerRepo, branch, repoPath, destDir });
  process.stdout.write(`${JSON.stringify({ ok: true, ability: name, path: result.path })}\n`);
}

main().catch((e) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: e?.message ?? String(e) })}\n`);
  process.exitCode = 1;
});
