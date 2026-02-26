import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { recipient, context } = await request.json();

    if (!recipient) {
      return NextResponse.json(
        { error: 'recipient est requis' },
        { status: 400 }
      );
    }

    const prompt = `Tu es un expert en cold emailing B2B en France. Genere un email de prospection personnalise.

Destinataire :
- Prenom : ${recipient.firstName}
- Nom : ${recipient.lastName}
- Poste : ${recipient.jobTitle}
- Entreprise : ${recipient.company}

Contexte : ${context || 'Premier contact de prospection'}

Regles :
- Ecris en francais professionnel mais naturel (pas de jargon marketing)
- Sois concis (max 150 mots)
- Commence par "Bonjour {prenom}"
- Pose UNE question ouverte a la fin
- Pas de flatterie excessive
- Propose de la valeur concrete
- Ton amical mais professionnel

Reponds UNIQUEMENT en JSON valide avec ce format :
{"subject": "...", "body": "..."}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'system', content: 'Tu reponds uniquement en JSON valide. Pas de markdown, pas de texte supplementaire.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: 'Pas de reponse de l\'IA' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      subject: parsed.subject,
      body: parsed.body,
    });
  } catch (err) {
    console.error('[API generate-email] Error:', err);
    return NextResponse.json(
      { error: 'Erreur lors de la generation' },
      { status: 500 }
    );
  }
}
