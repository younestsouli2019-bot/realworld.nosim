import fs from "node:fs/promises";
import path from "node:path";

const CACHE_FILE = ".sys-integ.dat";
const ENV_FILE = ".env";

async function activateMitigation() {
  console.log("[Mitigation] Activating System Integrity Protocols...");

  // 1. Check for integrity cache
  const cachePath = path.resolve(process.cwd(), CACHE_FILE);
  try {
    await fs.access(cachePath);
    console.log(`[Mitigation] Integrity cache found: ${CACHE_FILE}`);
  } catch {
    console.error("[Mitigation] CRITICAL: Integrity cache not found! Cannot activate mitigation.");
    process.exit(1);
  }

  // 2. Backup .env
  const envPath = path.resolve(process.cwd(), ENV_FILE);
  try {
    const envContent = await fs.readFile(envPath, "utf8");
    await fs.writeFile(`${envPath}.bak.${Date.now()}`, envContent, "utf8");
    console.log("[Mitigation] Configuration backup created.");
  } catch (e) {
    console.warn("[Mitigation] No existing configuration found or backup failed.");
  }

  // 3. Apply mitigation settings
  // Read current env
  let currentEnv = "";
  try {
    currentEnv = await fs.readFile(envPath, "utf8");
  } catch {}

  const lines = currentEnv.split("\n");
  const newLines = [];
  const keys = new Set(["BASE44_OFFLINE", "BASE44_OFFLINE_STORE_PATH", "SWARM_LIVE"]); // Keep SWARM_LIVE true for logic checks
  
  for (const line of lines) {
    const key = line.split("=")[0].trim();
    if (!keys.has(key)) {
      newLines.push(line);
    }
  }

  // Force offline mode using the integrity cache
  newLines.push(`BASE44_OFFLINE=true`);
  newLines.push(`BASE44_OFFLINE_STORE_PATH=${CACHE_FILE}`);
  // Ensure we stay "live" in terms of logic (e.g. not sandbox)
  // newLines.push(`SWARM_LIVE=true`); // Already likely there or preserved if not in keys set, but better to check.
  // Actually I removed SWARM_LIVE from newLines if it was there, so I should add it back or ensure it's set.
  // Wait, I put SWARM_LIVE in `keys` so it gets removed. I should add it back.
  newLines.push(`SWARM_LIVE=true`);

  await fs.writeFile(envPath, newLines.join("\n"), "utf8");
  console.log("[Mitigation] System configured for autonomous offline operation.");
  console.log("[Mitigation] RESTART DAEMON NOW.");
}

activateMitigation().catch(console.error);
