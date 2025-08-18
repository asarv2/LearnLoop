import { documentRepo, DocumentUpdateSchema } from '@/lib/repos/documentRepo';
import { storage } from "@/lib/storage";
import { logError } from "@/utils/logger";
import { extractTextFromPDF } from "@/utils/pdf/extract";
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

    // extract text from pdf
    // 1. Create a buffer from the file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // 2. Extract text from the buffer
    const text = await extractTextFromPDF(buffer);

    const parse = DocumentUpdateSchema.safeParse({
      content: text,
    });
    if (!parse.success) {
      await logError("Invalid document update", parse.error, { id });
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
    }
    await documentRepo.update(id, parse.data);

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
