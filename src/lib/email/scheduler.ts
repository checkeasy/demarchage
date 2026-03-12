import { format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * Check if current time is within the sending window for a given timezone
 */
export function isWithinSendingWindow(
  timezone: string,
  windowStart: string, // "08:00"
  windowEnd: string, // "18:00"
  sendingDays: number[] // [1,2,3,4,5] (0=Sun, 1=Mon, ...6=Sat)
): boolean {
  const now = new Date();
  const localTime = formatInTimeZone(now, timezone, "HH:mm");
  const zonedDate = toZonedTime(now, timezone);
  const localDay = zonedDate.getDay(); // 0=Sun, 1=Mon...

  return (
    sendingDays.includes(localDay) &&
    localTime >= windowStart &&
    localTime < windowEnd
  );
}

/**
 * Calculate the next valid send time respecting business hours
 */
export function getNextSendTime(
  timezone: string,
  windowStart: string,
  windowEnd: string,
  sendingDays: number[],
  delayDays: number,
  delayHours: number
): Date {
  const now = new Date();

  // Add the delay
  const target = new Date(now);
  target.setDate(target.getDate() + delayDays);
  target.setHours(target.getHours() + delayHours);

  // Add random jitter (0-30 minutes) to avoid sending bursts
  const jitterMinutes = Math.floor(Math.random() * 30);
  target.setMinutes(target.getMinutes() + jitterMinutes);

  // Check if the target time is within the sending window
  const targetLocal = formatInTimeZone(target, timezone, "HH:mm");
  const targetZoned = toZonedTime(target, timezone);
  const targetDay = targetZoned.getDay();

  if (
    sendingDays.includes(targetDay) &&
    targetLocal >= windowStart &&
    targetLocal < windowEnd
  ) {
    return target;
  }

  // If outside business hours, find the next valid slot
  return findNextValidSlot(target, timezone, windowStart, sendingDays);
}

/**
 * Find the next valid time slot (start of next business day's window)
 */
function findNextValidSlot(
  fromDate: Date,
  timezone: string,
  windowStart: string,
  sendingDays: number[]
): Date {
  // Guard: if no sending days configured, return fromDate as-is
  if (!sendingDays || sendingDays.length === 0) return fromDate;

  const candidate = new Date(fromDate);

  // Try up to 14 days ahead to find a valid sending day
  for (let i = 0; i < 14; i++) {
    candidate.setDate(candidate.getDate() + (i === 0 ? 0 : 1));

    const zonedCandidate = toZonedTime(candidate, timezone);
    const candidateDay = zonedCandidate.getDay();

    if (sendingDays.includes(candidateDay)) {
      // Set to window start time in the target timezone
      const [startHour, startMinute] = windowStart.split(":").map(Number);

      // Create a date at the window start in the target timezone
      const localDateStr = formatInTimeZone(
        candidate,
        timezone,
        "yyyy-MM-dd"
      );
      const targetStr = `${localDateStr}T${format(
        new Date(2000, 0, 1, startHour, startMinute),
        "HH:mm"
      )}:00`;

      // Parse back to UTC
      const result = new Date(
        new Date(targetStr + getTimezoneOffsetString(timezone, candidate))
      );

      // Add small jitter
      const jitter = Math.floor(Math.random() * 30);
      result.setMinutes(result.getMinutes() + jitter);

      return result;
    }
  }

  // Fallback: return tomorrow at window start (should never reach here)
  candidate.setDate(fromDate.getDate() + 1);
  return candidate;
}

/**
 * Get timezone offset string for a given timezone and date
 */
function getTimezoneOffsetString(timezone: string, date: Date): string {
  const offsetStr = formatInTimeZone(date, timezone, "xxx");
  return offsetStr;
}
