/**
 * Cron runner - calls send-emails and check-replies endpoints every 2 minutes
 * Runs as a separate PM2 process
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.CRON_BASE_URL || "http://localhost:3004";
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

if (!CRON_SECRET) {
  console.error("[Cron Runner] CRON_SECRET not set, exiting");
  process.exit(1);
}

async function callEndpoint(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    console.log(`[${timestamp}] ${path} -> ${res.status}`, JSON.stringify(data));
  } catch (err) {
    console.error(`[Cron Runner] Error calling ${path}:`, err.message);
  }
}

async function run() {
  console.log(`[Cron Runner] Started - hitting ${BASE_URL} every ${INTERVAL_MS / 1000}s`);

  // Run immediately on start
  await callEndpoint("/api/cron/send-emails");
  await callEndpoint("/api/cron/check-replies");

  // Then every 2 minutes
  setInterval(async () => {
    await callEndpoint("/api/cron/send-emails");
    await callEndpoint("/api/cron/check-replies");
  }, INTERVAL_MS);
}

run();
