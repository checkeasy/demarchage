import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProspectDetail } from "@/components/prospects/ProspectDetail";

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProspectPage({ params }: ProspectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch prospect by ID
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !prospect) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prospects">
            <ArrowLeft className="size-4" />
            Retour aux prospects
          </Link>
        </Button>
      </div>

      <ProspectDetail prospect={prospect} />
    </div>
  );
}
