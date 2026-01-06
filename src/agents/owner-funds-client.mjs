import http from 'node:http'

function getToken() {
  const v = process.env.SWARM_INTERNAL_TOKENS || process.env.AGENT_API_TOKENS || ''
  return v.split(',').map(s => s.trim()).filter(Boolean)[0] || ''
}

function getPort() {
  return Number(process.env.AGENT_API_PORT || '8088')
}

async function request(method, path, body) {
  const token = getToken()
  const port = getPort()
  const payload = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Content-Length': payload ? Buffer.byteLength(payload) : 0 } } ,
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const s = Buffer.concat(chunks).toString('utf8')
          try {
            const j = JSON.parse(s || '{}')
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(j)
            else reject(new Error(j?.error || `http_${res.statusCode}`))
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve({})
            else reject(new Error(`http_${res.statusCode}`))
          }
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function withRetry(fn, retries = 3) {
  let attempt = 0
  let lastErr = null
  while (attempt < retries) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      await delay(500 * Math.pow(2, attempt))
      attempt++
    }
  }
  throw lastErr
}

export class OwnerFundsClient {
  async requestAutoSettlement(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/settlement/auto', { payoutBatchId, items, actor }))
  }
  async requestPayPalPayout(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/paypal', { payoutBatchId, items, actor }))
  }
  async requestBankWireTransfer(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/bank', { payoutBatchId, items, actor }))
  }
  async requestCryptoTransfer(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/crypto', { payoutBatchId, items, actor }))
  }
  async requestPayoneerTransfer(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/payoneer', { payoutBatchId, items, actor }))
  }
  async requestStripeTransfer(payoutBatchId, items, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/stripe', { payoutBatchId, items, actor }))
  }
  async updatePayoutStatus(itemId, newStatus, txId = null, errorMessage = null, processedAt = null, actor = 'SwarmAgent') {
    return withRetry(() => request('POST', '/api/payout/status', { itemId, newStatus, txId, errorMessage, processedAt, actor }))
  }
  async getPayPalBalance() {
    return withRetry(() => request('GET', '/api/balance/paypal'))
  }
}
