import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

function appendChangelogEntry(summary, details = {}) {
  const fp = path.join(process.cwd(), 'changelog_report.txt')
  const now = new Date().toISOString()
  const lines = []
  lines.push(`# Success Report - ${now}`)
  lines.push(`Summary: ${summary}`)
  if (details && typeof details === 'object') {
    const keys = Object.keys(details)
    if (keys.length) {
      lines.push(`Details:`)
      for (const k of keys) {
        const v = Array.isArray(details[k]) ? details[k].join(', ') : String(details[k])
        lines.push(`- ${k}: ${v}`)
      }
    }
  }
  lines.push(`---`)
  const content = lines.join('\n') + '\n'
  try {
    fs.appendFileSync(fp, content)
    return fp
  } catch (e) {
    return null
  }
}

function runGit(args = []) {
  const res = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

export function commitAndPushIfEnabled(message = 'Auto commit on success') {
  const enabled = String(process.env.AUTO_PUSH_ON_SUCCESS || '').toLowerCase() === 'true'
  if (!enabled) return { pushed: false, reason: 'disabled' }
  const add = runGit(['add', '-A'])
  const commit = runGit(['commit', '-m', message])
  const push = runGit(['push'])
  return { pushed: true, add, commit, push }
}

export function recordSuccess(summary, details = {}, commitMessage = null) {
  const fp = appendChangelogEntry(summary, details)
  const msg = commitMessage || summary
  const pushRes = commitAndPushIfEnabled(msg)
  return { changelog: fp, push: pushRes }
}
