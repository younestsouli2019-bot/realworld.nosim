import fs from 'fs'
import path from 'path'

export class ReputationLedger {
  constructor() {
    this.file = path.join(process.cwd(), 'data', 'autonomous', 'ledger', 'reputation.json')
  }
  read() {
    try {
      if (!fs.existsSync(this.file)) return { records: [] }
      return JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch { return { records: [] } }
  }
  write(entry) {
    const data = this.read()
    data.records.push({ ...entry, ts: Date.now() })
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2))
  }
}
