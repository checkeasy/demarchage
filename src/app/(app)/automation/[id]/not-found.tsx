import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AutomationNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Bot className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Sequence introuvable
        </h2>
        <p className="text-muted-foreground">
          Cette sequence d&apos;automation n&apos;existe pas ou a ete supprimee.
        </p>
        <Button asChild>
          <Link href="/automation">Retour aux Automations</Link>
        </Button>
      </div>
    </div>
  );
}
