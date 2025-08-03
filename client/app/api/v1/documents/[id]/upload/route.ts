import { logError } from "@/utils/logger";
import { uploadDocument } from "@/utils/storage/upload-resume-to-supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();
    const key = await uploadDocument(params.id, formData);

    return NextResponse.json({
      success: true,
      key,
      message: "Document uploaded successfully",
    });
  } catch (err) {
    await logError("Failed to upload document", err, { id: params.id });

    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
