/**
 * Self-contained cron scheduler that runs inside the Next.js process.
 * Calls internal API routes at defined intervals using fetch().
 *
 * Activated via instrumentation.ts (Next.js server startup hook).
 */

import { toZonedTime } from 'date-fns-tz';

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000');

interface CronJob {
  name: string;
  path: string;
  intervalMs: number;
  // Only run during business hours (Paris timezone)
  businessHoursOnly?: boolean;
}

const JOBS: CronJob[] = [
  {
    name: 'send-emails',
    path: '/api/cron/send-emails',
    intervalMs: 5 * 60 * 1000, // Every 5 minutes
    businessHoursOnly: true,
  },
  {
    name: 'check-replies',
    path: '/api/cron/check-replies',
    intervalMs: 15 * 60 * 1000, // Every 15 minutes
    businessHoursOnly: true,
  },
  {
    name: 'automation',
    path: '/api/cron/automation',
    intervalMs: 10 * 60 * 1000, // Every 10 minutes
    businessHoursOnly: true,
  },
  {
    name: 'health-check',
    path: '/api/cron/health-check',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    businessHoursOnly: false,
  },
  {
    name: 'learning-pipeline',
    path: '/api/agents/cron',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    businessHoursOnly: false,
  },
  {
    name: 'web-watch',
    path: '/api/web-watch/scan',
    intervalMs: 24 * 60 * 60 * 1000, // Every 24 hours (recap sent automatically after scan)
    businessHoursOnly: false,
  },
  {
    name: 'enrich-prospects',
    path: '/api/cron/enrich-prospects',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    businessHoursOnly: true,
  },
  {
    name: 'business-alerts',
    path: '/api/cron/business-alerts',
    intervalMs: 24 * 60 * 60 * 1000, // Daily
    businessHoursOnly: false,
  },
];

function isBusinessHours(): boolean {
  // Get current time in Paris using proper timezone conversion
  const now = new Date();
  const parisTime = toZonedTime(now, 'Europe/Paris');
  const hour = parisTime.getHours();
  const day = parisTime.getDay(); // 0=Sun, 6=Sat

  // Monday-Friday, 8:00-19:00 Paris time
  return day >= 1 && day <= 5 && hour >= 8 && hour < 19;
}

async function executeCronJob(job: CronJob): Promise<void> {
  if (job.businessHoursOnly && !isBusinessHours()) {
    return;
  }

  if (!CRON_SECRET) {
    console.warn(`[Cron] CRON_SECRET not set, skipping ${job.name}`);
    return;
  }

  const url = `${BASE_URL}${job.path}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Cron] ${job.name}: ${res.status} ${JSON.stringify(data)}`);
  } catch (err) {
    console.error(`[Cron] ${job.name} failed:`, (err as Error).message);
  }
}

const intervals: NodeJS.Timeout[] = [];
const timeouts: NodeJS.Timeout[] = [];
let started = false;

export function startCronScheduler(): void {
  if (started) return;
  started = true;

  console.log(`[Cron] Starting scheduler with ${JOBS.length} jobs (base: ${BASE_URL})`);

  for (const job of JOBS) {
    // Initial delay: stagger jobs to avoid all firing at once
    const initialDelay = Math.random() * 30000; // 0-30s random delay

    const timeout = setTimeout(() => {
      // Run immediately
      executeCronJob(job);

      // Then run on interval
      const interval = setInterval(() => executeCronJob(job), job.intervalMs);
      intervals.push(interval);
    }, initialDelay);
    timeouts.push(timeout);

    console.log(`[Cron] Scheduled: ${job.name} every ${job.intervalMs / 1000}s`);
  }
}

export function stopCronScheduler(): void {
  for (const timeout of timeouts) {
    clearTimeout(timeout);
  }
  timeouts.length = 0;
  for (const interval of intervals) {
    clearInterval(interval);
  }
  intervals.length = 0;
  started = false;
  console.log('[Cron] Scheduler stopped');
}
