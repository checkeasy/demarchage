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
