"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { prospectSchema, type ProspectFormData } from "@/lib/validations";
import { INDUSTRIES, EMPLOYEE_COUNTS } from "@/lib/constants";
import { detectLanguage } from "@/lib/outreach-routing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** If provided, the dialog is in edit mode */
  defaultValues?: ProspectFormData & { id?: string };
}

const emptyForm: ProspectFormData = {
  email: "",
  first_name: "",
  last_name: "",
  company: "",
  job_title: "",
  phone: "",
  linkedin_url: "",
  website: "",
  location: "",
  industry: "",
  city: "",
  employee_count: "",
  tags: "",
};

export function AddProspectDialog({
  open,
  onOpenChange,
  workspaceId,
  defaultValues,
}: AddProspectDialogProps) {
  const router = useRouter();
  const supabase = createClient();

  const isEdit = !!defaultValues?.id;

  const [formData, setFormData] = useState<ProspectFormData>(
    defaultValues ?? emptyForm
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFormData(defaultValues ?? emptyForm);
  }, [defaultValues]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function resetForm() {
    setFormData(defaultValues ?? emptyForm);
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const result = prospectSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Clean empty strings to null
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.data)) {
      if (key === "tags") {
        // Convert comma-separated tags to array
        const tagsStr = value as string;
        cleaned[key] = tagsStr
          ? tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [];
      } else {
        cleaned[key] = value && (value as string).trim() !== "" ? (value as string).trim() : null;
      }
    }

    // Auto-detect language from country
    if (cleaned.country && typeof cleaned.country === "string") {
      cleaned.language = detectLanguage(cleaned.country);
    }

    if (isEdit && defaultValues?.id) {
      const { error } = await supabase
        .from("prospects")
        .update(cleaned)
        .eq("id", defaultValues.id);

      setIsLoading(false);

      if (error) {
        toast.error("Erreur lors de la mise a jour du prospect");
        return;
      }

      toast.success("Prospect mis a jour");
    } else {
      const { error } = await supabase.from("prospects").insert({
        ...cleaned,
        email: cleaned.email!,
        workspace_id: workspaceId,
        source: "manual" as const,
      });

      setIsLoading(false);

      if (error) {
        if (error.code === "23505") {
          toast.error("Un prospect avec cet email existe deja dans ce workspace");
        } else {
          toast.error("Erreur lors de l'ajout du prospect");
        }
        return;
      }

      toast.success("Prospect ajoute avec succes");
    }

    resetForm();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le prospect" : "Ajouter un prospect"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez les informations du prospect."
              : "Remplissez les informations du nouveau prospect."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="prospect@entreprise.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* First name / Last name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prenom</Label>
              <Input
                id="first_name"
                name="first_name"
                placeholder="Jean"
                value={formData.first_name ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nom</Label>
              <Input
                id="last_name"
                name="last_name"
                placeholder="Dupont"
                value={formData.last_name ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Company / Job title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Entreprise</Label>
              <Input
                id="company"
                name="company"
                placeholder="Acme Inc."
                value={formData.company ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title">Poste</Label>
              <Input
                id="job_title"
                name="job_title"
                placeholder="Directeur commercial"
                value={formData.job_title ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telephone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={formData.phone ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="linkedin_url">URL LinkedIn</Label>
            <Input
              id="linkedin_url"
              name="linkedin_url"
              placeholder="https://linkedin.com/in/jeandupont"
              value={formData.linkedin_url ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Site web</Label>
            <Input
              id="website"
              name="website"
              placeholder="https://exemple.com"
              value={formData.website ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* Location / City */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Localisation</Label>
              <Input
                id="location"
                name="location"
                placeholder="Paris, France"
                value={formData.location ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                name="city"
                placeholder="Paris"
                value={formData.city ?? ""}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Industry / Employee count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Secteur</Label>
              <Select
                value={formData.industry || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, industry: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Secteur d'activite" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INDUSTRIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taille entreprise</Label>
              <Select
                value={formData.employee_count || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, employee_count: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nb employes" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYEE_COUNTS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label} employes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (separes par des virgules)</Label>
            <Input
              id="tags"
              name="tags"
              placeholder="VIP, Hotel, Relance Q2"
              value={formData.tags ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {isEdit ? "Mise a jour..." : "Ajout..."}
                </>
              ) : isEdit ? (
                "Mettre a jour"
              ) : (
                "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
