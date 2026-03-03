import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Page introuvable</h2>
        <p className="text-muted-foreground">
          La page que vous recherchez n&apos;existe pas ou a ete deplacee.
        </p>
        <Button asChild>
          <Link href="/dashboard">Retour au Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
