import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScraperProfileNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Search className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Profil introuvable
        </h2>
        <p className="text-muted-foreground">
          Ce profil n&apos;existe pas ou a ete supprime.
        </p>
        <Button asChild>
          <Link href="/scraper">Retour au Scraper</Link>
        </Button>
      </div>
    </div>
  );
}
