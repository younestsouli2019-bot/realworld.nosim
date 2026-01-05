import fs from 'fs';
import path from 'path';
import { ProofValidator } from '../src/real/proof-validator.mjs';
import { EvidenceIntegrityChain } from '../src/real/evidence-integrity.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';

async function listAll(entity, { fields = null, pageSize = 200, sort = "-created_date" } = {}) {
  const out = [];
  let offset = 0;
  for (;;) {
    const page = await entity.list(sort, pageSize, offset, fields ?? undefined);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return out;
}

function deriveProofFromMetadata(e) {
  const m = e.metadata || {};
  const psp = m.psp_transaction_id || m.paypal_transaction_id || m.transaction_id || null;
  const bankRef = m.bank_reference || m.bank_ref || null;
  if (psp) {
    return {
      type: 'psp_transaction_id',
      psp_id: String(psp),
      amount: Number(e.amount),
      currency: e.currency,
      timestamp: e.occurred_at || new Date().toISOString(),
      recipient: m.beneficiary || null
    };
  }
  if (bankRef) {
    return {
      type: 'bank_reference',
      psp_id: String(bankRef),
      amount: Number(e.amount),
      currency: e.currency,
      timestamp: e.occurred_at || new Date().toISOString(),
      recipient: m.beneficiary || null
    };
  }
  return null;
}

async function run() {
  const client = buildBase44Client();
  if (!client) {
    console.log('NO_BASE44');
    process.exit(0);
  }
  const cfg = getRevenueConfigFromEnv();
  const entity = client.asServiceRole.entities[cfg.entityName];
  const fields = [cfg.fieldMap.amount, cfg.fieldMap.currency, cfg.fieldMap.status, cfg.fieldMap.metadata, cfg.fieldMap.eventHash, 'id'];
  const events = await listAll(entity, { fields });
  const targets = events.filter(e => {
    const s = e[cfg.fieldMap.status];
    return s === 'hallucination' || s === 'confirmed' || s == null;
  });
  const repaired = [];
  for (const e of targets) {
    const proof = deriveProofFromMetadata({
      amount: e[cfg.fieldMap.amount],
      currency: e[cfg.fieldMap.currency],
      occurred_at: e[cfg.fieldMap.occurredAt],
      metadata: e[cfg.fieldMap.metadata]
    });
    if (!proof) continue;
    try {
      await ProofValidator.assertValid({
        amount: e[cfg.fieldMap.amount],
        currency: e[cfg.fieldMap.currency],
        occurredAt: e[cfg.fieldMap.occurredAt],
        metadata: { verification_proof: proof },
        verification_proof: proof
      });
      await EvidenceIntegrityChain.addBlock(e.id, proof);
      const existingMeta = e[cfg.fieldMap.metadata] || {};
      const updatePayload = {};
      updatePayload[cfg.fieldMap.metadata] = { ...existingMeta, verification_proof: proof, repaired: true };
      updatePayload[cfg.fieldMap.status] = 'VERIFIED';
      await entity.update(e.id, updatePayload);
      repaired.push(e.id);
    } catch {}
  }
  const outDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'repair-hallucinations.json');
  fs.writeFileSync(outFile, JSON.stringify({ repairedCount: repaired.length, repairedIds: repaired }, null, 2));
  console.log(outFile);
}

run().catch(e => {
  console.error('REPAIR_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
