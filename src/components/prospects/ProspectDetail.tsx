"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Building2,
  Briefcase,
  Phone,
  Linkedin,
  Globe,
  MapPin,
  Calendar,
  Pencil,
  X,
  Clock,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { prospectSchema, type ProspectFormData } from "@/lib/validations";
import { PROSPECT_STATUSES } from "@/lib/constants";
import type { Prospect } from "@/lib/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProspectStatus = keyof typeof PROSPECT_STATUSES;

interface ProspectDetailProps {
  prospect: Prospect;
}

export function ProspectDetail({ prospect }: ProspectDetailProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProspectFormData>({
    email: prospect.email,
    first_name: prospect.first_name ?? "",
    last_name: prospect.last_name ?? "",
    company: prospect.company ?? "",
    job_title: prospect.job_title ?? "",
    phone: prospect.phone ?? "",
    linkedin_url: prospect.linkedin_url ?? "",
    website: prospect.website ?? "",
    location: prospect.location ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    setFormData({
      email: prospect.email,
      first_name: prospect.first_name ?? "",
      last_name: prospect.last_name ?? "",
      company: prospect.company ?? "",
      job_title: prospect.job_title ?? "",
      phone: prospect.phone ?? "",
      linkedin_url: prospect.linkedin_url ?? "",
      website: prospect.website ?? "",
      location: prospect.location ?? "",
    });
    setErrors({});
  }

  async function handleSave() {
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

    const cleaned: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(result.data)) {
      cleaned[key] = value && value.trim() !== "" ? value.trim() : null;
    }

    const { error } = await supabase
      .from("prospects")
      .update(cleaned)
      .eq("id", prospect.id);

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors de la mise a jour du prospect");
      return;
    }

    toast.success("Prospect mis a jour");
    setIsEditing(false);
    router.refresh();
  }

  const statusConfig = PROSPECT_STATUSES[prospect.status as ProspectStatus];

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const infoFields = [
    {
      icon: Mail,
      label: "Email",
      field: "email" as const,
      value: prospect.email,
      type: "email",
    },
    {
      icon: Building2,
      label: "Entreprise",
      field: "company" as const,
      value: prospect.company,
      type: "text",
    },
    {
      icon: Briefcase,
      label: "Poste",
      field: "job_title" as const,
      value: prospect.job_title,
      type: "text",
    },
    {
      icon: Phone,
      label: "Telephone",
      field: "phone" as const,
      value: prospect.phone,
      type: "tel",
    },
    {
      icon: Linkedin,
      label: "LinkedIn",
      field: "linkedin_url" as const,
      value: prospect.linkedin_url,
      type: "url",
    },
    {
      icon: Globe,
      label: "Site web",
      field: "website" as const,
      value: prospect.website,
      type: "url",
    },
    {
      icon: MapPin,
      label: "Localisation",
      field: "location" as const,
      value: prospect.location,
      type: "text",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  name="first_name"
                  placeholder="Prenom"
                  value={formData.first_name ?? ""}
                  onChange={handleChange}
                  className="w-40"
                  disabled={isLoading}
                />
                <Input
                  name="last_name"
                  placeholder="Nom"
                  value={formData.last_name ?? ""}
                  onChange={handleChange}
                  className="w-40"
                  disabled={isLoading}
                />
              </div>
            ) : (
              [prospect.first_name, prospect.last_name]
                .filter(Boolean)
                .join(" ") || "Sans nom"
            )}
          </h3>
          {!isEditing && (
            <p className="text-sm text-muted-foreground mt-1">
              {prospect.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusConfig && (
            <Badge variant="secondary" className="gap-1.5">
              <span className={`size-1.5 rounded-full ${statusConfig.color}`} />
              {statusConfig.label}
            </Badge>
          )}
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={isLoading}
              >
                <X className="size-4" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-4" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Info fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {infoFields.map(({ icon: Icon, label, field, value, type }) => (
            <div key={field} className="flex items-center gap-3">
              <Icon className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                {isEditing ? (
                  <div className="mt-1">
                    <Input
                      name={field}
                      type={type}
                      value={(formData[field] as string) ?? ""}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-8 text-sm"
                    />
                    {errors[field] && (
                      <p className="text-xs text-destructive mt-1">
                        {errors[field]}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm truncate">
                    {value ? (
                      type === "url" ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : type === "email" ? (
                        <a
                          href={`mailto:${value}`}
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        value
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadonnees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date de creation</p>
              <p className="text-sm">{formatDate(prospect.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Derniere modification</p>
              <p className="text-sm">{formatDate(prospect.updated_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Send className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Dernier contact</p>
              <p className="text-sm">
                {formatDate(prospect.last_contacted_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4 text-center">
              Src
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-sm capitalize">{prospect.source.replace("_", " ")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity timeline placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activite</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              L&apos;historique d&apos;activite apparaitra ici une fois que des
              emails auront ete envoyes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Campaign enrollment placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campagnes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Send className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Ce prospect n&apos;est inscrit dans aucune campagne pour le moment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
