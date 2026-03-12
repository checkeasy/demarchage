const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const BASE_URL = "https://api.pipedrive.com/v1";

interface PipedriveActivity {
  id: number;
  subject: string;
  type: string;
  due_date: string | null;
  due_time: string;
  duration: string;
  done: boolean;
  marked_as_done_time: string;
  note: string | null;
  public_description: string | null;
  person_id: number | null;
  person_name: string | null;
  org_id: number | null;
  org_name: string | null;
  deal_id: number | null;
  deal_title: string | null;
  add_time: string;
  update_time: string;
  priority: string | null;
  location: string | null;
  busy_flag: boolean;
  assigned_to_user_id: number;
  owner_name: string;
}

interface PipedrivePagination {
  start: number;
  limit: number;
  more_items_in_collection: boolean;
  next_start: number;
}

interface PipedriveResponse<T> {
  success: boolean;
  data: T[] | null;
  additional_data?: {
    pagination?: PipedrivePagination;
  };
}

/**
 * Fetch all activities from Pipedrive (handles pagination)
 */
export async function fetchAllPipedriveActivities(options?: {
  done?: boolean;
  limit?: number;
}): Promise<PipedriveActivity[]> {
  if (!PIPEDRIVE_API_TOKEN) {
    throw new Error("PIPEDRIVE_API_TOKEN is not configured");
  }

  const maxTotal = options?.limit || 10000;
  const all: PipedriveActivity[] = [];
  let start = 0;
  const batchSize = 500;

  // Fetch both done and not-done if not specified
  const doneValues = options?.done !== undefined ? [options.done ? 1 : 0] : [0, 1];

  for (const doneVal of doneValues) {
    start = 0;
    let hasMore = true;

    while (hasMore && all.length < maxTotal) {
      const url = `${BASE_URL}/activities?api_token=${PIPEDRIVE_API_TOKEN}&limit=${batchSize}&start=${start}&done=${doneVal}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Pipedrive API error: ${res.status} ${res.statusText}`);
      }

      const json: PipedriveResponse<PipedriveActivity> = await res.json();

      if (!json.success || !json.data) {
        break;
      }

      all.push(...json.data);
      hasMore = json.additional_data?.pagination?.more_items_in_collection || false;
      start = json.additional_data?.pagination?.next_start || start + batchSize;
    }
  }

  return all;
}

/**
 * Map Pipedrive activity type to our activity types
 */
export function mapPipedriveType(type: string): string {
  const typeMap: Record<string, string> = {
    call: "call",
    meeting: "meeting",
    email: "email",
    task: "task",
    deadline: "task",
    lunch: "meeting",
  };
  return typeMap[type.toLowerCase()] || "task";
}

/**
 * Map Pipedrive priority to our priority
 */
export function mapPipedrivePriority(priority: string | null): string {
  if (!priority) return "normal";
  // Pipedrive doesn't have a strong priority system, but just in case
  const p = priority.toLowerCase();
  if (p.includes("high") || p.includes("important")) return "high";
  if (p.includes("urgent") || p.includes("critical")) return "urgent";
  if (p.includes("low")) return "low";
  return "normal";
}

/**
 * Build a due_date ISO string from Pipedrive's date + time fields
 */
export function buildDueDate(dueDate: string | null, dueTime: string): string | null {
  if (!dueDate) return null;
  if (dueTime) {
    return `${dueDate}T${dueTime}:00`;
  }
  return `${dueDate}T09:00:00`;
}

/**
 * Parse duration string "HH:MM" to minutes
 */
export function parseDuration(duration: string): number | null {
  if (!duration) return null;
  const parts = duration.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return null;
}

export type { PipedriveActivity };
