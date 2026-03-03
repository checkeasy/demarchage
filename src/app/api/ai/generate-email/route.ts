import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProductContext } from "@/lib/ai/prompts";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";

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

    const { recipient, context, campaignId, prospectData, emailAccountId } =
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

    // 4. Load booking URL from email account
    let bookingUrl = "";
    if (emailAccountId && workspaceId) {
      const { data: emailAccount } = await adminSupabase
        .from("email_accounts")
        .select("booking_url")
        .eq("id", emailAccountId)
        .eq("workspace_id", workspaceId)
        .single();
      if (emailAccount?.booking_url) {
        bookingUrl = emailAccount.booking_url;
      }
    }

    // 5. Build the enriched prompt
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
      formel: "respectueux et pro, vouvoiement, mais toujours humain et accessible",
      "semi-formel":
        "sympa et chaleureux, vouvoiement, comme un message ecrit par un vrai humain",
      decontracte:
        "decontracte et direct, tutoiement possible si le secteur le permet",
    };

    prompt += `\n\n## STYLE D'ECRITURE (TRES IMPORTANT)
Ecris comme un vrai humain. L'email doit ressembler a un message tape a la main, pas a un template marketing. INTERDIT d'utiliser des tirets (-), des listes a puces, des bullet points ou toute mise en forme "robot". Ecris en paragraphes courts et naturels. Le ton est ${toneMap[aiTone] || toneMap["semi-formel"]}.

## REGLES
Ecris en francais simple et naturel, pas de jargon marketing. Max 150 mots. Commence par "Bonjour ${recipient.firstName || ""}". Termine par UNE question ouverte liee a un vrai probleme du prospect. Pas de flatterie. Base-toi UNIQUEMENT sur les infos du contexte produit ci-dessus, ne cite JAMAIS de tarifs ou chiffres qui n'y figurent pas. Utilise les donnees du prospect pour personnaliser. Le CTA est simple : repondre a l'email ou prendre rendez-vous si un lien est fourni.${bookingUrl ? `

Tu as un lien de prise de rendez-vous : ${bookingUrl}
Propose-le quand c'est pertinent (relances, quand le prospect semble interesse). Pas besoin de le mettre a chaque email, reste naturel. Quand tu l'inclus, glisse-le en fin de message (ex: "Si ca vous dit d'en discuter, voici un lien pour caler un creneau : ${bookingUrl}").` : ""}

Reponds UNIQUEMENT en JSON valide avec ce format :
{"subject": "...", "body": "..."}`;

    const response = await getAnthropic().messages.create({
      model: CLAUDE_HAIKU,
      system: "Tu reponds uniquement en JSON valide. Pas de markdown, pas de texte supplementaire. Tu ecris comme un vrai humain, jamais comme un robot. Tes emails sont simples, sympas, sans listes a puces ni tirets. Tu es le meilleur copywriter de cold email en France.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = extractTextContent(response);
    if (!content) {
      return NextResponse.json(
        { error: "Pas de reponse de l'IA" },
        { status: 500 }
      );
    }

    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[API generate-email] JSON parse error:", content.slice(0, 500));
      return NextResponse.json(
        { error: "Erreur de parsing de la reponse IA" },
        { status: 500 }
      );
    }

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
