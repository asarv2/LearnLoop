import { PolicyUpdateSchema, policyRepo } from "@/lib/repos/policyRepo";
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
    const fileExt = (file.name?.split(".").pop() || "").toLowerCase();
    const key = await storage.uploadFile(file, `${id}.${fileExt || "bin"}`);

    const parse = PolicyUpdateSchema.safeParse({ file_key: key });
    if (!parse.success) {
      await logError("Invalid policy update", parse.error, { id });
      return NextResponse.json(
        { error: parse.error.flatten() },
        { status: 400 }
      );
    }
    await policyRepo.update(id, parse.data);

    return NextResponse.json({ success: true, key });
  } catch (err) {
    const { id } = await params;
    await logError("Failed to upload policy file", err, { id });
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to upload policy file" },
      { status: 500 }
    );
  }
}
