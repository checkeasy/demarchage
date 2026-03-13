import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";

// ─── Signal Email Templates ─────────────────────────────────────────────────

const SIGNAL_TEMPLATES: Record<string, { subject: string; opener: string }> = {
  funding: {
    subject: "Felicitations pour votre developpement",
    opener: "J'ai vu que votre entreprise est en pleine croissance, et je voulais vous feliciter.",
  },
  hiring: {
    subject: "Vous recrutez — besoin d'optimiser vos operations ?",
    opener: "J'ai remarque que vous etes en train de recruter, ce qui est un excellent signe de croissance.",
  },
  pain_point_detected: {
    subject: "Ameliorez l'experience de vos voyageurs",
    opener: "En suivant l'actualite du secteur, j'ai remarque des retours clients qui pourraient etre ameliores.",
  },
  expansion: {
    subject: "Votre croissance est impressionnante",
    opener: "Votre entreprise semble en pleine expansion, et je pense que c'est le bon moment pour optimiser vos processus.",
  },
  new_company: {
    subject: "Bienvenue dans le secteur de la conciergerie",
    opener: "Felicitations pour le lancement de votre activite ! Les premiers mois sont cruciaux pour poser les bonnes bases.",
  },
  technology_change: {
    subject: "Votre transition technologique",
    opener: "J'ai appris que vous etiez en train de faire evoluer vos outils, et je pense pouvoir vous aider dans cette transition.",
  },
  content_engagement: {
    subject: "Suite a votre interet pour nos contenus",
    opener: "J'ai remarque votre interet pour les sujets lies a la gestion locative, et je me permets de vous contacter.",
  },
};

export interface GeneratedEmail {
  subject: string;
  body: string;
  signal_type: string;
}

/**
 * Generate a personalized email draft based on a prospect signal.
 */
export async function generateSignalEmail(
  prospect: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    organization?: string | null;
    city?: string | null;
  },
  signal: {
    signal_type: string;
    title: string;
    description?: string | null;
  },
  senderName?: string
): Promise<GeneratedEmail> {
  const template = SIGNAL_TEMPLATES[signal.signal_type] || SIGNAL_TEMPLATES.content_engagement;
  const recipientName = prospect.first_name || "Madame, Monsieur";
  const companyName = prospect.organization || prospect.company || "votre entreprise";
  const sender = senderName || "Adrien";

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Tu es un commercial B2B specialise dans les solutions SaaS pour les conciergeries et gestionnaires de locations saisonnieres en France. Tu ecris un email de prospection personnalise.

CONTEXTE:
- Destinataire: ${recipientName} de "${companyName}" ${prospect.city ? `a ${prospect.city}` : ""}
- Signal detecte: ${signal.title}
- Details: ${signal.description || "Aucun detail supplementaire"}
- Type de signal: ${signal.signal_type}
- Accroche type: "${template.opener}"
- Expediteur: ${sender}

REGLES:
- Email court (max 150 mots)
- Ton professionnel mais chaleureux (tutoiement acceptable si naturel)
- PAS de lien, PAS de piece jointe mentionnee
- PAS de formule "je me permets de vous contacter"
- Termine par un CTA clair (appel, demo, echange)
- Sujet d'email percutant (max 50 caracteres)

Reponds en JSON strict:
{"subject": "...", "body": "..."}`,
        },
      ],
    });

    const text = extractTextContent(response);
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || template.subject,
        body: parsed.body || `${template.opener}\n\nCordialement,\n${sender}`,
        signal_type: signal.signal_type,
      };
    }
  } catch (err) {
    console.error("[SignalEmail] AI generation error:", err);
  }

  // Fallback: use template
  return {
    subject: template?.subject || "Un message pour vous",
    body: `Bonjour ${recipientName},\n\n${template?.opener || "Je me permets de vous contacter."}\n\nSerait-il possible d'echanger 15 minutes cette semaine ?\n\nCordialement,\n${sender}`,
    signal_type: signal.signal_type,
  };
}
