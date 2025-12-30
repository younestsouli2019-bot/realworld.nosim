import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { getPayoutBatchDetails } from "./paypal-api.mjs";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function fail(reason, details) {
  const out = { ok: false, reason: String(reason), ...(details ? { details } : {}) };
  process.stderr.write(`${JSON.stringify(out)}\n`);
  process.exit(2);
}

function ok(summary) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...summary })}\n`);
  process.exit(0);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function computeBatchCompletion(details) {
  const bs = String(details?.batch_header?.batch_status ?? "").toUpperCase();
  const items = Array.isArray(details?.items) ? details.items : [];
  const statuses = items
    .map((it) => it?.transaction_status ?? it?.payout_item?.transaction_status ?? null)
    .filter(Boolean)
    .map((x) => String(x).toUpperCase());
  const allSuccess = statuses.length > 0 && statuses.every((s) => s.includes("SUCCESS"));
  if (bs.includes("SUCCESS") && allSuccess) return { completed: true, batchStatus: bs, itemCount: statuses.length };
  return { completed: false, batchStatus: bs || null, itemCount: statuses.length };
}

async function main() {
  const proofDir = path.resolve(process.cwd(), "proof");
  if (!fs.existsSync(proofDir)) {
    fail("missing_proof_dir", { proofDir });
  }

  const proofFiles = fs
    .readdirSync(proofDir)
    .filter((f) => f.startsWith("payout_") && f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  if (proofFiles.length === 0) {
    fail("missing_proof_files", { proofDir });
  }

  const checked = [];
  const failures = [];

  for (const file of proofFiles) {
    const abs = path.join(proofDir, file);
    const raw = fs.readFileSync(abs, "utf8");
    const proof = safeJsonParse(raw);
    if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
      failures.push({ file, reason: "invalid_json_object" });
      continue;
    }

    const required = ["batch_id", "provider", "provider_batch_id", "submitted_at", "total_amount", "currency", "payload_hash", "payload"];
    const missing = required.filter((k) => proof[k] == null || proof[k] === "");
    if (missing.length > 0) {
      failures.push({ file, reason: "missing_fields", missing });
      continue;
    }

    const recomputed = sha256Hex(JSON.stringify(proof.payload));
    if (String(recomputed) !== String(proof.payload_hash)) {
      failures.push({ file, reason: "payload_hash_mismatch" });
      continue;
    }

    if (String(proof.provider) !== "paypal") {
      failures.push({ file, reason: "unsupported_provider", provider: proof.provider });
      continue;
    }

    let provider = null;
    try {
      const details = await getPayoutBatchDetails(String(proof.provider_batch_id));
      provider = computeBatchCompletion(details);
    } catch (e) {
      failures.push({
        file,
        reason: "provider_lookup_failed",
        message: e?.message ?? String(e)
      });
      continue;
    }

    if (!provider.completed) {
      failures.push({
        file,
        reason: "provider_not_completed",
        providerBatchStatus: provider.batchStatus,
        providerItemCount: provider.itemCount
      });
      continue;
    }

    checked.push({
      file,
      batchId: String(proof.batch_id),
      providerBatchId: String(proof.provider_batch_id),
      providerBatchStatus: provider.batchStatus,
      totalAmount: proof.total_amount,
      currency: proof.currency
    });
  }

  if (failures.length > 0) {
    fail("proof_failed", { checkedCount: checked.length, failureCount: failures.length, failures });
  }

  ok({ checkedCount: checked.length, proofs: checked });
}

main().catch((e) => {
  fail("unexpected_error", { message: e?.message ?? String(e) });
});

