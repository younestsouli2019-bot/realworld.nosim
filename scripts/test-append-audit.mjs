import { AppendOnlyHmacLogger } from '../src/audit/AppendOnlyHmacLogger.mjs';
const logger = new AppendOnlyHmacLogger();
const entry = { id: `TEST_${Date.now()}`, timestamp: new Date().toISOString(), action: 'TEST_APPEND', entity_id: 'TEST_ENTITY', actor: 'TestRunner', changes: { before: null, after: { ok: true } }, context: { note: 'append-only-hmac' } };
const res = await logger.write(entry);
console.log(JSON.stringify({ ok: true, filePath: res.filePath, hmac: res.hmac }));

