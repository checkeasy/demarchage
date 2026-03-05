export interface ABVariant {
  id?: string;
  step_id?: string;
  variant_label: string; // 'A' | 'B'
  subject: string;
  body_html: string;
  body_text: string;
  weight: number;
  total_sent?: number;
  total_opened?: number;
  total_clicked?: number;
  total_replied?: number;
  is_winner?: boolean;
}

export interface StepData {
  id: string;
  step_order: number;
  step_type: "email" | "linkedin_connect" | "linkedin_message" | "delay" | "condition" | "whatsapp";
  delay_days: number;
  delay_hours: number;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  linkedin_message: string | null;
  whatsapp_message: string | null;
  ab_enabled: boolean;
  ab_variants?: ABVariant[];
  use_ai_generation: boolean;
  ai_prompt_context: string | null;
}
