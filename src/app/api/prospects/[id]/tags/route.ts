import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prospectId } = await params;
    const { add, remove }: { add?: string[]; remove?: string[] } =
      await request.json();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve workspace from user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_workspace_id) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    const workspaceId = profile.current_workspace_id;

    const { data: prospect, error: fetchError } = await supabase
      .from("prospects")
      .select("id, tags")
      .eq("id", prospectId)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    let tags: string[] = Array.isArray(prospect.tags) ? [...prospect.tags] : [];

    // Mutually exclusive prefix handling for adds
    const exclusivePrefixes = ["contact-type:", "temp:"];
    if (add?.length) {
      for (const tag of add) {
        const matchedPrefix = exclusivePrefixes.find((p) => tag.startsWith(p));
        if (matchedPrefix) {
          tags = tags.filter((t) => !t.startsWith(matchedPrefix));
        }
      }
    }

    // Remove tags
    if (remove?.length) {
      const removeSet = new Set(remove);
      tags = tags.filter((t) => !removeSet.has(t));
    }

    // Add tags (avoid duplicates)
    if (add?.length) {
      const existing = new Set(tags);
      for (const tag of add) {
        if (!existing.has(tag)) {
          tags.push(tag);
        }
      }
    }

    const { error: updateError } = await supabase
      .from("prospects")
      .update({ tags })
      .eq("id", prospectId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update tags" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tags });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
