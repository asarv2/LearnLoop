import { questionRepo } from "@/lib/repos/questionRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const questions = await questionRepo.getByAssessmentId(params.id);
    return NextResponse.json(questions);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get questions for assessment", err, {
      assessmentId: params.id,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
