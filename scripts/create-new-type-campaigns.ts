import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WS = "83da732a-a933-4ed4-a815-3f975c8ff0c6";
const USER = "3ed6c90c-6954-4835-adb9-4c99355e4c21";

interface StepDef {
  step_order: number;
  step_type: string;
  delay_days: number;
  subject: string;
  body_html: string;
  use_ai_generation: boolean;
  ai_prompt_context: string;
}

interface CampaignDef {
  type: string;
  name: string;
  description: string;
  steps: StepDef[];
}

const CAMPAIGNS: CampaignDef[] = [
  {
    type: "hotel",
    name: "🏨 Hôtels — Optimisation Channel Manager",
    description: "Campagne pour les hôtels et chaînes hôtelières",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Automatisez la gestion de vos réservations",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à un HÔTEL ou une chaîne hôtelière. Angle: automatisation de la gestion des réservations multi-plateformes (Booking, Expedia, Direct), check-in/check-out optimisé, gestion des avis clients. Ton: professionnel, orienté performance/RevPAR. Mentionne que CheckEasy peut s'adapter à leur volume. Premier contact, pas de vente agressive."
      },
      {
        step_order: 2, step_type: "email", delay_days: 3,
        subject: "Re: gestion des réservations",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up pour un hôtel. Apporte de la valeur: parle des problèmes courants (double réservations, gestion multi-OTA, réponses aux avis). Propose un cas concret de gain de temps. Court et direct."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Dernière question rapide",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Dernier email pour un hôtel. Breakup email: pose une question simple pour qualifier l'intérêt. Très court, 3-4 lignes max."
      }
    ]
  },
  {
    type: "camping",
    name: "⛺ Campings — Gestion Saisonnière",
    description: "Campagne pour les campings et villages vacances",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Préparez votre saison sereinement",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à un CAMPING. Angle: préparation de la haute saison, gestion des réservations été, automatisation du check-in pour les emplacements et mobil-homes. Ton: sympathique, pratique. Premier contact chaleureux."
      },
      {
        step_order: 2, step_type: "email", delay_days: 4,
        subject: "Re: saison été",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up pour un camping. Parle des galères saisonnières: accueil des vacanciers, gestion des arrivées/départs le samedi. Propose une solution concrète. Court."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Une question avant la saison",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Breakup email pour un camping. Question simple: Comment gérez-vous les arrivées en haute saison actuellement? 3 lignes max."
      }
    ]
  },
  {
    type: "gite",
    name: "🏡 Gîtes & Chambres d'hôtes — Simplifiez votre gestion",
    description: "Campagne pour gîtes, chambres d'hôtes, bastides, domaines",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Gérez vos réservations sans stress",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à un propriétaire de GÎTE, chambre d'hôte, bastide ou domaine. Angle: simplifier la gestion quotidienne. Ton: chaleureux, entre pairs. Ces propriétaires sont souvent seuls à gérer. Premier contact."
      },
      {
        step_order: 2, step_type: "email", delay_days: 4,
        subject: "Re: gestion de votre hébergement",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up pour un gîte. Parle des irritants: messages des voyageurs, ménage à organiser, calendrier à synchroniser entre Airbnb/Booking/direct."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Dernier message",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Breakup email pour un gîte. Empathique. Question simple pour qualifier. 3 lignes."
      }
    ]
  },
  {
    type: "residence",
    name: "🏢 Résidences & Appart'hôtels — Automatisation",
    description: "Campagne pour résidences de tourisme et appart'hôtels",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Automatisez la gestion de votre résidence",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à une RÉSIDENCE DE TOURISME ou un APPART'HÔTEL. Angle: gestion de volume, automatisation des processus, check-in digital. Ton: professionnel et structuré. Premier contact."
      },
      {
        step_order: 2, step_type: "email", delay_days: 3,
        subject: "Re: gestion multi-unités",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up résidence. Angle: ROI et gain de temps sur la gestion de dizaines/centaines d'unités. Court et factuel."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Question rapide",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Breakup email résidence. Combien d'unités gérez-vous actuellement? Simple question. 3 lignes."
      }
    ]
  },
  {
    type: "conciergerie_luxe",
    name: "💎 Conciergeries Premium — Partenariat Haut de Gamme",
    description: "Campagne pour conciergeries de luxe et prestige",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Une solution à la hauteur de vos exigences",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à une CONCIERGERIE DE LUXE/PRESTIGE. Angle: expérience client premium, qualité irréprochable, outil à la hauteur de leur standing. Ton: élégant, haut de gamme. Mentionne la personnalisation et le white-label. Premier contact soigné."
      },
      {
        step_order: 2, step_type: "email", delay_days: 4,
        subject: "L'expérience client, notre obsession commune",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up conciergerie premium. Parle de l'expérience voyageur de bout en bout. Mentionne la possibilité de personnaliser l'outil avec leur branding. Ton raffiné."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Un échange ?",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Dernier email conciergerie luxe. Propose un échange court et sans engagement. 15 minutes. Très court, élégant."
      }
    ]
  },
  {
    type: "conciergerie_entreprise",
    name: "🏛️ Conciergeries Entreprise & Solidaire — Services innovants",
    description: "Campagne pour conciergeries d'entreprise, solidaires et de services",
    steps: [
      {
        step_order: 1, step_type: "email", delay_days: 0,
        subject: "Digitaliser vos services de conciergerie",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Tu écris à une CONCIERGERIE D'ENTREPRISE ou SOLIDAIRE. Angle: digitalisation des services, gestion des demandes, suivi qualité. Ton: professionnel, orienté impact. Adapte le message à leur contexte. Premier contact."
      },
      {
        step_order: 2, step_type: "email", delay_days: 4,
        subject: "Re: vos services de conciergerie",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Follow-up conciergerie entreprise/solidaire. Parle de la gestion des demandes, du reporting, de la satisfaction des bénéficiaires. Court et orienté résultats."
      },
      {
        step_order: 3, step_type: "email", delay_days: 5,
        subject: "Dernière question",
        body_html: "<p>Email généré par IA</p>",
        use_ai_generation: true,
        ai_prompt_context: "Breakup email conciergerie entreprise. Question de qualification: Comment gérez-vous le suivi de vos prestations aujourd'hui? 3 lignes."
      }
    ]
  }
];

