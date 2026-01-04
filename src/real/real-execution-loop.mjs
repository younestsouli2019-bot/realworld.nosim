import { getIdeaBacklog } from "./ideas/backlog.mjs";
import { buildOffer } from "./offers/build-offer.mjs";
import { publishOffer } from "./offers/publish.mjs";
import { waitForPayment } from "./payments/wait-for-payment.mjs";
import { recordFailure } from "./ledger/failures.mjs";
import { recordAttempt } from "./ledger/history.mjs";
import '../load-env.mjs'; // Ensure env vars are loaded for Base44 client

export async function realExecutionLoop() {
  console.log("🔥 STARTING REAL EXECUTION LOOP");
  console.log("   Policy: NO RETRY. NO SIMULATION. CASH OR DEATH.");
  
  const ideas = await getIdeaBacklog();
  console.log(`   Found ${ideas.length} candidates in backlog.`);

  const parallel = process.env.REGULATORY_CONTINGENCY_ACTIVE === 'true';
  if (parallel) {
      console.log("⚡ CONTINGENCY MODE: Executing all ideas in PARALLEL to maximize immediate revenue.");
      await Promise.all(ideas.map(executeIdea));
  } else {
      for (const idea of ideas) {
        await executeIdea(idea);
      }
  }
  
  console.log(`\n---------------------------------------------------`);
  console.log("🛑 LOOP COMPLETE. CHECK 'LIVE_OFFERS.md' FOR LINKS.");
}

async function executeIdea(idea) {
    console.log(`\n---------------------------------------------------`);
    // Record start of attempt
    recordAttempt({ idea_id: idea.id, status: 'STARTED' });
    
    try {
      console.log(`🔥 EXECUTING IDEA: ${idea.title} (${idea.id})`);

      // 0. Special Handling for 'SelarBot' (Priority Agent)
      if (idea.handoff_agent === 'selarbot' || idea.title.toLowerCase().includes('selar')) {
        console.log(`\n🤖 SPECIAL CARE: SelarBot Mission Detected: ${idea.title}`);
        console.log(`   Ensuring high priority execution for Selar.co integration.`);
        // Force priority and skip standard culling logic if any
        idea.priority = 'critical';
      }

      // 1. Build Offer (Force Checkout Creation)
      const offer = await buildOffer(idea);
      if (!offer.checkout_url) {
        throw new Error("NO_CHECKOUT_CREATED");
      }

      // 2. Publish Offer (Force Market Exposure)
      await publishOffer(offer);

      // 3. Wait for Payment (Reality Cliff)
      // Note: In this synchronous CLI loop, we verify ONCE. 
      // In a background daemon, this would keep checking.
      const payment = await waitForPayment({
        offer,
        timeoutHours: 48 // Policy limit
      });

      if (!payment.confirmed) {
        // Strict Policy: If no payment, it is a FAILURE.
        // "If you cannot produce a confirmed payment event... terminate."
        throw new Error(`NO_PAYMENT_RECEIVED: ${payment.reason}`);
      }

      console.log(`💰 REAL MONEY RECEIVED: ${payment.amount} ${payment.currency}`);
      recordAttempt({ idea_id: idea.id, status: 'SUCCESS', revenue: payment.amount });
      // TODO: Trigger fulfillment here

    } catch (err) {
      recordFailure({
        idea_id: idea.id,
        reason: err.message
      });
      // Update history with failure
      recordAttempt({ idea_id: idea.id, status: 'FAILED', reason: err.message });
    }
}

async function handleSelarBotExecution(idea) {
    console.log(`\n🤖 STARTING SELARBOT EXECUTION: ${idea.title}`);
    recordAttempt({ idea_id: idea.id, status: 'STARTED_SELAR' });

    try {
        // 1. Build Selar-specific offer
        // Ideally we would generate a Selar.co link here.
        // For now, we use the buildOffer fallback but log clearly.
        const offer = await buildOffer(idea);
        
        console.log(`   [Selar] 🚀 Generated Checkout Link: ${offer.checkout_url}`);
        
        // 2. Publish Offer
        await publishOffer(offer);

        // 3. Special Verification for Selar (72h SLA)
        console.log(`   [Selar] ⏳ Waiting for settlement (SLA: 72h)...`);
        
        const payment = await waitForPayment({
            offer,
            timeoutHours: 72 // Explicit 72h SLA for Selar
        });

        if (payment.confirmed) {
            console.log(`💰 SELAR PAYOUT CONFIRMED: ${payment.amount} ${payment.currency}`);
            recordAttempt({ idea_id: idea.id, status: 'SUCCESS', revenue: payment.amount });
        } else {
            console.error(`❌ SELAR PAYMENT FAILED: ${payment.reason}`);
            recordFailure({
                idea_id: idea.id,
                reason: `SELAR_PAYMENT_TIMEOUT: ${payment.reason}`
            });
            recordAttempt({ idea_id: idea.id, status: 'FAILED', reason: payment.reason });
            
            // Trigger specific audit for Selar failure
            // We could call triggerAgentAudit here if we imported it, 
            // but recordFailure is standard.
        }
    } catch (err) {
        console.error(`   [Selar] Execution Error: ${err.message}`);
        recordFailure({ idea_id: idea.id, reason: err.message });
        recordAttempt({ idea_id: idea.id, status: 'FAILED', reason: err.message });
    }
}

// Allow direct execution
if (process.argv[1] === import.meta.filename) {
    realExecutionLoop().catch(console.error);
}
