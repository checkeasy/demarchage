import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";
import { sendEmail } from "@/lib/email/resend-client";

interface RecapResult {
  title: string;
  url: string | null;
  snippet: string | null;
  source: string;
  relevance_score: number;
  prospect_id: string | null;
  web_watches?: { topic: string };
}

/**
 * Generate AI-powered daily recap and send via email
 */
export async function sendDailyRecap(workspaceId: string): Promise<{
  sent: boolean;
  resultsCount: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  // 1. Get today's results (last 24h)
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data: results } = await supabase
    .from("web_watch_results")
    .select("title, url, snippet, source, relevance_score, prospect_id, web_watches(topic)")
    .eq("workspace_id", workspaceId)
    .gte("detected_at", since.toISOString())
    .order("relevance_score", { ascending: false });

  if (!results || results.length === 0) {
    return { sent: false, resultsCount: 0 };
  }

  // 2. Get user email (from auth.users via profiles)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("current_workspace_id", workspaceId)
    .limit(1)
    .single();

  if (!profile?.id) {
    return { sent: false, resultsCount: results.length, error: "No profile found" };
  }

  // Get email from auth.users
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
  const email = authUser?.email;

  if (!email) {
    return { sent: false, resultsCount: results.length, error: "No email found" };
  }

  // 3. Generate AI recap
  const recapResults = results as unknown as RecapResult[];
  const recapText = await generateRecapWithAI(recapResults);

  // 4. Build email HTML
  const html = buildRecapEmail(
    profile.full_name || authUser?.user_metadata?.full_name || "Bonjour",
    recapResults,
    recapText,
    workspaceId
  );

  // 5. Send email
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const highRelevance = recapResults.filter((r) => r.relevance_score >= 70).length;
  const subject = highRelevance > 0
    ? `Veille Web ${today} — ${highRelevance} alerte${highRelevance > 1 ? "s" : ""} importante${highRelevance > 1 ? "s" : ""}`
    : `Veille Web ${today} — ${results.length} resultat${results.length > 1 ? "s" : ""}`;

  const emailResult = await sendEmail({
    from: "ColdReach <noreply@send.checkeasy.co>",
    to: email,
    subject,
    html,
    text: recapText,
  });

  // 6. Mark results as read
  const resultIds = recapResults.map((r) => (r as unknown as { id: string }).id).filter(Boolean);
  if (resultIds.length > 0) {
    await supabase
      .from("web_watch_results")
      .update({ is_read: true })
      .eq("workspace_id", workspaceId)
      .in("id", resultIds);
  }

  return {
    sent: emailResult.success,
    resultsCount: results.length,
    error: emailResult.error,
  };
}

/**
 * Generate a structured recap using Claude
 */
