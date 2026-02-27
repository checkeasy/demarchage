"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="size-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
          <p className="text-sm text-muted-foreground">
            Quelque chose s&apos;est mal passe. Essayez de recharger la page ou
            de retourner au tableau de bord.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Code: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RotateCcw className="size-4" />
            Reessayer
          </Button>
          <Button asChild className="gap-2">
            <Link href="/dashboard">
              <Home className="size-4" />
              Tableau de bord
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
