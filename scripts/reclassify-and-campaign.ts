import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Classification rules based on company name patterns
function classifyProspect(company: string | null, name: string | null): string {
  const text = ((company || "") + " " + (name || "")).toLowerCase();

  // Hotels
  if (
    text.includes("hotel") ||
    text.includes("hôtel") ||
    text.includes("accor") ||
    text.includes("ibis") ||
    text.includes("novotel") ||
    text.includes("mercure") ||
    text.includes("pullman") ||
    text.includes("sofitel") ||
    text.includes("mgallery") ||
    text.includes("hotelf1") ||
    text.includes("kyriad") ||
    text.includes("brithotel") ||
    text.includes("appart'city") ||
    text.includes("aparthotel") ||
    text.includes("adagio") ||
    text.includes("cerise") ||
    text.includes("mi hôtel") ||
    text.includes("chris-tal") ||
    text.includes("chouette hôtel")
  ) {
    return "hotel";
  }

  // Campings
  if (
    text.includes("camping") ||
    text.includes("campingles")
  ) {
    return "camping";
  }

  // Gîtes & chambres d'hôtes
  if (
    text.includes("gite") ||
    text.includes("gîte") ||
    text.includes("b&b") ||
    text.includes("chambre") ||
    text.includes("bastide") ||
    text.includes("mas de") ||
    text.includes("château") ||
    text.includes("chateau") ||
    text.includes("ferme") ||
    text.includes("auberge") ||
    text.includes("le secret du chat") ||
    text.includes("domaine") ||
    text.includes("villa-le") ||
    text.includes("la forêt") ||
    text.includes("les chaufourniers") ||
    text.includes("paluel") ||
    text.includes("leschauvins") ||
    text.includes("lesterrasses") ||
    text.includes("val d'azur")
  ) {
    return "gite";
  }

  // Résidences & appart'hotels
  if (
    text.includes("residence") ||
    text.includes("résidence") ||
    text.includes("appart") ||
    text.includes("zenitude") ||
    text.includes("nemea") ||
    text.includes("vacanceole") ||
    text.includes("mmv") ||
    text.includes("nationale apparthotel") ||
    text.includes("crystal")
  ) {
    return "residence";
  }

  // Conciergeries de luxe/prestige
  if (
    text.includes("prestige") ||
    text.includes("luxury") ||
    text.includes("premium") ||
    text.includes("privée") ||
    text.includes("privee") ||
    text.includes("yachting") ||
    text.includes("successorale") ||
    text.includes("gastronomique") ||
    text.includes("guest apartment")
  ) {
    return "conciergerie_luxe";
  }

  // Conciergeries d'entreprise / solidaire / services
  if (
    text.includes("solidaire") ||
    text.includes("domusvi") ||
    text.includes("entreprise") ||
    text.includes("club services") ||
    text.includes("facility") ||
    text.includes("oscar") ||
    text.includes("canifeline") ||
    text.includes("école") ||
    text.includes("ecole") ||
    text.includes("john paul") ||
    text.includes("on location") ||
    text.includes("lhh online") ||
    text.includes("accord services") ||
    text.includes("service concierge")
  ) {
    return "conciergerie_entreprise";
  }

  // Default: regular conciergerie -> prospect
  if (text.includes("conciergerie") || text.includes("concierge")) {
    return "prospect";
  }

  // Everything else that doesn't match
  return "prospect";
}

