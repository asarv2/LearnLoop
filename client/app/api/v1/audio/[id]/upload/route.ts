import { storage } from "@/lib/storage";
import { logError } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file type
    if (
      !file.type.startsWith("audio/") &&
      !file.name.toLowerCase().endsWith(".wav")
    ) {
      return NextResponse.json(
        { error: "Only audio files (.wav) are allowed" },
        { status: 400 }
      );
    }

    const key = await storage.uploadFileAudio(file, `${id}.wav`);

    return NextResponse.json({
      success: true,
      key,
      message: "Audio uploaded successfully",
    });
  } catch (err) {
    const { id } = await params;
    await logError("Failed to upload audio", err, { id });

    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 }
    );
  }
}
