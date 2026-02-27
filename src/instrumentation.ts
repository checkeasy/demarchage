export async function register() {
  // Only run on server side, not during build
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const CRON_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    const APP_URL =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
      console.log("[Cron] CRON_SECRET not set, skipping cron setup");
      return;
    }

    console.log(
      `[Cron] Starting email cron job (every ${CRON_INTERVAL_MS / 60000} min)`
    );

    const runCron = async () => {
      try {
        const res = await fetch(`${APP_URL}/api/cron/send-emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CRON_SECRET}`,
          },
        });
        const data = await res.json();
        console.log("[Cron] Result:", JSON.stringify(data));
      } catch (err) {
        console.error("[Cron] Error:", err);
      }
    };

    // Wait 30s after startup before first run
    setTimeout(() => {
      runCron();
      setInterval(runCron, CRON_INTERVAL_MS);
    }, 30000);
  }
}
