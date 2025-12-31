
function safeJsonParse(maybeJson, fallback) {
  if (!maybeJson) return fallback;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return fallback;
  }
}

export function getPayoutBatchConfigFromEnv() {
  const entityName = process.env.BASE44_PAYOUT_BATCH_ENTITY ?? "PayoutBatch";
  const fieldMap = safeJsonParse(process.env.BASE44_PAYOUT_BATCH_FIELD_MAP, null) ?? {
    batchId: "batch_id",
    status: "status",
    totalAmount: "total_amount",
    currency: "currency",
    approvedAt: "approved_at",
    submittedAt: "submitted_at",
    cancelledAt: "cancelled_at",
    providerBatchId: "paypal_payout_batch_id",
    notes: "notes"
  };
  return { entityName, fieldMap };
}

export function getPayoutItemConfigFromEnv() {
  const entityName = process.env.BASE44_PAYOUT_ITEM_ENTITY ?? "PayoutItem";
  const fieldMap = safeJsonParse(process.env.BASE44_PAYOUT_ITEM_FIELD_MAP, null) ?? {
    itemId: "item_id",
    batchId: "batch_id",
    status: "status",
    amount: "amount",
    currency: "currency",
    processedAt: "processed_at",
    revenueEventId: "revenue_event_id",
    transactionId: "transaction_id"
  };
  return { entityName, fieldMap };
}
