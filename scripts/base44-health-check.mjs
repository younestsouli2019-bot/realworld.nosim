import 'dotenv/config'
import fetch from 'node-fetch'

async function main() {
  const appId = (process.env.BASE44_APP_ID || '').trim()
  const token = (process.env.BASE44_SERVICE_TOKEN || '').trim()
  const baseUrl = (process.env.BASE44_API_URL || '').trim()

  console.log('\n🧠 Base44 Health Check')
  console.log('======================')

  if (!appId || !token || !baseUrl) {
    console.log('❌ Missing BASE44_APP_ID, BASE44_SERVICE_TOKEN or BASE44_API_URL in .env')
    process.exitCode = 1
    return
  }

  try {
    const hdrs = { Authorization: `Bearer ${token}` }

    const appRes = await fetch(`${baseUrl}/apps/${appId}`, { headers: hdrs })
    if (!appRes.ok) throw new Error(`App check failed: ${appRes.status}`)
    const app = await appRes.json()
    console.log(`✅ App: ${app.name || appId} (env: ${app.environment || 'unknown'})`)

    const entRes = await fetch(`${baseUrl}/apps/${appId}/entities`, { headers: hdrs })
    if (!entRes.ok) throw new Error(`Entities list failed: ${entRes.status}`)
    const entities = await entRes.json()
    if (Array.isArray(entities) && entities.length) {
      console.log(`📂 Entities: ${entities.map(e => e.name).join(', ')}`)
    } else {
      console.log('⚠️ No entities found')
    }

    console.log('✅ Base44 reachable and responding')
  } catch (e) {
    console.log(`❌ Base44 unreachable or misconfigured: ${e.message}`)
    console.log('↩️ Falling back to offline mode: marketing_queue.json and local ledgers will be used')
    process.exitCode = 2
  }
}

main()
