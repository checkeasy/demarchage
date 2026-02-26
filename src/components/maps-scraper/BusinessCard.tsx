"use client";

import { useState } from "react";
import {
  MapPin,
  Building2,
  Phone,
  Globe,
  Mail,
  Star,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  ExternalLink,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import type { GoogleMapsBusinessResult } from "@/lib/scraper/google-maps-scraper";

export interface BusinessEnrichmentData {
  emails?: Array<{
    email: string;
    score: number;
    category: string;
    source: string;
  }>;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerRole?: string | null;
  loading?: boolean;
}

interface BusinessCardProps {
  business: GoogleMapsBusinessResult;
  isSelected: boolean;
  enrichment?: BusinessEnrichmentData;
  onToggleSelect: (id: string) => void;
  onEnrich: (business: GoogleMapsBusinessResult) => void;
  onAddToProspects: (business: GoogleMapsBusinessResult) => void;
  onSendEmail?: (business: GoogleMapsBusinessResult, email: string) => void;
}

function getEmailCategoryColor(category: string): string {
  if (category === "personal") return "bg-green-100 text-green-700";
  if (category === "role") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function renderStars(rating: number | null) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const stars = [];

  for (let i = 0; i < full; i++) {
    stars.push(
      <Star key={`full-${i}`} className="size-3.5 fill-yellow-400 text-yellow-400" />
    );
  }
  if (hasHalf) {
    stars.push(
      <Star key="half" className="size-3.5 fill-yellow-200 text-yellow-400" />
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {stars}
      <span className="ml-1 text-xs font-medium text-slate-700">{rating}</span>
    </div>
  );
}

export function BusinessCard({
  business,
  isSelected,
  enrichment,
  onToggleSelect,
  onEnrich,
  onAddToProspects,
  onSendEmail,
}: BusinessCardProps) {
  const [expanded, setExpanded] = useState(false);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copie`);
  }

  const ownerName =
    enrichment?.ownerFirstName || enrichment?.ownerLastName
      ? `${enrichment.ownerFirstName || ""} ${enrichment.ownerLastName || ""}`.trim()
      : null;

  return (
    <Card
      className={`transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-green-500 border-green-300"
          : "hover:shadow-md"
      }`}
    >
      <CardContent className="pt-0">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(business.placeId)}
              aria-label={`Selectionner ${business.businessName}`}
            />
          </div>

          {/* Icon */}
          <div className="shrink-0">
            <div className="size-14 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <Building2 className="size-7" />
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {business.businessName}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {business.category && (
                    <Badge variant="secondary" className="text-[11px]">
                      {business.category}
                    </Badge>
                  )}
                  {renderStars(business.rating)}
                  {business.reviewCount && (
                    <span className="text-xs text-muted-foreground">
                      ({business.reviewCount} avis)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm text-muted-foreground">
              {business.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-red-400" />
                  <span className="truncate max-w-xs">{business.address}</span>
                </span>
              )}
              {business.phone && (
                <span
                  className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900"
                  onClick={() => copyToClipboard(business.phone!, "Telephone")}
                >
                  <Phone className="size-3.5 text-blue-400" />
                  {business.phone}
                  <Copy className="size-2.5 opacity-40" />
                </span>
              )}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Globe className="size-3.5" />
                  <span className="truncate max-w-[200px]">
                    {business.website.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                </a>
              )}
            </div>

            {/* Enrichment results */}
            {enrichment && !enrichment.loading && (
              <div className="mt-2 space-y-1.5">
                {/* Owner */}
                {ownerName && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="size-3 text-purple-500" />
                    <span className="font-medium text-purple-700">
                      {ownerName}
                    </span>
                    {enrichment.ownerRole && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200"
                      >
                        {enrichment.ownerRole}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Emails */}
                {enrichment.emails && enrichment.emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {enrichment.emails.slice(0, 5).map((e) => (
                      <span
                        key={e.email}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 ${getEmailCategoryColor(
                          e.category
                        )}`}
                        onClick={() => copyToClipboard(e.email, "Email")}
                        title={`Score: ${e.score}/100 | ${e.source} | Cliquer pour copier`}
                      >
                        <Mail className="size-2.5" />
                        {e.email}
                        <Copy className="size-2.5 opacity-50" />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expanded: show all info */}
            {expanded && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-1">
                {business.address && (
                  <p>
                    <strong>Adresse :</strong> {business.address}
                  </p>
                )}
                {business.phone && (
                  <p>
                    <strong>Telephone :</strong> {business.phone}
                  </p>
                )}
                {business.website && (
                  <p>
                    <strong>Site web :</strong> {business.website}
                  </p>
                )}
                {ownerName && (
                  <p>
                    <strong>Dirigeant :</strong> {ownerName}{" "}
                    {enrichment?.ownerRole && `(${enrichment.ownerRole})`}
                  </p>
                )}
                {business.rating && (
                  <p>
                    <strong>Note Google :</strong> {business.rating}/5
                    {business.reviewCount && ` (${business.reviewCount} avis)`}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEnrich(business)}
                disabled={enrichment?.loading || !business.website}
              >
                {enrichment?.loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Globe className="size-3.5" />
                )}
                {enrichment?.emails
                  ? `${enrichment.emails.length} emails`
                  : business.website
                    ? "Enrichir"
                    : "Pas de site web"}
              </Button>

              {enrichment?.emails &&
                enrichment.emails.length > 0 &&
                onSendEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onSendEmail(business, enrichment.emails![0].email)
                    }
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Mail className="size-3.5" />
                    Envoyer email
                  </Button>
                )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToProspects(business)}
              >
                <UserPlus className="size-3.5" />
                Prospects
              </Button>

              {business.googleMapsUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={business.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}

              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-700 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-3" />
                    Moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3" />
                    Plus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
