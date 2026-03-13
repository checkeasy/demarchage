export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface CustomQualificationCriteria {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface WorkspaceSettings {
  timezone: string;
  daily_sending_limit: number;
  sending_window_start: string;
  sending_window_end: string;
  sending_days: number[];
  custom_qualification_criteria?: CustomQualificationCriteria[];
}

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          plan: "free" | "starter" | "pro" | "enterprise";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          settings: WorkspaceSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          plan?: "free" | "starter" | "pro" | "enterprise";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: WorkspaceSettings;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_id?: string;
          plan?: "free" | "starter" | "pro" | "enterprise";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: WorkspaceSettings;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          current_workspace_id: string | null;
          role: "super_admin" | "user";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          current_workspace_id?: string | null;
          role?: "super_admin" | "user";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          current_workspace_id?: string | null;
          role?: "super_admin" | "user";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
      };
      email_accounts: {
        Row: {
          id: string;
          workspace_id: string;
          email_address: string;
          display_name: string | null;
          smtp_host: string | null;
          smtp_port: number;
          smtp_user: string | null;
          smtp_pass_encrypted: string | null;
          imap_host: string | null;
          imap_port: number;
          imap_user: string | null;
          imap_pass_encrypted: string | null;
          provider: "gmail" | "outlook" | "custom";
          resend_api_key_encrypted: string | null;
          signature_html: string;
          daily_limit: number;
          warmup_enabled: boolean;
          warmup_daily_target: number;
          warmup_current_volume: number;
          warmup_started_at: string | null;
          health_score: number;
          is_active: boolean;
          booking_url: string | null;
          tracking_domain: string | null;
          provider_daily_max: number | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email_address: string;
          display_name?: string | null;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_user?: string | null;
          smtp_pass_encrypted?: string | null;
          imap_host?: string | null;
          imap_port?: number;
          imap_user?: string | null;
          imap_pass_encrypted?: string | null;
          provider?: "gmail" | "outlook" | "custom";
          resend_api_key_encrypted?: string | null;
          signature_html?: string;
          daily_limit?: number;
          warmup_enabled?: boolean;
          warmup_daily_target?: number;
          warmup_current_volume?: number;
          warmup_started_at?: string | null;
          health_score?: number;
          is_active?: boolean;
          booking_url?: string | null;
          tracking_domain?: string | null;
          provider_daily_max?: number | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email_address?: string;
          display_name?: string | null;
          smtp_host?: string | null;
          smtp_port?: number;
          smtp_user?: string | null;
          smtp_pass_encrypted?: string | null;
          imap_host?: string | null;
          imap_port?: number;
          imap_user?: string | null;
          imap_pass_encrypted?: string | null;
          provider?: "gmail" | "outlook" | "custom";
          resend_api_key_encrypted?: string | null;
          signature_html?: string;
          daily_limit?: number;
          warmup_enabled?: boolean;
          warmup_daily_target?: number;
          warmup_current_volume?: number;
          warmup_started_at?: string | null;
          health_score?: number;
          is_active?: boolean;
          booking_url?: string | null;
          tracking_domain?: string | null;
          provider_daily_max?: number | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          website: string | null;
          domain: string | null;
          industry: string | null;
          city: string | null;
          country: string | null;
          phone: string | null;
          description: string | null;
          custom_fields: Json;
          contact_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          website?: string | null;
          domain?: string | null;
          industry?: string | null;
          city?: string | null;
          country?: string | null;
          phone?: string | null;
          description?: string | null;
          custom_fields?: Json;
          contact_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          website?: string | null;
          domain?: string | null;
          industry?: string | null;
          city?: string | null;
          country?: string | null;
          phone?: string | null;
          description?: string | null;
          custom_fields?: Json;
          contact_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      prospects: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          organization: string | null;
          organization_id: string | null;
          job_title: string | null;
          phone: string | null;
          linkedin_url: string | null;
          website: string | null;
          location: string | null;
          country: string | null;
          pipeline_stage: string | null;
          loss_reason: string | null;
          nb_properties: number | null;
          notes: string | null;
          custom_fields: Json;
          industry: string | null;
          city: string | null;
          employee_count: string | null;
          tags: string[];
          lead_score: number | null;
          department: string | null;
          language: string | null;
          email_score: number | null;
          email_verified_at: string | null;
          status: "active" | "bounced" | "unsubscribed" | "replied" | "converted" | "lost" | "standby" | "to_contact";
          source: "manual" | "csv_import" | "api" | "linkedin" | "google_maps" | "crm_import" | "directory_import";
          mission_id: string | null;
          contact_type: "prospect" | "lead_chaud" | "client" | "ancien_client" | "partenaire" | "concurrent" | "influenceur" | "a_recontacter" | "mauvaise_cible";
          last_contacted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          organization?: string | null;
          organization_id?: string | null;
          job_title?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          location?: string | null;
          country?: string | null;
          pipeline_stage?: string | null;
          loss_reason?: string | null;
          nb_properties?: number | null;
          notes?: string | null;
          custom_fields?: Json;
          industry?: string | null;
          city?: string | null;
          employee_count?: string | null;
          tags?: string[];
          lead_score?: number | null;
          department?: string | null;
          language?: string | null;
          email_score?: number | null;
          email_verified_at?: string | null;
          status?: "active" | "bounced" | "unsubscribed" | "replied" | "converted" | "lost" | "standby" | "to_contact";
          source?: "manual" | "csv_import" | "api" | "linkedin" | "google_maps" | "crm_import" | "directory_import";
          contact_type?: "prospect" | "lead_chaud" | "client" | "ancien_client" | "partenaire" | "concurrent" | "influenceur" | "a_recontacter" | "mauvaise_cible";
          last_contacted_at?: string | null;
          mission_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          organization?: string | null;
          organization_id?: string | null;
          job_title?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          website?: string | null;
          location?: string | null;
          country?: string | null;
          pipeline_stage?: string | null;
          loss_reason?: string | null;
          nb_properties?: number | null;
          notes?: string | null;
          custom_fields?: Json;
          industry?: string | null;
          city?: string | null;
          employee_count?: string | null;
          tags?: string[];
          lead_score?: number | null;
          department?: string | null;
          language?: string | null;
          email_score?: number | null;
          email_verified_at?: string | null;
          status?: "active" | "bounced" | "unsubscribed" | "replied" | "converted" | "lost" | "standby" | "to_contact";
          source?: "manual" | "csv_import" | "api" | "linkedin" | "google_maps" | "crm_import" | "directory_import";
          contact_type?: "prospect" | "lead_chaud" | "client" | "ancien_client" | "partenaire" | "concurrent" | "influenceur" | "a_recontacter" | "mauvaise_cible";
          last_contacted_at?: string | null;
          mission_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      campaigns: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          status: "draft" | "active" | "paused" | "completed" | "archived";
          email_account_id: string | null;
          timezone: string;
          sending_window_start: string;
          sending_window_end: string;
          sending_days: number[];
          daily_limit: number | null;
          track_opens: boolean;
          track_clicks: boolean;
          stop_on_reply: boolean;
          total_prospects: number;
          total_sent: number;
          total_opened: number;
          total_clicked: number;
          total_replied: number;
          total_bounced: number;
          total_unsubscribed: number;
          created_by: string | null;
          launched_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          status?: "draft" | "active" | "paused" | "completed" | "archived";
          email_account_id?: string | null;
          timezone?: string;
          sending_window_start?: string;
          sending_window_end?: string;
          sending_days?: number[];
          daily_limit?: number | null;
          track_opens?: boolean;
          track_clicks?: boolean;
          stop_on_reply?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: "draft" | "active" | "paused" | "completed" | "archived";
          email_account_id?: string | null;
          timezone?: string;
          sending_window_start?: string;
          sending_window_end?: string;
          sending_days?: number[];
          daily_limit?: number | null;
          track_opens?: boolean;
          track_clicks?: boolean;
          stop_on_reply?: boolean;
          total_prospects?: number;
          total_sent?: number;
          total_opened?: number;
          total_clicked?: number;
          total_replied?: number;
          total_bounced?: number;
          total_unsubscribed?: number;
          launched_at?: string | null;
          completed_at?: string | null;
        };
      };
      sequence_steps: {
        Row: {
          id: string;
          campaign_id: string;
          step_order: number;
          step_type: "email" | "linkedin_connect" | "linkedin_message" | "delay" | "condition";
          delay_days: number;
          delay_hours: number;
          subject: string | null;
          body_html: string | null;
          body_text: string | null;
          linkedin_message: string | null;
          ab_enabled: boolean;
          ab_winner_metric: "open_rate" | "click_rate" | "reply_rate";
          ab_winner_after_hours: number;
          ab_winner_variant_id: string | null;
          condition_type: string | null;
          condition_true_step_id: string | null;
          condition_false_step_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          step_order: number;
          step_type: "email" | "linkedin_connect" | "linkedin_message" | "delay" | "condition";
          delay_days?: number;
          delay_hours?: number;
          subject?: string | null;
          body_html?: string | null;
          body_text?: string | null;
          linkedin_message?: string | null;
          ab_enabled?: boolean;
          ab_winner_metric?: "open_rate" | "click_rate" | "reply_rate";
          ab_winner_after_hours?: number;
          condition_type?: string | null;
        };
        Update: {
          step_order?: number;
          step_type?: "email" | "linkedin_connect" | "linkedin_message" | "delay" | "condition";
          delay_days?: number;
          delay_hours?: number;
          subject?: string | null;
          body_html?: string | null;
          body_text?: string | null;
          linkedin_message?: string | null;
          ab_enabled?: boolean;
          ab_winner_metric?: "open_rate" | "click_rate" | "reply_rate";
          ab_winner_after_hours?: number;
          ab_winner_variant_id?: string | null;
          condition_type?: string | null;
          condition_true_step_id?: string | null;
          condition_false_step_id?: string | null;
          is_active?: boolean;
        };
      };
      outreach_missions: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          original_prompt: string;
          search_keywords: string[];
          target_profile: Json;
          language: string;
          campaign_email_id: string | null;
          campaign_linkedin_id: string | null;
          campaign_multichannel_id: string | null;
          status: "draft" | "active" | "paused" | "completed" | "archived";
          total_prospects: number;
          total_enrolled: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          original_prompt: string;
          search_keywords?: string[];
          target_profile?: Json;
          language?: string;
          campaign_email_id?: string | null;
          campaign_linkedin_id?: string | null;
          campaign_multichannel_id?: string | null;
          status?: "draft" | "active" | "paused" | "completed" | "archived";
          total_prospects?: number;
          total_enrolled?: number;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          search_keywords?: string[];
          target_profile?: Json;
          language?: string;
          campaign_email_id?: string | null;
          campaign_linkedin_id?: string | null;
          campaign_multichannel_id?: string | null;
          status?: "draft" | "active" | "paused" | "completed" | "archived";
          total_prospects?: number;
          total_enrolled?: number;
        };
      };
      emails_sent: {
        Row: {
          id: string;
          campaign_prospect_id: string;
          step_id: string;
          ab_variant_id: string | null;
          email_account_id: string;
          from_email: string;
          to_email: string;
          subject: string;
          body_html: string;
          body_text: string | null;
          tracking_id: string;
          resend_message_id: string | null;
          status: "queued" | "sending" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "failed" | "complained";
          queued_at: string;
          sent_at: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          replied_at: string | null;
          bounced_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_prospect_id: string;
          step_id: string;
          ab_variant_id?: string | null;
          email_account_id: string;
          from_email: string;
          to_email: string;
          subject: string;
          body_html: string;
          body_text?: string | null;
          tracking_id?: string;
          resend_message_id?: string | null;
          status?: "queued" | "sending" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "failed" | "complained";
        };
        Update: {
          status?: "queued" | "sending" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "failed" | "complained";
          resend_message_id?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          replied_at?: string | null;
          bounced_at?: string | null;
          error_message?: string | null;
        };
      };
    };
  };
}

