import { storage } from "@/lib/storage";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

const ONE_HOUR = 3600; // presigned URL life

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = await storage.getSignedUrlAudio(`${id}.wav`, ONE_HOUR);
    /* 302 keeps method=GET; 307 if you want to preserve original verb */
    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const { id } = await params;
    await logError("Failed to presign audio", err, { id });
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }
}
