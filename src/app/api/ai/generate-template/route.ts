import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProductContext } from "@/lib/ai/prompts";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";

/**
 * POST /api/ai/generate-template
 * Generate a template email/linkedin/whatsapp message for a sequence step.
 * Unlike /api/agents/orchestrate, this does NOT require a specific prospect —
 * it produces a template with {firstName}, {company}, etc. variables.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { channel, stepNumber, linkedinMessageType } = await request.json();

    if (!channel || !["email", "linkedin", "whatsapp"].includes(channel)) {
      return NextResponse.json(
        { error: 'Le champ "channel" est requis (email, linkedin, whatsapp)' },
        { status: 400 }
      );
    }

    // Load workspace context
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    let companyContext = "";
    let companyName = "";
    let aiTone = "semi-formel";
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
          targetAudience = (settings.ai_target_audience as string) || "";
        }
      }
    }

    const productContext = buildProductContext(companyContext);
    const toneMap: Record<string, string> = {
      formel: "tres professionnel et formel, vouvoiement strict",
      "semi-formel":
        "professionnel mais chaleureux, vouvoiement avec touche humaine",
      decontracte:
        "decontracte et direct, tutoiement possible si le secteur le permet",
    };
    const toneInstruction = toneMap[aiTone] || toneMap["semi-formel"];

    const stepContext =
      stepNumber === 1
        ? "C'est le PREMIER contact avec le prospect. Pas de reference a des echanges precedents."
        : `C'est l'etape ${stepNumber} de la sequence (relance). Le prospect a deja ete contacte. Fais reference au message precedent de maniere naturelle.`;

    let prompt: string;
    let jsonFormat: string;

    if (channel === "email") {
      jsonFormat = '{"subject": "...", "body_html": "...", "body_text": "..."}';
      prompt = `Tu es un expert en cold emailing B2B en France. Genere un TEMPLATE d'email de prospection.

## QUI NOUS SOMMES
${companyName ? `Entreprise : ${companyName}` : ""}
${productContext}
${targetAudience ? `Audience cible : ${targetAudience}` : ""}

## CONTEXTE
${stepContext}

## REGLES
- Ton : ${toneInstruction}
- Ecris en francais naturel (pas de jargon marketing)
- Sois concis (max 150 mots pour le corps)
- Utilise des VARIABLES de personnalisation : {firstName}, {lastName}, {company}, {jobTitle}
- Commence par "Bonjour {firstName}"
- Pose UNE question ouverte a la fin
- Pas de flatterie excessive
- L'email doit donner l'impression d'etre ecrit a la main
- Le CTA doit etre simple (repondre a l'email)
- body_html peut contenir du HTML simple (paragraphes, liens) mais pas de mise en forme lourde
- body_text est la version texte brut sans HTML

Reponds UNIQUEMENT en JSON valide : ${jsonFormat}`;
    } else if (channel === "linkedin") {
      const isConnection = linkedinMessageType === "connection";
      const maxChars = isConnection ? 300 : 2000;
      jsonFormat = '{"message": "...", "character_count": 0}';

      prompt = `Tu es un expert en prospection LinkedIn B2B en France. Genere un TEMPLATE de ${
        isConnection ? "note de connexion" : "message LinkedIn"
      }.

## QUI NOUS SOMMES
${companyName ? `Entreprise : ${companyName}` : ""}
${productContext}
${targetAudience ? `Audience cible : ${targetAudience}` : ""}

## CONTEXTE
${stepContext}
${isConnection ? "C'est une DEMANDE DE CONNEXION. Le prospect ne nous connait pas encore." : "Le prospect est deja dans notre reseau LinkedIn."}

## REGLES
- Ton : ${toneInstruction}
- Maximum ${maxChars} caracteres
- Utilise des VARIABLES : {firstName}, {lastName}, {company}, {jobTitle}
${isConnection ? "- Ne mentionne PAS directement notre entreprise\n- Pas de lien\n- Cree de la curiosite et de l'interet" : "- Tu peux mentionner notre entreprise naturellement\n- Tu peux poser une question pour engager la conversation"}
- Personnalise le message
- Pas de spam, pas de pitch agressif

Reponds UNIQUEMENT en JSON valide : ${jsonFormat}`;
    } else {
      // whatsapp
      jsonFormat = '{"message": "..."}';
      prompt = `Tu es un expert en prospection B2B en France. Genere un TEMPLATE de message WhatsApp professionnel.

## QUI NOUS SOMMES
${companyName ? `Entreprise : ${companyName}` : ""}
${productContext}
${targetAudience ? `Audience cible : ${targetAudience}` : ""}

## CONTEXTE
${stepContext}

## REGLES
- Ton : ${toneInstruction} mais adapte au format WhatsApp (plus court et direct)
- Maximum 500 caracteres
- Utilise des VARIABLES : {firstName}, {lastName}, {company}, {jobTitle}
- Commence par "Bonjour {firstName}"
- Message court et impactant
- Pas de spam

Reponds UNIQUEMENT en JSON valide : ${jsonFormat}`;
    }

    const response = await getAnthropic().messages.create({
      model: CLAUDE_HAIKU,
      system:
        "Tu reponds uniquement en JSON valide. Pas de markdown, pas de texte supplementaire.",
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

    // Clean potential markdown wrapping
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[API generate-template] JSON parse error:", cleaned.slice(0, 500));
      return NextResponse.json(
        { error: "Erreur de parsing de la reponse IA" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        content: parsed,
        metadata: {
          agentType: "template_generator",
          model: CLAUDE_HAIKU,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          costUsd:
            (response.usage.input_tokens * 0.8 +
              response.usage.output_tokens * 4.0) /
            1_000_000,
          personalizationScore: 0,
          generationDurationMs: 0,
        },
      },
    });
  } catch (err) {
    console.error("[API generate-template] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation du template" },
      { status: 500 }
    );
  }
}
