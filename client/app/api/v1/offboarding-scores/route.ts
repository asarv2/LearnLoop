import { offboardingScoreRepo } from "@/lib/repos/offboardingScoreRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/v1/offboarding-scores – list
export async function GET() {
  try {
    const rows = await offboardingScoreRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list offboarding scores", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
