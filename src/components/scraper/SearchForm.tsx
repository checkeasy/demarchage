"use client";

import { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
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

const INDUSTRIES = [
  { value: "btp", label: "BTP / Construction" },
  { value: "sante", label: "Sante" },
  { value: "restauration", label: "Restauration" },
  { value: "commerce", label: "Commerce" },
  { value: "services", label: "Services" },
  { value: "tech", label: "Tech / IT" },
  { value: "immobilier", label: "Immobilier" },
  { value: "juridique", label: "Juridique" },
  { value: "finance", label: "Finance / Assurance" },
  { value: "education", label: "Education / Formation" },
  { value: "transport", label: "Transport / Logistique" },
  { value: "industrie", label: "Industrie / Manufacturing" },
  { value: "agriculture", label: "Agriculture" },
  { value: "energie", label: "Energie" },
  { value: "media", label: "Media / Communication" },
  { value: "conseil", label: "Conseil" },
  { value: "rh", label: "Ressources Humaines" },
  { value: "autre", label: "Autre" },
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employes" },
  { value: "11-50", label: "11-50 employes" },
  { value: "51-200", label: "51-200 employes" },
  { value: "201-500", label: "201-500 employes" },
  { value: "500+", label: "500+ employes" },
];

export interface SearchFilters {
  keywords: string;
  jobTitle: string;
  location: string;
  industry: string;
  companySize: string;
}

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    keywords: "",
    jobTitle: "",
    location: "",
    industry: "",
    companySize: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(filters);
  }

  function handleReset() {
    setFilters({
      keywords: "",
      jobTitle: "",
      location: "",
      industry: "",
      companySize: "",
    });
  }

  function updateFilter(key: keyof SearchFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Main search fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="keywords">Mots-cles</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="keywords"
              placeholder="Ex: directeur, manager, consultant..."
              value={filters.keywords}
              onChange={(e) => updateFilter("keywords", e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">Poste / Titre</Label>
          <Input
            id="jobTitle"
            placeholder="Ex: Directeur General, CEO, Gerant..."
            value={filters.jobTitle}
            onChange={(e) => updateFilter("jobTitle", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Localisation</Label>
          <Input
            id="location"
            placeholder="Ex: France, Paris, Lyon..."
            value={filters.location}
            onChange={(e) => updateFilter("location", e.target.value)}
          />
        </div>
      </div>

      {/* Advanced filters toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-900 transition-colors"
      >
        {showAdvanced ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
        Filtres avances
      </button>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <Label>Secteur d&apos;activite</Label>
            <Select
              value={filters.industry}
              onValueChange={(value) => updateFilter("industry", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous les secteurs" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((industry) => (
                  <SelectItem key={industry.value} value={industry.value}>
                    {industry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Taille entreprise</Label>
            <Select
              value={filters.companySize}
              onValueChange={(value) => updateFilter("companySize", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toutes les tailles" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isLoading} className="min-w-[140px]">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Recherche...
            </div>
          ) : (
            <>
              <Search className="size-4" />
              Rechercher
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-900 transition-colors"
        >
          <RotateCcw className="size-3.5" />
          Reinitialiser
        </button>
      </div>
    </form>
  );
}