async function generateRecapWithAI(results: RecapResult[]): Promise<string> {
  const anthropic = getAnthropic();

  const resultsList = results
    .map(
      (r, i) =>
        `[${i + 1}] (${r.relevance_score}%) ${r.web_watches?.topic || "Veille"} | ${r.source}\n${r.title}\n${r.snippet || ""}`
    )
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Tu es un analyste de veille strategique pour une entreprise qui prospecte des conciergeries et gestionnaires de locations saisonnieres en France.

Voici les ${results.length} resultats de veille web d'aujourd'hui:

${resultsList}

Genere un recap quotidien structure en francais (sans accents dans les titres):

1. RESUME EN 3 PHRASES des points cles
2. ALERTES IMPORTANTES (resultats >= 70% pertinence)
3. OPPORTUNITES BUSINESS (ce qui pourrait impacter nos prospects)
4. TENDANCES MARCHE (evolutions reglementaires, concurrence, levees de fonds)

Sois concis et actionnable. Format texte brut.`,
        },
      ],
    });

    return extractTextContent(response);
  } catch (error) {
    console.error("[WebWatch] AI recap error:", error);
    return `${results.length} resultats trouves aujourd'hui. Consultez l'app pour plus de details.`;
  }
}

/**
 * Build HTML email for the recap
 */
function buildRecapEmail(
  name: string,
  results: RecapResult[],
  recapText: string,
  _workspaceId: string
): string {
  const high = results.filter((r) => r.relevance_score >= 70);
  const medium = results.filter((r) => r.relevance_score >= 40 && r.relevance_score < 70);
  const low = results.filter((r) => r.relevance_score < 40);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000");

  function resultRow(r: RecapResult): string {
    const sourceLabel = r.source === "google_news" ? "News" : "Web";
    const sourceColor = r.source === "google_news" ? "#059669" : "#2563eb";
    const relevanceColor =
      r.relevance_score >= 70 ? "#dc2626" : r.relevance_score >= 50 ? "#ea580c" : "#6b7280";

    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 11px; color: ${sourceColor}; font-weight: 600;">${sourceLabel}</span>
            <span style="font-size: 11px; color: ${relevanceColor}; font-weight: 600;">${r.relevance_score}%</span>
            ${r.web_watches?.topic ? `<span style="font-size: 11px; color: #6366f1;">${r.web_watches.topic}</span>` : ""}
          </div>
          ${r.url
            ? `<a href="${r.url}" target="_blank" style="color: #1e293b; font-weight: 500; text-decoration: none; font-size: 14px;">${r.title}</a>`
            : `<span style="color: #1e293b; font-weight: 500; font-size: 14px;">${r.title}</span>`
          }
          ${r.snippet ? `<p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0; line-height: 1.4;">${r.snippet.slice(0, 150)}</p>` : ""}
        </td>
      </tr>`;
  }

  const recapHtml = recapText
    .split("\n")
    .map((line) => {
      if (line.match(/^\d+\./)) return `<p style="margin: 4px 0; font-weight: 600;">${line}</p>`;
      if (line.startsWith("-") || line.startsWith("*")) return `<p style="margin: 2px 0 2px 16px; color: #475569;">${line}</p>`;
      if (line.match(/^[A-Z ]+$/)) return `<h3 style="margin: 16px 0 4px 0; color: #6366f1; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">${line}</h3>`;
      return line ? `<p style="margin: 4px 0; color: #334155;">${line}</p>` : "";
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 12px 12px 0 0; padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Votre recap veille web</h1>
      <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
    </div>

    <!-- Stats -->
    <div style="background: white; padding: 16px 24px; display: flex; gap: 24px; border-bottom: 1px solid #e2e8f0;">
      <div style="text-align: center; flex: 1;">
        <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${results.length}</div>
        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Resultats</div>
      </div>
      <div style="text-align: center; flex: 1;">
        <div style="font-size: 24px; font-weight: 700; color: ${high.length > 0 ? "#dc2626" : "#1e293b"};">${high.length}</div>
        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Alertes</div>
      </div>
      <div style="text-align: center; flex: 1;">
        <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${results.filter((r) => r.prospect_id).length}</div>
        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Prospects lies</div>
      </div>
    </div>

    <!-- AI Recap -->
    <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 16px 20px; margin: 0;">
      <h2 style="margin: 0 0 8px; font-size: 14px; color: #854d0e;">Analyse IA</h2>
      ${recapHtml}
    </div>

    <!-- High relevance results -->
    ${high.length > 0 ? `
    <div style="background: white; margin-top: 2px;">
      <div style="padding: 12px 16px; border-bottom: 2px solid #dc2626;">
        <h2 style="margin: 0; font-size: 14px; color: #dc2626;">Alertes importantes (${high.length})</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${high.map(resultRow).join("")}
      </table>
    </div>` : ""}

    <!-- Medium relevance results -->
    ${medium.length > 0 ? `
    <div style="background: white; margin-top: 2px;">
      <div style="padding: 12px 16px; border-bottom: 2px solid #ea580c;">
        <h2 style="margin: 0; font-size: 14px; color: #ea580c;">A surveiller (${medium.length})</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${medium.slice(0, 10).map(resultRow).join("")}
      </table>
    </div>` : ""}

    <!-- Low relevance (collapsed) -->
    ${low.length > 0 ? `
    <div style="background: white; margin-top: 2px; padding: 12px 16px;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">${low.length} autre${low.length > 1 ? "s" : ""} resultat${low.length > 1 ? "s" : ""} de moindre pertinence. <a href="${appUrl}/web-watch" style="color: #6366f1;">Voir dans l'app</a></p>
    </div>` : ""}

    <!-- CTA -->
    <div style="text-align: center; padding: 24px; background: white; border-radius: 0 0 12px 12px; margin-top: 2px;">
      <a href="${appUrl}/web-watch" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Voir tous les resultats</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 11px;">
      <p>ColdReach — Veille Web automatique</p>
      <p>Gerez vos sujets de veille depuis <a href="${appUrl}/web-watch" style="color: #6366f1;">l'application</a></p>
    </div>
  </div>
</body>
</html>`;
}
