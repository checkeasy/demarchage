import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "signatures";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * POST /api/settings/signature-image
 * Upload a signature photo to Supabase Storage
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporte. Utilisez PNG, JPG, WebP ou GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 2 Mo)" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Ensure bucket exists (admin only)
    const { data: buckets } = await adminSupabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      await adminSupabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    // Upload file
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[signature-image] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = adminSupabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("[signature-image] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
