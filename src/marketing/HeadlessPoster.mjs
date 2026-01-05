import fs from 'fs'
import path from 'path'

export class HeadlessPoster {
  constructor() {
    this.mode = (process.env.AUTO_POST_MODE || 'outbox').toLowerCase()
    this.outboxDir = path.join(process.cwd(), 'outbox')
    if (!fs.existsSync(this.outboxDir)) fs.mkdirSync(this.outboxDir, { recursive: true })
  }

  async postAll(posts) {
    const results = []
    for (const p of posts) results.push(await this.post(p))
    return results
  }

  async post(post) {
    if (this.mode === 'api') {
      return this._apiPost(post)
    }
    if (this.mode === 'intent') {
      return this._intentDraft(post)
    }
    return this._outbox(post)
  }

  async _apiPost(post) {
    const hasTwitter = process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET
    const hasLinkedIn = process.env.LINKEDIN_ACCESS_TOKEN
    const outputs = []
    if (!hasTwitter && !hasLinkedIn) return this._outbox(post)
    // Placeholders for real API calls; we avoid adding external SDKs here.
    if (hasTwitter) outputs.push({ platform: 'twitter', status: 'QUEUED_API', payload: post.text })
    if (hasLinkedIn) outputs.push({ platform: 'linkedin', status: 'QUEUED_API', payload: post.link })
    return { status: 'QUEUED_API', outputs }
  }

  async _intentDraft(post) {
    const file = path.join(this.outboxDir, `intent_${Date.now()}_${sanitize(post.id)}.txt`)
    const content = [
      'INTENT LINKS',
      `X: https://twitter.com/intent/tweet?text=${encodeURIComponent(post.text)}`,
      `LinkedIn: https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(post.link)}`,
      ''
    ].join('\n')
    fs.writeFileSync(file, content)
    return { status: 'INTENT_READY', file }
  }

  async _outbox(post) {
    const file = path.join(this.outboxDir, `post_${Date.now()}_${sanitize(post.id)}.txt`)
    const content = [
      `TITLE: ${post.title}`,
      `PRICE: $${post.price}`,
      `TEXT:  ${post.text}`,
      `LINK:  ${post.link}`,
      ''
    ].join('\n')
    fs.writeFileSync(file, content)
    return { status: 'OUTBOX', file }
  }
}

function sanitize(s = '') {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '')
}
