"use client";

import { useState } from "react";
import { Search, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MapsSearchFilters {
  query: string;
  location: string;
}

interface MapsSearchFormProps {
  onSearch: (filters: MapsSearchFilters) => void;
  isLoading: boolean;
}

export function MapsSearchForm({ onSearch, isLoading }: MapsSearchFormProps) {
  const [filters, setFilters] = useState<MapsSearchFilters>({
    query: "",
    location: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filters.query.trim()) {
      onSearch(filters);
    }
  }

  function handleReset() {
    setFilters({ query: "", location: "" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maps-query">Type d&apos;entreprise</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="maps-query"
              placeholder="Ex: Conciergerie, Plombier, Restaurant..."
              value={filters.query}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
              }
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maps-location">Localisation</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="maps-location"
              placeholder="Ex: Marseille, Paris, Lyon..."
              value={filters.location}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, location: e.target.value }))
              }
              className="pl-10"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isLoading || !filters.query.trim()}
          className="min-w-[180px]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Recherche en cours...
            </div>
          ) : (
            <>
              <Search className="size-4" />
              Rechercher sur Maps
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
