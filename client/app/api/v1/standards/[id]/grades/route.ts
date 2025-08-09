import { standardRepo } from "@/lib/repos/standardRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/standards/[id]/grades  – get all grades for a standard
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const grades = await standardRepo.getGrades(id);
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    const { id } = await params;
    await logError("Failed to get standard grades", err, { standardId: id });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
