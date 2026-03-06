import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";

const BUCKET_NAME = "recordings";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm;codecs=opus",
];

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prospectId = formData.get("prospect_id") as string | null;
    const prospectContext = formData.get("prospect_context") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier audio fourni" }, { status: 400 });
    }

    // Validate type (check base type without codecs param)
    const baseType = file.type.split(";")[0];
    if (!ALLOWED_TYPES.includes(baseType) && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Format audio non supporte: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 25 Mo)" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 3. Ensure bucket exists
    const { data: buckets } = await adminSupabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      await adminSupabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
    }

    // 4. Upload to Supabase Storage
    const ext = file.name?.split(".").pop() || "webm";
    const fileName = `${user.id}/${prospectId || "unknown"}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[transcribe] Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload audio" }, { status: 500 });
    }

    const {
      data: { publicUrl: audioUrl },
    } = adminSupabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    // 5. Transcription via OpenAI Whisper
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Convert buffer to a File object for the OpenAI SDK
    const audioFile = new File([buffer], `recording.${ext}`, { type: file.type });

    const transcriptionResult = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr",
      response_format: "text",
    });

    // response_format: "text" returns a string, but fallback for object format
    const transcription = typeof transcriptionResult === "string"
      ? transcriptionResult
      : (transcriptionResult as { text?: string }).text || JSON.stringify(transcriptionResult);

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json({
        audio_url: audioUrl,
        transcription: "",
        summary: "Aucun contenu audio detecte",
        key_points: [],
        action_items: [],
      });
    }

    // 6. Summary via Claude Haiku
    const contextLine = prospectContext ? `Contexte du prospect : ${prospectContext}\n\n` : "";
    const anthropic = getAnthropic();

    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${contextLine}Voici la transcription d'un appel telephonique professionnel :\n\n"${transcription}"\n\nAnalyse cet appel et reponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) au format suivant :\n{\n  "summary": "Resume concis de l'appel en 2-3 phrases",\n  "key_points": ["Point cle 1", "Point cle 2", ...],\n  "action_items": ["Action a suivre 1", "Action a suivre 2", ...]\n}\n\nSi l'appel ne contient pas d'actions a suivre, retourne un tableau vide pour action_items.`,
        },
      ],
    });

    const rawSummary = extractTextContent(summaryResponse);
    let summary = "Resume non disponible";
    let keyPoints: string[] = [];
    let actionItems: string[] = [];

    try {
      // Strip markdown code block wrappers if present (```json ... ```)
      const cleanedSummary = rawSummary
        .trim()
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?\s*```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleanedSummary);
      summary = parsed.summary || summary;
      keyPoints = Array.isArray(parsed.key_points) ? parsed.key_points : [];
      actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];
    } catch {
      // If JSON parsing fails, use raw text as summary
      summary = rawSummary || summary;
    }

    return NextResponse.json({
      audio_url: audioUrl,
      transcription,
      summary,
      key_points: keyPoints,
      action_items: actionItems,
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
