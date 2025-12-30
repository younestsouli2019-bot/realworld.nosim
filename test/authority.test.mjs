import test from "node:test";
import assert from "node:assert/strict";

import { computeAuthorityChecksum, enforceAuthorityProtocol } from "../src/authority.mjs";

function restoreEnv(prev) {
  for (const k of Object.keys(process.env)) {
    if (!(k in prev)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(prev)) {
    process.env[k] = v;
  }
}

test("enforceAuthorityProtocol blocks live mode without NO_PLATFORM_WALLET", () => {
  const prev = { ...process.env };
  try {
    process.env.SWARM_LIVE = "true";
    delete process.env.NO_PLATFORM_WALLET;
    process.env.OWNER_PAYPAL_EMAIL = "owner@example.com";
    assert.throws(() => enforceAuthorityProtocol({ action: "x", requireLive: true }), /NO_PLATFORM_WALLET/);
  } finally {
    restoreEnv(prev);
  }
});

test("enforceAuthorityProtocol blocks allowlists that include non-owner recipients", () => {
  const prev = { ...process.env };
  try {
    process.env.SWARM_LIVE = "true";
    process.env.NO_PLATFORM_WALLET = "true";
    process.env.OWNER_PAYPAL_EMAIL = "owner@example.com";
    process.env.AUTONOMOUS_ALLOWED_PAYPAL_RECIPIENTS = "attacker@example.com";
    assert.throws(() => enforceAuthorityProtocol({ action: "x", requireLive: true }), /non-owner recipient/);
  } finally {
    restoreEnv(prev);
  }
});

test("computeAuthorityChecksum returns a sha256 hex string", () => {
  const prev = { ...process.env };
  try {
    delete process.env.BASE44_PAYOUT_DESTINATION_JSON;
    const out = computeAuthorityChecksum();
    assert.equal(typeof out, "string");
    assert.match(out, /^[0-9a-f]{64}$/);
  } finally {
    restoreEnv(prev);
  }
});
