import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeEmail,
  extractDomain,
  normalizePhone,
  normalizeCompanyName,
} from "@/lib/utils/dedup-utils";

interface ProspectRecord {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  organization: string | null;
  website: string | null;
  phone: string | null;
  source: string | null;
  tags: string[];
  created_at: string;
}

interface DuplicateGroup {
  id: string;
  reason: "email" | "website" | "phone" | "company";
  confidence: "high" | "medium";
  prospects: ProspectRecord[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    // Get workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Aucun workspace trouve" },
        { status: 400 }
      );
    }

    const workspaceId = membership.workspace_id;

    // Fetch all prospects in batches (Supabase returns max 1000 by default)
    const allProspects: ProspectRecord[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("prospects")
        .select(
          "id, email, first_name, last_name, company, organization, website, phone, source, tags, created_at"
        )
        .eq("workspace_id", workspaceId)
        .range(offset, offset + PAGE_SIZE - 1)
        .order("created_at", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        allProspects.push({
          ...row,
          tags: row.tags || [],
        });
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allProspects.length < 2) {
      return NextResponse.json({
        groups: [],
        total_groups: 0,
        total_affected: 0,
      });
    }

    // Build indexes
    const emailIndex = new Map<string, ProspectRecord[]>();
    const phoneIndex = new Map<string, ProspectRecord[]>();
    const domainIndex = new Map<string, ProspectRecord[]>();
    const companyIndex = new Map<string, ProspectRecord[]>();

    for (const p of allProspects) {
      // Email index
      const normEmail = normalizeEmail(p.email || "");
      if (normEmail) {
        if (!emailIndex.has(normEmail)) emailIndex.set(normEmail, []);
        emailIndex.get(normEmail)!.push(p);
      }

      // Phone index
      const normPhone = normalizePhone(p.phone || "");
      if (normPhone) {
        if (!phoneIndex.has(normPhone)) phoneIndex.set(normPhone, []);
        phoneIndex.get(normPhone)!.push(p);
      }

      // Domain index
      const domain = extractDomain(p.website || "");
      if (domain) {
        if (!domainIndex.has(domain)) domainIndex.set(domain, []);
        domainIndex.get(domain)!.push(p);
      }

      // Company index
      const companyName = p.organization || p.company || "";
      const normCompany = normalizeCompanyName(companyName);
      if (normCompany.length >= 2) {
        if (!companyIndex.has(normCompany)) companyIndex.set(normCompany, []);
        companyIndex.get(normCompany)!.push(p);
      }
    }

    // Collect raw groups (strongest match first)
    type RawGroup = {
      reason: DuplicateGroup["reason"];
      confidence: DuplicateGroup["confidence"];
      prospects: ProspectRecord[];
    };

    const rawGroups: RawGroup[] = [];

    // Email groups (high confidence)
    emailIndex.forEach((prospects) => {
      if (prospects.length >= 2) {
        rawGroups.push({ reason: "email", confidence: "high", prospects });
      }
    });

    // Phone groups (high confidence)
    phoneIndex.forEach((prospects) => {
      if (prospects.length >= 2) {
        rawGroups.push({ reason: "phone", confidence: "high", prospects });
      }
    });

    // Domain groups (medium confidence)
    domainIndex.forEach((prospects) => {
      if (prospects.length >= 2) {
        rawGroups.push({ reason: "website", confidence: "medium", prospects });
      }
    });

    // Company groups (medium confidence)
    companyIndex.forEach((prospects) => {
      if (prospects.length >= 2) {
        rawGroups.push({ reason: "company", confidence: "medium", prospects });
      }
    });

    // Deduplicate: each prospect should only appear in one group
    // Priority: email > phone > domain > company (already ordered)
    const assignedProspectIds = new Set<string>();
    const finalGroups: DuplicateGroup[] = [];

    for (const group of rawGroups) {
      const unassigned = group.prospects.filter(
        (p) => !assignedProspectIds.has(p.id)
      );

      if (unassigned.length >= 2) {
        const groupId = unassigned[0].id;
        for (const p of unassigned) {
          assignedProspectIds.add(p.id);
        }
        finalGroups.push({
          id: groupId,
          reason: group.reason,
          confidence: group.confidence,
          prospects: unassigned,
        });
      }
    }

    const totalAffected = finalGroups.reduce(
      (sum, g) => sum + g.prospects.length,
      0
    );

    return NextResponse.json({
      groups: finalGroups,
      total_groups: finalGroups.length,
      total_affected: totalAffected,
    });
  } catch (err) {
    console.error("[API Find Duplicates] Error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
