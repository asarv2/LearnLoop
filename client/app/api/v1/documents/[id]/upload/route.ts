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
    const key = await storage.uploadFile(file, `${id}.pdf`);

    return NextResponse.json({
      success: true,
      key,
      message: "Document uploaded successfully",
    });
  } catch (err) {
    const { id } = await params;
    await logError("Failed to upload document", err, { id });

    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
