export interface PipelineStageConfig {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  color: string;
  display_order: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface Deal {
  id: string;
  workspace_id: string;
  title: string;
  value: number | null;
  currency: string;
  stage_id: string;
  prospect_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  probability: number;
  status: 'open' | 'won' | 'lost';
  won_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown>;
  last_activity_at: string | null;
  stage_entered_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  prospect?: { id: string; first_name: string | null; last_name: string | null; email: string; company: string | null; last_contacted_at: string | null; contact_type: string | null };
  stage?: PipelineStageConfig;
  owner?: { id: string; full_name: string | null };
}

export interface Activity {
  id: string;
  workspace_id: string;
  activity_type: 'call' | 'meeting' | 'email' | 'task' | 'follow_up' | 'demo';
  title: string;
  description: string | null;
  deal_id: string | null;
  prospect_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  duration_minutes: number | null;
  is_done: boolean;
  done_at: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  outcome: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  deal?: { id: string; title: string };
  prospect?: { id: string; first_name: string | null; last_name: string | null; email: string };
  assignee?: { id: string; full_name: string | null };
}

export interface Note {
  id: string;
  workspace_id: string;
  content: string;
  deal_id: string | null;
  prospect_id: string | null;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author?: { id: string; full_name: string | null };
}
