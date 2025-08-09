import { questionRepo } from "@/lib/repos/questionRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questions = await questionRepo.getByAssessmentId(id);
    return NextResponse.json(questions);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get questions for assessment", err, {
      assessmentId: id,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