// Campaign definitions for each new type
const NEW_CAMPAIGNS = [
  {
    type: "hotel",
    name: "🏨 Hôtels — Optimisation Channel Manager",
    description: "Campagne pour les hôtels et chaînes hôtelières",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Automatisez la gestion de vos réservations",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à un HÔTEL ou une chaîne hôtelière. Angle: automatisation de la gestion des réservations multi-plateformes (Booking, Expedia, Direct), check-in/check-out optimisé, gestion des avis clients. Ton: professionnel, orienté performance/RevPAR. Mentionne que CheckEasy peut s'adapter à leur volume. Premier contact, pas de vente agressive.`
      },
      {
        step_order: 2,
        delay_days: 3,
        subject: "Re: gestion des réservations",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up pour un hôtel. Apporte de la valeur: parle des problèmes courants (double réservations, gestion multi-OTA, réponses aux avis). Propose un cas concret de gain de temps. Court et direct.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Dernière question rapide",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Dernier email pour un hôtel. Breakup email: pose une question simple pour qualifier l'intérêt. "Est-ce que la gestion multi-plateformes est un sujet pour vous en ce moment?" Très court, 3-4 lignes max.`
      }
    ]
  },
  {
    type: "camping",
    name: "⛺ Campings — Gestion Saisonnière",
    description: "Campagne pour les campings et villages vacances",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Préparez votre saison sereinement",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à un CAMPING. Angle: préparation de la haute saison, gestion des réservations été, automatisation du check-in pour les emplacements et mobil-homes. Ton: sympathique, pratique. Mentionne la saisonnalité et les pics d'activité. Premier contact chaleureux.`
      },
      {
        step_order: 2,
        delay_days: 4,
        subject: "Re: saison été",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up pour un camping. Parle des galères saisonnières: accueil des vacanciers, gestion des arrivées/départs le samedi, communication avec les clients. Propose une solution concrète. Court.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Une question avant la saison",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Breakup email pour un camping. Question simple: "Comment gérez-vous les arrivées en haute saison actuellement?" 3 lignes max.`
      }
    ]
  },
  {
    type: "gite",
    name: "🏡 Gîtes & Chambres d'hôtes — Simplifiez votre gestion",
    description: "Campagne pour gîtes, chambres d'hôtes, bastides, domaines",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Gérez vos réservations sans stress",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à un propriétaire de GÎTE, chambre d'hôte, bastide ou domaine. Angle: simplifier la gestion quotidienne (réservations, communication voyageurs, ménage, remise des clés). Ton: chaleureux, entre pairs. Ces propriétaires sont souvent seuls à gérer. Mentionne que CheckEasy est pensé pour les petites structures. Premier contact.`
      },
      {
        step_order: 2,
        delay_days: 4,
        subject: "Re: gestion de votre hébergement",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up pour un gîte/chambre d'hôtes. Parle des irritants: messages des voyageurs à répétition, ménage à organiser, calendrier à synchroniser entre Airbnb/Booking/direct. Montre que tu comprends leur quotidien.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Dernier message",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Breakup email pour un gîte. Empathique: "Je sais que la saison approche et que vous êtes déjà bien occupé(e)." Question simple pour qualifier. 3 lignes.`
      }
    ]
  },
  {
    type: "residence",
    name: "🏢 Résidences & Appart'hôtels — Automatisation",
    description: "Campagne pour résidences de tourisme et appart'hôtels",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Automatisez la gestion de votre résidence",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à une RÉSIDENCE DE TOURISME ou un APPART'HÔTEL. Angle: gestion de volume (beaucoup d'unités), automatisation des processus, check-in digital, gestion des équipes de ménage. Ton: professionnel et structuré. Ces structures ont des besoins d'échelle. Premier contact.`
      },
      {
        step_order: 2,
        delay_days: 3,
        subject: "Re: gestion multi-unités",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up résidence/appart'hôtel. Angle: ROI et gain de temps sur la gestion de dizaines/centaines d'unités. Parle de coordination des équipes et d'optimisation tarifaire. Court et factuel.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Question rapide",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Breakup email résidence. "Combien d'unités gérez-vous actuellement?" Simple question pour engager. 3 lignes.`
      }
    ]
  },
  {
    type: "conciergerie_luxe",
    name: "💎 Conciergeries Premium — Partenariat Haut de Gamme",
    description: "Campagne pour conciergeries de luxe et prestige",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Une solution à la hauteur de vos exigences",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à une CONCIERGERIE DE LUXE/PRESTIGE. Angle: expérience client premium, qualité irréprochable, outil à la hauteur de leur standing. Ton: élégant, haut de gamme, pas familier. Ces conciergeries gèrent des biens d'exception. Mentionne la personnalisation et le white-label. Premier contact soigné.`
      },
      {
        step_order: 2,
        delay_days: 4,
        subject: "L'expérience client, notre obsession commune",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up conciergerie premium. Parle de l'expérience voyageur de bout en bout: du premier message à l'avis 5 étoiles. Mentionne la possibilité de personnaliser l'outil avec leur branding. Ton raffiné.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Un échange ?",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Dernier email conciergerie luxe. Propose un échange court et sans engagement. "15 minutes pour voir si notre approche correspond à vos standards." Très court, élégant.`
      }
    ]
  },
  {
    type: "conciergerie_entreprise",
    name: "🏛️ Conciergeries Entreprise & Solidaire — Services innovants",
    description: "Campagne pour conciergeries d'entreprise, solidaires et de services",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Digitaliser vos services de conciergerie",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Tu écris à une CONCIERGERIE D'ENTREPRISE ou SOLIDAIRE. Angle: digitalisation des services, gestion des demandes, suivi qualité. Ton: professionnel, orienté impact social ou RH. Ces structures gèrent des services pour des salariés ou des collectivités. Adapte le message à leur contexte (pas de la location saisonnière). Premier contact.`
      },
      {
        step_order: 2,
        delay_days: 4,
        subject: "Re: vos services de conciergerie",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Follow-up conciergerie entreprise/solidaire. Parle de la gestion des demandes, du reporting, de la satisfaction des bénéficiaires. Court et orienté résultats.`
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: "Dernière question",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: `Breakup email conciergerie entreprise. Question de qualification: "Comment gérez-vous le suivi de vos prestations aujourd'hui?" 3 lignes.`
      }
    ]
  }
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log("=== Reclassification & création de campagnes ===");
  console.log("Mode:", dryRun ? "DRY RUN" : "REEL");

  // Get workspace & user
  const { data: ws } = await supabase.from("workspaces").select("id").limit(1).single();
  const { data: user } = await supabase.from("profiles").select("id").limit(1).single();
  if (!ws || !user) { console.error("No workspace/user"); return; }
  console.log("Workspace:", ws.id, "User:", user.id);

  // Get all mauvaise_cible prospects
  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("id, first_name, last_name, company, email, contact_type")
    .eq("contact_type", "mauvaise_cible");

  if (error || !prospects) {
    console.error("Error:", error);
    return;
  }

  console.log("\nTotal mauvaise_cible:", prospects.length);

  // Classify each prospect
  const classified: Record<string, typeof prospects> = {};
  for (const p of prospects) {
    const newType = classifyProspect(p.company, (p.first_name || "") + " " + (p.last_name || ""));
    if (!classified[newType]) classified[newType] = [];
    classified[newType].push(p);
  }

  // Show classification results
  console.log("\nClassification:");
  for (const [type, list] of Object.entries(classified)) {
    console.log("  " + type + ": " + list.length + " prospects");
    for (const p of list) {
      const name = ((p.first_name || "") + " " + (p.last_name || "")).trim() || "N/A";
      console.log("    - " + name + " | " + (p.company || "N/A") + " | " + (p.email || "pas d'email"));
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Aucune modification. Relancez sans --dry-run.");
    return;
  }

  // Update contact_type for each group
  for (const [type, list] of Object.entries(classified)) {
    const ids = list.map(p => p.id);
    const { error: updateErr } = await supabase
      .from("prospects")
      .update({ contact_type: type })
      .in("id", ids);
    if (updateErr) {
      console.error("Error updating " + type + ":", updateErr);
    } else {
      console.log("\nUpdated " + ids.length + " prospects to " + type);
    }
  }

  // Create campaigns for new types (skip 'prospect' - they'll be caught by existing campaigns)
  for (const campaign of NEW_CAMPAIGNS) {
    const typeProspects = classified[campaign.type];
    if (!typeProspects || typeProspects.length === 0) {
      console.log("\n--- " + campaign.name + " ---");
      console.log("  0 prospects, skip");
      continue;
    }

    // Only prospects with email
    const withEmail = typeProspects.filter(p => p.email);
    console.log("\n--- " + campaign.name + " ---");
    console.log("  " + typeProspects.length + " total, " + withEmail.length + " avec email");

    if (withEmail.length === 0) {
      console.log("  Aucun avec email, skip");
      continue;
    }

    // Check if already in a campaign
    const prospectIds = withEmail.map(p => p.id);
    const { data: alreadyEnrolled } = await supabase
      .from("campaign_prospects")
      .select("prospect_id")
      .in("prospect_id", prospectIds);
    const enrolledSet = new Set((alreadyEnrolled || []).map(cp => cp.prospect_id));
    const toEnroll = withEmail.filter(p => !enrolledSet.has(p.id));

    if (toEnroll.length === 0) {
      console.log("  Tous déjà dans une campagne, skip");
      continue;
    }

    // Create campaign
    const { data: newCampaign, error: campErr } = await supabase
      .from("campaigns")
      .insert({
        workspace_id: ws.id,
        created_by: user.id,
        name: campaign.name,
        description: campaign.description,
        status: "draft",
        settings: {
          daily_send_limit: 30,
          send_window_start: "08:00",
          send_window_end: "19:00",
          timezone: "Europe/Paris",
          min_delay_between_emails: 120,
        },
      })
      .select("id")
      .single();

    if (campErr || !newCampaign) {
      console.error("  Error creating campaign:", campErr);
      continue;
    }
    console.log("  Campagne créée:", newCampaign.id);

    // Create steps
    for (const step of campaign.steps) {
      await supabase.from("sequence_steps").insert({
        campaign_id: newCampaign.id,
        step_order: step.step_order,
        delay_days: step.delay_days,
        subject: step.subject,
        body_html: step.body_html,
        use_ai_generation: step.use_ai_generation,
        ai_prompt_context: step.ai_prompt_context,
      });
    }
    console.log("  " + campaign.steps.length + " steps créés");

    // Enroll prospects
    const enrollRecords = toEnroll.map(p => ({
      campaign_id: newCampaign.id,
      prospect_id: p.id,
      status: "paused" as const,
      current_step: 1,
    }));

    const { error: enrollErr } = await supabase
      .from("campaign_prospects")
      .insert(enrollRecords);

    if (enrollErr) {
      console.error("  Error enrolling:", enrollErr);
    } else {
      console.log("  " + toEnroll.length + " prospects inscrits (paused)");
    }
  }

  // Handle "prospect" reclassified ones - enroll in "Jamais Contactés" campaign
  const reclassifiedAsProspect = classified["prospect"];
  if (reclassifiedAsProspect && reclassifiedAsProspect.length > 0) {
    const withEmail = reclassifiedAsProspect.filter(p => p.email);
    console.log("\n--- Reclassifiés en 'prospect' (conciergeries standard) ---");
    console.log("  " + reclassifiedAsProspect.length + " total, " + withEmail.length + " avec email");

    if (withEmail.length > 0) {
      // Find the "Jamais Contactés" campaign
      const { data: coldCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .ilike("name", "%Jamais Contact%")
        .single();

      if (coldCampaign) {
        const prospectIds = withEmail.map(p => p.id);
        const { data: alreadyEnrolled } = await supabase
          .from("campaign_prospects")
          .select("prospect_id")
          .in("prospect_id", prospectIds);
        const enrolledSet = new Set((alreadyEnrolled || []).map(cp => cp.prospect_id));
        const toEnroll = withEmail.filter(p => !enrolledSet.has(p.id));

        if (toEnroll.length > 0) {
          const enrollRecords = toEnroll.map(p => ({
            campaign_id: coldCampaign.id,
            prospect_id: p.id,
            status: "paused" as const,
            current_step: 1,
          }));
          await supabase.from("campaign_prospects").insert(enrollRecords);
          console.log("  " + toEnroll.length + " inscrits dans 'Jamais Contactés'");
        }
      }
    }
  }

  console.log("\n=== TERMINE ===");
}

main();
