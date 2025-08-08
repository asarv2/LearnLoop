import { interviewScoreRepo } from "@/lib/repos/interviewScoreRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/v1/interview-scores – list
export async function GET() {
  try {
    const rows = await interviewScoreRepo.list();
    return NextResponse.json(rows);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to list interview scores", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
