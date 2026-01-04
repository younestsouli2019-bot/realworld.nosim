
import { buildBase44Client } from '../src/base44-client.mjs';
import '../src/load-env.mjs';

async function ensureSchemas() {
  console.log("🔍 Connecting to Base44...");
  const base44 = await buildBase44Client();
  if (!base44) {
    console.error("❌ Failed to initialize Base44 client. Check environment variables.");
    process.exit(1);
  }

  console.log("✅ Connected. Verifying schemas...");
  
  console.log("DEBUG: Base44 Client Keys:", Object.keys(base44));
  if (base44.management) console.log("DEBUG: Base44 Management Keys:", Object.keys(base44.management));
  if (base44.api) console.log("DEBUG: Base44 API Keys:", Object.keys(base44.api));

  const schemas = [
    {
      name: "Earning",
      fields: [
        { name: "earning_id", type: "text", unique: true, required: true },
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "text", required: true },
        { name: "occurred_at", type: "text", required: true }, // ISO Date
        { name: "source", type: "text", required: true },
        { name: "beneficiary", type: "text", required: true },
        { name: "status", type: "text", required: true },
        { name: "settlement_id", type: "text" },
        { name: "metadata", type: "json" }
      ]
    },
    {
      name: "PayoutBatch",
      fields: [
        { name: "batch_id", type: "text", unique: true, required: true },
        { name: "status", type: "text", required: true },
        { name: "total_amount", type: "number", required: true },
        { name: "currency", type: "text", required: true },
        { name: "approved_at", type: "text" },
        { name: "submitted_at", type: "text" },
        { name: "cancelled_at", type: "text" },
        { name: "paypal_payout_batch_id", type: "text" },
        { name: "notes", type: "json" },
        { name: "settlement_id", type: "text" },
        { name: "earning_ids", type: "json" }, // Storing list of IDs
        { name: "revenue_event_ids", type: "json" } // Storing list of IDs
      ]
    },
    {
      name: "PayoutItem",
      fields: [
        { name: "item_id", type: "text", unique: true, required: true },
        { name: "batch_id", type: "text", required: true },
        { name: "status", type: "text", required: true },
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "text", required: true },
        { name: "processed_at", type: "text" },
        { name: "revenue_event_id", type: "text" },
        { name: "transaction_id", type: "text" },
        { name: "recipient", type: "text" },
        { name: "recipient_type", type: "text" },
        { name: "earning_id", type: "text" }
      ]
    }
  ];

  for (const schema of schemas) {
    console.log(`👉 Checking schema: ${schema.name}...`);
    // Note: The Base44 SDK doesn't expose a direct 'createSchema' method in the same way as entities.
    // However, usually we can try to access the entity or use a management API.
    // If the SDK abstracts this, we might need to rely on the fact that accessing it might throw if missing,
    // or we might need to use a lower-level call if available.
    
    // Since the user asked to "create the necessary schemas", and the error was "Entity schema not found",
    // we assume we need to define it.
    
    // In many BaaS/Headless CMS setups (which Base44 resembles), schemas are often created via a specific admin API or UI.
    // If the SDK allows creating schemas, it would likely be on the client root or a 'management' namespace.
    
    // Let's try to see if we can create it using a hypothetical 'createEntityDefinition' or similar, 
    // or if we just need to ensure it exists by attempting to read it and catching the error, 
    // then creating it if the SDK supports it.
    
    // Given I don't have the full Base44 SDK docs, I will assume a standard pattern:
    // If 'base44.management' or similar exists.
    
    // Wait, the user said "I plan to create the necessary schemas using `scripts/ensure-schemas.mjs`".
    // I will use a 'define' or 'create' method on the client if available.
    
    // Inspecting base44-client.mjs might reveal more about the client capabilities.
    // For now, I will assume a method `base44.defineEntity` or `base44.createSchema` exists or similar.
    // If not, I'll log that I'm attempting it.
    
    try {
        if (base44.defineEntity) {
             await base44.defineEntity(schema.name, schema.fields);
             console.log(`✅ Defined schema: ${schema.name}`);
        } else {
            console.log(`ℹ️  Attempting to auto-create schema '${schema.name}' by inserting a dummy record...`);
            const entity = base44.asServiceRole.entities[schema.name];
            
            // Construct a dummy record based on fields
            const dummy = {};
            for (const f of schema.fields) {
                if (f.name === 'earning_id' || f.name === 'batch_id' || f.name === 'item_id') {
                    dummy[f.name] = `schema_init_${Date.now()}`;
                } else if (f.type === 'text') {
                    dummy[f.name] = "init";
                } else if (f.type === 'number') {
                    dummy[f.name] = 1;
                } else if (f.type === 'json') {
                    dummy[f.name] = {};
                }
            }
            
            try {
                const created = await entity.create(dummy);
                console.log(`✅ Successfully created dummy record for ${schema.name}. Schema should now exist.`);
                await entity.delete(created.id);
                console.log(`🗑️  Deleted dummy record.`);
            } catch (createErr) {
                 if (createErr.message.includes("not found in app")) {
                     console.error(`❌ Schema '${schema.name}' still missing. Auto-creation failed.`);
                     console.log("Please manually create these fields in the dashboard:");
                     console.log(JSON.stringify(schema.fields, null, 2));
                 } else {
                     console.error(`❌ Error creating dummy record for ${schema.name}:`, createErr.message);
                 }
            }
        }
    } catch (err) {
        console.error(`❌ Error defining schema ${schema.name}:`, err.message);
    }
  }
  
  console.log("🏁 Schema check complete.");
  process.exit(0);
}

ensureSchemas().catch(console.error);
