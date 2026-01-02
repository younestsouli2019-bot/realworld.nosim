import fs from "fs";
import path from "path";

export function recordFailure(entry) {
  const logPath = path.join(process.cwd(), "src", "real", "ledger", "execution_failures.log");
  
  const logEntry = JSON.stringify({
    ...entry,
    ts: new Date().toISOString()
  }) + "\n";
  
  fs.appendFileSync(logPath, logEntry);
  console.log(`❌ Failure recorded in ledger: ${entry.reason}`);
}
