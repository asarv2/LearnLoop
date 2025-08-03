import { logError } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const key = await storage.uploadFile(file, `${params.id}.pdf`);

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
