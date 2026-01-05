import fs from 'fs';
import path from 'path';

function forceApprove() {
    console.log("💪 FORCE APPROVING MIGRATION BATCHES");

    const planPath = path.join('migrate', 'migration-plan.json');
    if (!fs.existsSync(planPath)) {
        console.error("Plan not found");
        return;
    }

    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const approvedDir = path.join('migrate', 'approved');
    if (!fs.existsSync(approvedDir)) fs.mkdirSync(approvedDir, { recursive: true });

    for (const batch of plan.batches) {
        if (batch.local) {
            const src = path.join('migrate', 'batches', `${batch.batchId}.json`);
            const dest = path.join(approvedDir, `${batch.batchId}.json`);

            if (fs.existsSync(src)) {
                const data = JSON.parse(fs.readFileSync(src, 'utf8'));
                data.status = 'approved';
                data.approved_at = new Date().toISOString();
                data.notes.approved_by = 'force_approve_script';
                
                fs.writeFileSync(dest, JSON.stringify(data, null, 2));
                // fs.unlinkSync(src); // Keep for safety or delete? Let's delete to match logic
                try { fs.unlinkSync(src); } catch {}
                
                console.log(`✅ Batch ${batch.batchId} moved to approved/`);
            } else if (fs.existsSync(dest)) {
                console.log(`⚠️ Batch ${batch.batchId} already in approved/`);
            } else {
                console.error(`❌ Batch file missing for ${batch.batchId}`);
            }
        }
    }

    plan.approved = new Date().toISOString();
    plan.approved_by = 'force_approve_script';
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
    console.log("✅ Plan updated as APPROVED.");
}

forceApprove();