async function main() {
  for (const campaign of CAMPAIGNS) {
    // Get prospects of this type with email
    const { data: prospects } = await supabase.from("prospects")
      .select("id, email")
      .eq("contact_type", campaign.type)
      .not("email", "is", null);

    const withEmail = (prospects || []).filter(p => p.email);

    if (withEmail.length === 0) {
      console.log(`${campaign.name}: 0 prospects avec email, skip`);
      continue;
    }

    // Check already enrolled
    const ids = withEmail.map(p => p.id);
    const { data: enrolled } = await supabase.from("campaign_prospects")
      .select("prospect_id").in("prospect_id", ids);
    const enrolledSet = new Set((enrolled || []).map(e => e.prospect_id));
    const toEnroll = withEmail.filter(p => !enrolledSet.has(p.id));

    // Create campaign
    const { data: newCamp, error: campErr } = await supabase.from("campaigns").insert({
      workspace_id: WS,
      created_by: USER,
      name: campaign.name,
      description: campaign.description,
      status: "draft",
      timezone: "Europe/Paris",
      sending_window_start: "08:00",
      sending_window_end: "19:00",
      daily_limit: 30,
    }).select("id").single();

    if (campErr || !newCamp) {
      console.error(`${campaign.name} ERROR:`, campErr?.message);
      continue;
    }
    console.log(`${campaign.name} créée: ${newCamp.id}`);

    // Create steps
    for (const step of campaign.steps) {
      const { error: stepErr } = await supabase.from("sequence_steps").insert({
        campaign_id: newCamp.id,
        ...step
      });
      if (stepErr) console.error(`  Step ${step.step_order} error:`, stepErr.message);
    }
    console.log(`  ${campaign.steps.length} steps créés`);

    // Enroll prospects
    if (toEnroll.length > 0) {
      const records = toEnroll.map(p => ({
        campaign_id: newCamp.id,
        prospect_id: p.id,
        status: "paused" as const,
      }));
      const { error: enrollErr } = await supabase.from("campaign_prospects").insert(records);
      if (enrollErr) console.error(`  Enroll error:`, enrollErr.message);
      else console.log(`  ${toEnroll.length} prospects inscrits (paused)`);
    } else {
      console.log(`  0 nouveaux prospects à inscrire`);
    }
  }
  console.log("\n=== DONE ===");
}

main();
