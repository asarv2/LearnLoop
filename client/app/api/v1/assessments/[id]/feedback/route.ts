import { assessmentRepo } from "@/lib/repos/assessmentRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/assessments/[id]/feedback  – get all feedback for an assessment
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const feedback = await assessmentRepo.getFeedback(id);
    return NextResponse.json(feedback);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get assessment feedback", err, {
      assessmentId: id,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
