import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";
import { buildMissionParsingPrompt } from "@/lib/ai/prompts";
import { detectLanguage } from "@/lib/outreach-routing";
import {
  generateEmailSequence,
  generateConnectionMessage,
  type ProspectProfile,
} from "@/lib/ai/message-generator";

// GET /api/missions — List missions for workspace
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const { data: missions, error } = await supabase
    .from("outreach_missions")
    .select("*")
    .eq("workspace_id", profile.current_workspace_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ missions: missions || [] });
}

// POST /api/missions — Create mission from prompt
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = profile?.current_workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: "Aucun workspace actif" }, { status: 400 });
  }

  const body = await request.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return NextResponse.json(
      { error: "Le prompt doit contenir au moins 5 caracteres" },
      { status: 400 }
    );
  }

  try {
    // 1. Parse the prompt via AI
    const aiResponse = await getAnthropic().messages.create({
      model: CLAUDE_HAIKU,
      system: buildMissionParsingPrompt(),
      messages: [
        {
          role: "user",
          content: `Analyse cette description de cible de prospection et genere les informations structurees :\n\n"${prompt.trim()}"`,
        },
      ],
      max_tokens: 1024,
    });

    const aiText = extractTextContent(aiResponse);
    let parsed: {
      name: string;
      description: string;
      search_keywords: string[];
      target_profile: {
        job_titles?: string[];
        industries?: string[];
        locations?: string[];
        countries?: string[];
      };
    };

    try {
      // Strip markdown code fences if present (```json ... ```)
      let cleanJson = aiText.trim();
      const fenceMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        cleanJson = fenceMatch[1].trim();
      }
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("[API Missions] AI response was not valid JSON:", aiText);
      return NextResponse.json(
        { error: "Erreur de parsing de la reponse IA" },
        { status: 500 }
      );
    }

    // 2. Detect language from countries
    const countries = parsed.target_profile?.countries || [];
    const language = countries.length > 0
      ? detectLanguage(countries[0])
      : "fr";

    // 3. Get workspace AI context
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name, settings")
      .eq("id", workspaceId)
      .single();

    const wsCtx = {
      companyName: workspace?.name || undefined,
      companyContext: (workspace?.settings as Record<string, unknown>)?.company_context as string || undefined,
    };

    // 4. Create a generic prospect profile for sequence generation
    const genericProfile: ProspectProfile = {
      jobTitle: parsed.target_profile?.job_titles?.[0] || "Manager",
      company: "{company}",
      firstName: "{firstName}",
      lastName: "{lastName}",
      industry: parsed.target_profile?.industries?.[0] || undefined,
      location: parsed.target_profile?.locations?.[0] || undefined,
    };

    // 5. Generate sequences for 3 campaign types
    // Email campaign: 3 email steps
    const emailSequence = await generateEmailSequence(genericProfile, {}, 3, wsCtx);

    // 6. Insert 3 campaigns
    const campaignBase = {
      workspace_id: workspaceId,
      status: "active" as const,
      created_by: user.id,
      timezone: "Europe/Paris",
      sending_window_start: "08:00",
      sending_window_end: "18:00",
      sending_days: [1, 2, 3, 4, 5],
    };

    // Email campaign
    const { data: emailCampaign } = await adminSupabase
      .from("campaigns")
      .insert({
        ...campaignBase,
        name: `${parsed.name} - Email`,
        description: `Campagne email generee pour la mission: ${parsed.name}`,
      })
      .select("id")
      .single();

    if (emailCampaign && emailSequence.sequence) {
      const emailSteps = emailSequence.sequence.map((step, i) => ({
        campaign_id: emailCampaign.id,
        step_order: i * 2 + 1,
        step_type: "email" as const,
        subject: step.subject,
        body_html: step.body_html,
        body_text: step.body_text,
        delay_days: step.delay_days,
        delay_hours: 0,
      }));

      // Add delay steps between emails
      const stepsWithDelays: Array<Record<string, unknown>> = [];
      for (let i = 0; i < emailSteps.length; i++) {
        if (i > 0) {
          stepsWithDelays.push({
            campaign_id: emailCampaign.id,
            step_order: i * 2,
            step_type: "delay",
            delay_days: emailSteps[i].delay_days || 3,
            delay_hours: 0,
          });
        }
        stepsWithDelays.push({ ...emailSteps[i], step_order: stepsWithDelays.length + 1 });
      }

      await adminSupabase.from("sequence_steps").insert(stepsWithDelays);
    }

    // LinkedIn campaign
    const { data: linkedinCampaign } = await adminSupabase
      .from("campaigns")
      .insert({
        ...campaignBase,
        name: `${parsed.name} - LinkedIn`,
        description: `Campagne LinkedIn generee pour la mission: ${parsed.name}`,
      })
      .select("id")
      .single();

    if (linkedinCampaign) {
      // Generate connection message
      let connectionMsg = "Bonjour, votre profil m'a interpelle. Seriez-vous ouvert a un echange ?";
      try {
        const connResult = await generateConnectionMessage(genericProfile, {}, wsCtx);
        connectionMsg = connResult.message;
      } catch {
        // Use default
      }

      await adminSupabase.from("sequence_steps").insert([
        {
          campaign_id: linkedinCampaign.id,
          step_order: 1,
          step_type: "linkedin_connect",
          linkedin_message: connectionMsg,
          delay_days: 0,
          delay_hours: 0,
        },
        {
          campaign_id: linkedinCampaign.id,
          step_order: 2,
          step_type: "delay",
          delay_days: 3,
          delay_hours: 0,
        },
        {
          campaign_id: linkedinCampaign.id,
          step_order: 3,
          step_type: "linkedin_message",
          linkedin_message: "Merci pour la connexion ! Je travaille avec des professionnels de votre secteur et j'aimerais echanger sur vos enjeux actuels. Auriez-vous quelques minutes cette semaine ?",
          delay_days: 0,
          delay_hours: 0,
        },
        {
          campaign_id: linkedinCampaign.id,
          step_order: 4,
          step_type: "delay",
          delay_days: 5,
          delay_hours: 0,
        },
        {
          campaign_id: linkedinCampaign.id,
          step_order: 5,
          step_type: "linkedin_message",
          linkedin_message: "Je me permets une derniere relance. Si le timing n'est pas bon, pas de souci. N'hesitez pas a revenir vers moi quand vous le souhaitez.",
          delay_days: 0,
          delay_hours: 0,
        },
      ]);
    }

    // Multichannel campaign
    const { data: multiCampaign } = await adminSupabase
      .from("campaigns")
      .insert({
        ...campaignBase,
        name: `${parsed.name} - Multi-canal`,
        description: `Campagne multi-canal generee pour la mission: ${parsed.name}`,
      })
      .select("id")
      .single();

    if (multiCampaign && emailSequence.sequence?.[0]) {
      const firstEmail = emailSequence.sequence[0];
      let connectionMsg = "Bonjour, votre profil m'a interpelle. Seriez-vous ouvert a un echange ?";
      try {
        const connResult = await generateConnectionMessage(genericProfile, {}, wsCtx);
        connectionMsg = connResult.message;
      } catch {
        // Use default
      }

      await adminSupabase.from("sequence_steps").insert([
        {
          campaign_id: multiCampaign.id,
          step_order: 1,
          step_type: "email",
          subject: firstEmail.subject,
          body_html: firstEmail.body_html,
          body_text: firstEmail.body_text,
          delay_days: 0,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 2,
          step_type: "delay",
          delay_days: 2,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 3,
          step_type: "linkedin_connect",
          linkedin_message: connectionMsg,
          delay_days: 0,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 4,
          step_type: "delay",
          delay_days: 3,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 5,
          step_type: "email",
          subject: emailSequence.sequence[1]?.subject || "Relance",
          body_html: emailSequence.sequence[1]?.body_html || "<p>Relance</p>",
          body_text: emailSequence.sequence[1]?.body_text || "Relance",
          delay_days: 0,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 6,
          step_type: "delay",
          delay_days: 4,
          delay_hours: 0,
        },
        {
          campaign_id: multiCampaign.id,
          step_order: 7,
          step_type: "linkedin_message",
          linkedin_message: "Je vous ai egalement envoye un email. J'aimerais beaucoup echanger avec vous. Quand seriez-vous disponible ?",
          delay_days: 0,
          delay_hours: 0,
        },
      ]);
    }

    // 7. Insert the mission
    const { data: mission, error: missionError } = await adminSupabase
      .from("outreach_missions")
      .insert({
        workspace_id: workspaceId,
        name: parsed.name,
        description: parsed.description,
        original_prompt: prompt.trim(),
        search_keywords: parsed.search_keywords || [],
        target_profile: parsed.target_profile || {},
        language,
        campaign_email_id: emailCampaign?.id || null,
        campaign_linkedin_id: linkedinCampaign?.id || null,
        campaign_multichannel_id: multiCampaign?.id || null,
        status: "active",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (missionError) {
      return NextResponse.json({ error: missionError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mission,
      campaigns: {
        email: emailCampaign?.id || null,
        linkedin: linkedinCampaign?.id || null,
        multichannel: multiCampaign?.id || null,
      },
    });
  } catch (err) {
    console.error("[API Missions] Create error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
