"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Building2,
  Briefcase,
  ExternalLink,
  UserPlus,
  Brain,
  Zap,
  Globe,
  Mail,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export interface LinkedInProfile {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  location: string;
  headline: string;
  profileUrl: string;
  profilePictureUrl?: string | null;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  relevanceScore: number;
  industry?: string;
  companySize?: string;
  connectionDegree?: string;
  summary?: string;
}

export interface EnrichmentData {
  website?: { websiteUrl: string; source: string; confidence: number };
  emails?: Array<{ email: string; score: number; category: string; source: string }>;
  loading?: boolean;
}

interface ProfileCardProps {
  profile: LinkedInProfile;
  isSelected: boolean;
  enrichment?: EnrichmentData;
  onToggleSelect: (id: string) => void;
  onAddToProspects: (profile: LinkedInProfile) => void;
  onAnalyze: (profile: LinkedInProfile) => void;
  onConnect: (profile: LinkedInProfile) => void;
  onEnrich: (profile: LinkedInProfile) => void;
  onSendEmail?: (profile: LinkedInProfile, email: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getEmailCategoryColor(category: string): string {
  if (category === "personal") return "bg-green-100 text-green-700";
  if (category === "role") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export function ProfileCard({
  profile,
  isSelected,
  enrichment,
  onToggleSelect,
  onAddToProspects,
  onAnalyze,
  onConnect,
  onEnrich,
  onSendEmail,
}: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false);

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email);
    toast.success("Email copie");
  }

  return (
    <Card
      className={`transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-blue-500 border-blue-300"
          : "hover:shadow-md"
      }`}
    >
      <CardContent className="pt-0">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(profile.id)}
              aria-label={`Selectionner ${profile.fullName}`}
            />
          </div>

          {/* Avatar */}
          <div className="shrink-0">
            <div className="size-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-lg overflow-hidden">
              {profile.profilePictureUrl || profile.avatarUrl ? (
                <img
                  src={profile.profilePictureUrl || profile.avatarUrl}
                  alt={profile.fullName}
                  className="size-full object-cover"
                />
              ) : (
                profile.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              )}
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/scraper/${profile.id}`}
                  className="text-base font-bold text-slate-900 hover:text-blue-600 hover:underline transition-colors"
                >
                  {profile.fullName}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-slate-700">{profile.jobTitle}</span>
                </div>
              </div>

              {/* Relevance score */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getScoreColor(
                  profile.relevanceScore
                )}`}
              >
                <div
                  className={`size-2 rounded-full ${getScoreBgColor(
                    profile.relevanceScore
                  )}`}
                />
                {profile.relevanceScore}/100
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5" />
                {profile.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {profile.location}
              </span>
              {profile.connectionDegree && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {profile.connectionDegree}
                </Badge>
              )}
            </div>

            {/* Headline */}
            <p className="text-sm text-slate-600 mt-2 line-clamp-2">
              {profile.headline}
            </p>

            {/* Enrichment results */}
            {enrichment && !enrichment.loading && (
              <div className="mt-2 space-y-1.5">
                {enrichment.website?.websiteUrl && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Globe className="size-3 text-blue-500" />
                    <a
                      href={enrichment.website.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate max-w-xs"
                    >
                      {enrichment.website.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  </div>
                )}
                {enrichment.emails && enrichment.emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {enrichment.emails.slice(0, 5).map((e) => (
                      <span
                        key={e.email}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 ${getEmailCategoryColor(e.category)}`}
                        onClick={() => copyEmail(e.email)}
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

            {/* Expanded details */}
            {expanded && profile.summary && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Resume</p>
                <p className="line-clamp-4">{profile.summary}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEnrich(profile)}
                disabled={enrichment?.loading}
              >
                {enrichment?.loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Globe className="size-3.5" />
                )}
                {enrichment?.emails ? `${enrichment.emails.length} emails` : "Enrichir"}
              </Button>
              {enrichment?.emails && enrichment.emails.length > 0 && onSendEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSendEmail(profile, enrichment.emails![0].email)}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Mail className="size-3.5" />
                  Envoyer email
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToProspects(profile)}
              >
                <UserPlus className="size-3.5" />
                Prospects
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAnalyze(profile)}
              >
                <Brain className="size-3.5" />
                Analyser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConnect(profile)}
              >
                <Zap className="size-3.5" />
                Connecter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>

              {profile.summary && (
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
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
