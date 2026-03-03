import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProspectNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <UserX className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Prospect introuvable
        </h2>
        <p className="text-muted-foreground">
          Ce prospect n&apos;existe pas ou a ete supprime.
        </p>
        <Button asChild>
          <Link href="/prospects">Retour aux Prospects</Link>
        </Button>
      </div>
    </div>
  );
}
