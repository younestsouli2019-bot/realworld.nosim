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

  for (const idea of ideas) {
    console.log(`\n---------------------------------------------------`);
    // Record start of attempt
    recordAttempt({ idea_id: idea.id, status: 'STARTED' });
    
    try {
      console.log(`🔥 EXECUTING IDEA: ${idea.title} (${idea.id})`);

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
  
  console.log(`\n---------------------------------------------------`);
  console.log("🛑 LOOP COMPLETE. CHECK 'LIVE_OFFERS.md' FOR LINKS.");
}

// Allow direct execution
if (process.argv[1] === import.meta.filename) {
    realExecutionLoop().catch(console.error);
}
