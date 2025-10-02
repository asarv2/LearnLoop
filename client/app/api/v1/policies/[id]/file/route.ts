import { policyRepo } from "@/lib/repos/policyRepo";
import { storage } from "@/lib/storage";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

const ONE_HOUR = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const policy = await policyRepo.find(id);
    const key = policy.file_key || `${id}.pdf`;
    const url = await storage.getSignedUrl(key, ONE_HOUR);
    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const { id } = await params;
    await logError("Failed to presign policy", err, { id });
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }
}
