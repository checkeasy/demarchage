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
}
