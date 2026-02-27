import { z } from "zod";

// --- Prospect ---
export const prospectSchema = z.object({
  email: z
    .string()
    .min(1, "L'email est requis")
    .email("Veuillez entrer un email valide"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  employee_count: z.string().optional(),
  tags: z.string().optional(),
});

export type ProspectFormData = z.infer<typeof prospectSchema>;

// --- Import CSV column mapping ---
export const importMappingSchema = z.object({
  email: z.string().min(1, "La colonne email est requise"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  employee_count: z.string().optional(),
});

export type ImportMappingData = z.infer<typeof importMappingSchema>;

// --- Campaign ---
export const campaignSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom de la campagne est requis")
    .min(2, "Le nom doit contenir au moins 2 caracteres"),
  description: z.string().optional(),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// --- Email step ---
export const emailStepSchema = z.object({
  subject: z
    .string()
    .min(1, "L'objet de l'email est requis"),
  body_html: z
    .string()
    .min(1, "Le contenu de l'email est requis"),
});

export type EmailStepFormData = z.infer<typeof emailStepSchema>;

// --- Deal ---
export const dealSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  value: z.coerce.number().min(0).optional().nullable(),
  stage_id: z.string().min(1, "L'etape est requise"),
  prospect_id: z.string().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  probability: z.coerce.number().min(0).max(100).optional(),
});
export type DealFormData = z.infer<typeof dealSchema>;

// --- Activity ---
export const activitySchema = z.object({
  activity_type: z.enum(['call', 'meeting', 'email', 'task', 'follow_up', 'demo']),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional().nullable(),
  deal_id: z.string().optional().nullable(),
  prospect_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().min(0).optional().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});
export type ActivityFormData = z.infer<typeof activitySchema>;

// --- Note ---
export const noteSchema = z.object({
  content: z.string().min(1, "Le contenu est requis"),
  is_pinned: z.boolean().optional(),
});
export type NoteFormData = z.infer<typeof noteSchema>;