// Helper types
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];
export type EmailAccount = Database["public"]["Tables"]["email_accounts"]["Row"];
export type Prospect = Database["public"]["Tables"]["prospects"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type SequenceStep = Database["public"]["Tables"]["sequence_steps"]["Row"];
export type EmailSent = Database["public"]["Tables"]["emails_sent"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OutreachMission = Database["public"]["Tables"]["outreach_missions"]["Row"];

// ─── Prospect Activity Types ─────────────────────────────────────────────────

export type ProspectActivityType =
  | "email_sent" | "email_opened" | "email_clicked" | "email_bounced" | "reply_received"
  | "linkedin_connect_sent" | "linkedin_connect_accepted" | "linkedin_message_sent" | "linkedin_reply_received" | "linkedin_profile_viewed"
  | "whatsapp_sent" | "whatsapp_delivered" | "whatsapp_read" | "whatsapp_reply_received"
  | "ai_reply_analysis" | "ai_research"
  | "note_added" | "status_changed" | "call_logged" | "meeting_scheduled" | "meeting_completed";

export type ProspectActivityChannel = "email" | "linkedin" | "whatsapp" | "phone" | "manual" | "ai";

export interface ProspectActivity {
  id: string;
  workspace_id: string;
  prospect_id: string;
  activity_type: ProspectActivityType;
  channel: ProspectActivityChannel | null;
  campaign_id: string | null;
  sequence_id: string | null;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  ai_analyzed: boolean | null;
  performed_by: string | null;
  created_at: string;
}

// ─── Agent System Types ──────────────────────────────────────────────────────

export type AgentType = "ceo" | "email_writer" | "linkedin_writer" | "response_handler" | "prospect_researcher";

export interface AgentConfig {
  id: string;
  workspace_id: string;
  agent_type: AgentType;
  name: string;
  description: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  active_prompt_version_id: string | null;
  settings: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentPromptVersion {
  id: string;
  agent_config_id: string;
  version: number;
  system_prompt: string;
  prompt_metadata: Json;
  total_generations: number;
  avg_personalization_score: number;
  avg_open_rate: number | null;
  avg_reply_rate: number | null;
  avg_click_rate: number | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AgentStrategy {
  id: string;
  workspace_id: string;
  segment_key: string;
  segment_filters: Json;
  strategy: Json;
  based_on_sample_size: number;
  performance_snapshot: Json;
  expires_at: string;
  is_active: boolean;
  generated_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMemory {
  id: string;
  workspace_id: string;
  prospect_id: string;
  memory_type: "enrichment" | "interaction" | "reply_analysis" | "strategy_note" | "personalization" | "narrative_thread";
  content: Json;
  sequence_order: number;
  created_at: string;
  expires_at: string | null;
}

export interface AgentPerformanceMetric {
  id: string;
  workspace_id: string;
  agent_type: string;
  metric_period: "daily" | "weekly" | "monthly" | "all_time";
  period_start: string;
  period_end: string;
  segment_key: string | null;
  total_generations: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  avg_personalization_score: number | null;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_converted: number;
  total_bounced: number;
  open_rate: number | null;
  click_rate: number | null;
  reply_rate: number | null;
  conversion_rate: number | null;
  bounce_rate: number | null;
  winning_patterns: Json;
  losing_patterns: Json;
  created_at: string;
  updated_at: string;
}

export interface AgentGenerationLog {
  id: string;
  workspace_id: string;
  agent_type: string;
  agent_config_id: string | null;
  prompt_version_id: string | null;
  prospect_id: string | null;
  campaign_id: string | null;
  segment_key: string | null;
  strategy_id: string | null;
  model: string;
  temperature: number | null;
  input_messages: Json;
  output_content: Json;
  raw_output: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cache_hit: boolean;
  personalization_score: number | null;
  validation_passed: boolean;
  validation_errors: Json;
  was_used: boolean;
  was_edited: boolean;
  user_satisfaction: "good" | "bad" | "edited" | null;
  outcome_open: boolean | null;
  outcome_click: boolean | null;
  outcome_reply: boolean | null;
  outcome_conversion: boolean | null;
  generation_duration_ms: number | null;
  created_at: string;
}

export interface AgentAbTest {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  name: string;
  description: string | null;
  test_type: string;
  variants: Json;
  traffic_split: Json;
  primary_metric: string;
  min_sample_size: number;
  confidence_threshold: number;
  status: "draft" | "running" | "completed" | "cancelled";
  winner_variant: string | null;
  results: Json;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
