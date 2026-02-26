import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProductContext } from "@/lib/ai/prompts";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface PerformanceStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  openRate: string;
  clickRate: string;
  replyRate: string;
}

interface TopEmail {
  subject: string;
  openedAt: string | null;
  repliedAt: string | null;
  clickedAt: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { recipient, context, campaignId, prospectData } =
      await request.json();

    if (!recipient) {
      return NextResponse.json(
        { error: "recipient est requis" },
        { status: 400 }
      );
    }

    // 1. Load workspace AI context
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    let companyContext = "";
    let aiTone = "semi-formel";
    let companyName = "";
    let targetAudience = "";

    if (workspaceId) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("name, ai_company_context, settings")
        .eq("id", workspaceId)
        .single();

      if (workspace) {
        companyContext = workspace.ai_company_context || "";
        companyName = workspace.name || "";
        const settings = workspace.settings as Record<string, unknown> | null;
        if (settings) {
          aiTone = (settings.ai_tone as string) || "semi-formel";
          targetAudience =
            (settings.ai_target_audience as string) || "";
        }
      }
    }

    // 2. Load performance stats (global or per-campaign)
    const adminSupabase = createAdminClient();
    let stats: PerformanceStats | null = null;
    let topEmails: TopEmail[] = [];

    if (workspaceId) {
      const statsQuery = campaignId
        ? adminSupabase
            .from("emails_sent")
            .select(
              "id, opened_at, clicked_at, replied_at, campaign_prospects!inner(campaign_id)"
            )
            .eq("campaign_prospects.campaign_id", campaignId)
        : adminSupabase
            .from("emails_sent")
            .select(
              "id, opened_at, clicked_at, replied_at, campaign_prospects!inner(campaigns!inner(workspace_id))"
            )
            .eq(
              "campaign_prospects.campaigns.workspace_id",
              workspaceId
            );

      const { data: emailStats } = await statsQuery;

      if (emailStats && emailStats.length > 0) {
        const totalSent = emailStats.length;
        const totalOpened = emailStats.filter(
          (e) => e.opened_at !== null
        ).length;
        const totalClicked = emailStats.filter(
          (e) => e.clicked_at !== null
        ).length;
        const totalReplied = emailStats.filter(
          (e) => e.replied_at !== null
        ).length;

        stats = {
          totalSent,
          totalOpened,
          totalClicked,
          totalReplied,
          openRate:
            totalSent > 0
              ? ((totalOpened / totalSent) * 100).toFixed(1)
              : "0",
          clickRate:
            totalSent > 0
              ? ((totalClicked / totalSent) * 100).toFixed(1)
              : "0",
          replyRate:
            totalSent > 0
              ? ((totalReplied / totalSent) * 100).toFixed(1)
              : "0",
        };
      }

      // 3. Load top performing emails (replied > clicked > opened)
      const { data: bestEmails } = await adminSupabase
        .from("emails_sent")
        .select(
          "subject, opened_at, clicked_at, replied_at, campaign_prospects!inner(campaigns!inner(workspace_id))"
        )
        .eq("campaign_prospects.campaigns.workspace_id", workspaceId)
        .not("subject", "is", null)
        .order("replied_at", { ascending: false, nullsFirst: false })
        .limit(5);

      if (bestEmails && bestEmails.length > 0) {
        topEmails = bestEmails
          .filter((e) => e.replied_at || e.clicked_at || e.opened_at)
          .slice(0, 3)
          .map((e) => ({
            subject: e.subject || "",
            openedAt: e.opened_at,
            repliedAt: e.replied_at,
            clickedAt: e.clicked_at,
          }));
      }
    }

    // 4. Build the enriched prompt
    const productContext = buildProductContext(companyContext);

    let prompt = `Tu es un expert en cold emailing B2B en France. Genere un email de prospection personnalise.

## QUI NOUS SOMMES
${companyName ? `Entreprise : ${companyName}` : ""}
${productContext}
${targetAudience ? `\nAudience cible : ${targetAudience}` : ""}

## DESTINATAIRE
- Prenom : ${recipient.firstName || ""}
- Nom : ${recipient.lastName || ""}
- Poste : ${recipient.jobTitle || ""}
- Entreprise : ${recipient.company || ""}`;

    // Add scraped prospect data if available
    if (prospectData) {
      prompt += `\n\n## DONNEES ENRICHIES SUR L'ENTREPRISE DU PROSPECT`;
      if (prospectData.companyDescription) {
        prompt += `\nDescription : ${prospectData.companyDescription}`;
      }
      if (prospectData.productsServices?.length > 0) {
        prompt += `\nProduits/Services : ${prospectData.productsServices.join(", ")}`;
      }
      if (prospectData.industry) {
        prompt += `\nSecteur : ${prospectData.industry}`;
      }
      if (prospectData.painPoints?.length > 0) {
        prompt += `\nPoints de douleur identifies : ${prospectData.painPoints.map((p: { pain_point?: string }) => p.pain_point || p).join(", ")}`;
      }
      if (prospectData.companySize) {
        prompt += `\nTaille estimee : ${prospectData.companySize} employes`;
      }
    }

    // Add performance insights
    if (stats && stats.totalSent >= 5) {
      prompt += `\n\n## PERFORMANCE DE NOS EMAILS PRECEDENTS
- ${stats.totalSent} emails envoyes au total
- Taux d'ouverture : ${stats.openRate}% (${stats.totalOpened} ouverts)
- Taux de clic : ${stats.clickRate}% (${stats.totalClicked} clics)
- Taux de reponse : ${stats.replyRate}% (${stats.totalReplied} reponses)`;

      if (parseFloat(stats.openRate) < 20) {
        prompt += `\n\nATTENTION : Le taux d'ouverture est faible. Concentre-toi sur un objet TRES accrocheur et court (max 5-7 mots).`;
      }
      if (parseFloat(stats.replyRate) < 5 && stats.totalSent >= 20) {
        prompt += `\nATTENTION : Peu de reponses. Pose une question TRES specifique et facile a repondre en fin d'email.`;
      }
      if (parseFloat(stats.openRate) > 40) {
        prompt += `\n\nBON : Le taux d'ouverture est bon. Continue sur cette lancee avec des objets similaires.`;
      }
    }

    // Add top performing email examples
    if (topEmails.length > 0) {
      prompt += `\n\n## EXEMPLES D'EMAILS QUI ONT FONCTIONNE
Voici les objets de nos emails qui ont eu les meilleurs resultats. Inspire-toi du style et du ton :`;
      topEmails.forEach((e, i) => {
        const result = e.repliedAt
          ? "reponse recue"
          : e.clickedAt
            ? "clic"
            : "ouvert";
        prompt += `\n${i + 1}. Objet : "${e.subject}" (${result})`;
      });
    }

    // Add context
    prompt += `\n\n## CONTEXTE
${context || "Premier contact de prospection"}`;

    // Add rules
    const toneMap: Record<string, string> = {
      formel: "tres professionnel et formel, vouvoiement strict",
      "semi-formel":
        "professionnel mais chaleureux, vouvoiement avec touche humaine",
      decontracte:
        "decontracte et direct, tutoiement possible si le secteur le permet",
    };

    prompt += `\n\n## REGLES
- Ton : ${toneMap[aiTone] || toneMap["semi-formel"]}
- Ecris en francais naturel (pas de jargon marketing)
- Sois concis (max 150 mots)
- Commence par "Bonjour ${recipient.firstName || ""}"
- Pose UNE question ouverte a la fin liee a un probleme concret du prospect
- Pas de flatterie excessive
- Propose de la valeur concrete et specifique
- L'email doit donner l'impression d'etre ecrit a la main, pas genere par une IA
- Si des donnees sur l'entreprise du prospect sont disponibles, utilise-les pour personnaliser le message
- Le CTA doit etre simple (repondre a l'email, pas un lien)

Reponds UNIQUEMENT en JSON valide avec ce format :
{"subject": "...", "body": "..."}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "system",
          content:
            "Tu reponds uniquement en JSON valide. Pas de markdown, pas de texte supplementaire. Tu es le meilleur copywriter de cold email en France.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Pas de reponse de l'IA" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      subject: parsed.subject,
      body: parsed.body,
      metadata: {
        hasCompanyContext: !!companyContext,
        hasPerformanceData: !!stats,
        hasProspectData: !!prospectData,
        topEmailsUsed: topEmails.length,
        tone: aiTone,
      },
    });
  } catch (err) {
    console.error("[API generate-email] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation" },
      { status: 500 }
    );
  }
}
