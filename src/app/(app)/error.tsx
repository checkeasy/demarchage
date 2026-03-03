"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Home, Copy } from "lucide-react";
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
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">Une erreur est survenue</CardTitle>
          <CardDescription>
            Quelque chose s&apos;est mal passe. Vous pouvez reessayer ou
            retourner au tableau de bord.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {error.message && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Details de l&apos;erreur
              </p>
              <p className="text-sm font-mono break-all">{error.message}</p>
            </div>
          )}

          {error.digest && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-0.5">
                  Code de reference
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {error.digest}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(error.digest || "");
                }}
              >
                <Copy className="size-3.5" />
                <span className="sr-only">Copier le code</span>
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} variant="outline" className="w-full sm:w-auto gap-2">
            <RotateCcw className="size-4" />
            Reessayer
          </Button>
          <Button asChild className="w-full sm:w-auto gap-2">
            <Link href="/dashboard">
              <Home className="size-4" />
              Retour au Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
