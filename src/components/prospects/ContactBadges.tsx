"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

type BadgeCategory = {
  prefix: string;
  label: string;
  exclusive: boolean;
  values: { value: string; label: string; classes: string }[];
};

const BADGE_CATEGORIES: BadgeCategory[] = [
  {
    prefix: "contact-type",
    label: "Type de contact",
    exclusive: true,
    values: [
      {
        value: "prospect",
        label: "Prospect",
        classes: "bg-blue-100 text-blue-700 border-blue-200",
      },
      {
        value: "client",
        label: "Client",
        classes: "bg-green-100 text-green-700 border-green-200",
      },
      {
        value: "partenaire",
        label: "Partenaire",
        classes: "bg-purple-100 text-purple-700 border-purple-200",
      },
      {
        value: "mauvaise-cible",
        label: "Mauvaise cible",
        classes: "bg-red-100 text-red-700 border-red-200",
      },
    ],
  },
  {
    prefix: "temp",
    label: "Temperature",
    exclusive: true,
    values: [
      {
        value: "froid",
        label: "Froid",
        classes: "bg-slate-100 text-slate-600 border-slate-200",
      },
      {
        value: "tiede",
        label: "Tiede",
        classes: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      {
        value: "chaud",
        label: "Chaud",
        classes: "bg-orange-100 text-orange-700 border-orange-200",
      },
      {
        value: "brulant",
        label: "Brulant",
        classes: "bg-red-100 text-red-600 border-red-200",
      },
    ],
  },
  {
    prefix: "action",
    label: "Action",
    exclusive: false,
    values: [
      {
        value: "a-relancer",
        label: "A relancer",
        classes: "bg-amber-100 text-amber-700 border-amber-200",
      },
      {
        value: "rdv-planifie",
        label: "RDV planifie",
        classes: "bg-indigo-100 text-indigo-700 border-indigo-200",
      },
      {
        value: "en-nego",
        label: "En nego",
        classes: "bg-violet-100 text-violet-700 border-violet-200",
      },
      {
        value: "a-rappeler",
        label: "A rappeler",
        classes: "bg-cyan-100 text-cyan-700 border-cyan-200",
      },
    ],
  },
  {
    prefix: "contact-source",
    label: "Source",
    exclusive: false,
    values: [
      {
        value: "linkedin",
        label: "LinkedIn",
        classes: "bg-blue-100 text-blue-800 border-blue-200",
      },
      {
        value: "google-maps",
        label: "Maps",
        classes: "bg-green-100 text-green-800 border-green-200",
      },
      {
        value: "referral",
        label: "Referral",
        classes: "bg-teal-100 text-teal-700 border-teal-200",
      },
      {
        value: "inbound",
        label: "Inbound",
        classes: "bg-pink-100 text-pink-700 border-pink-200",
      },
    ],
  },
];

// Build a flat lookup: "contact-type:prospect" -> { label, classes }
const BADGE_LOOKUP: Record<string, { label: string; classes: string }> = {};
for (const cat of BADGE_CATEGORIES) {
  for (const v of cat.values) {
    BADGE_LOOKUP[`${cat.prefix}:${v.value}`] = {
      label: v.label,
      classes: v.classes,
    };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContactBadgesProps {
  tags: string[];
  onUpdate?: (newTags: string[]) => Promise<void>;
  compact?: boolean;
}

export default function ContactBadges({
  tags,
  onUpdate,
  compact = false,
}: ContactBadgesProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Only keep tags that match known badge definitions
  const knownTags = tags.filter((t) => BADGE_LOOKUP[t]);

  const displayTags = compact ? knownTags.slice(0, 3) : knownTags;
  const overflowCount = compact ? Math.max(0, knownTags.length - 3) : 0;

  // ------- handlers -------

  const handleRemove = async (tagToRemove: string) => {
    if (!onUpdate || updating) return;
    setUpdating(true);
    try {
      await onUpdate(tags.filter((t) => t !== tagToRemove));
    } finally {
      setUpdating(false);
    }
  };

  const handleToggle = async (category: BadgeCategory, value: string) => {
    if (!onUpdate || updating) return;
    const fullTag = `${category.prefix}:${value}`;
    const isPresent = tags.includes(fullTag);

    let newTags: string[];

    if (isPresent) {
      // Remove it
      newTags = tags.filter((t) => t !== fullTag);
    } else if (category.exclusive) {
      // Remove any existing tag from same category, then add new one
      newTags = [
        ...tags.filter((t) => !t.startsWith(`${category.prefix}:`)),
        fullTag,
      ];
    } else {
      // Simply add
      newTags = [...tags, fullTag];
    }

    setUpdating(true);
    try {
      await onUpdate(newTags);
    } finally {
      setUpdating(false);
    }
  };

  // ------- render -------

  return (
    <div className="flex flex-wrap items-center gap-1">
      {displayTags.map((tag) => {
        const info = BADGE_LOOKUP[tag];
        if (!info) return null;
        return (
          <Badge
            key={tag}
            variant="outline"
            className={`group relative text-xs px-2 py-0.5 ${info.classes}`}
          >
            {info.label}
            {onUpdate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(tag);
                }}
                className="ml-1 hidden group-hover:inline-flex items-center justify-center rounded-full w-3.5 h-3.5 hover:bg-black/10"
                disabled={updating}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </Badge>
        );
      })}

      {overflowCount > 0 && (
        <span className="text-xs text-muted-foreground">
          +{overflowCount}
        </span>
      )}

      {onUpdate && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              {BADGE_CATEGORIES.map((cat) => (
                <div key={cat.prefix}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {cat.label}
                    {cat.exclusive && (
                      <span className="ml-1 opacity-50">(exclusif)</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cat.values.map((v) => {
                      const fullTag = `${cat.prefix}:${v.value}`;
                      const active = tags.includes(fullTag);
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => handleToggle(cat, v.value)}
                          disabled={updating}
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-colors ${
                            active
                              ? `${v.classes} font-medium ring-1 ring-offset-1 ring-current`
                              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
