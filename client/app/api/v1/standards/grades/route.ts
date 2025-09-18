import { standardRepo } from "@/lib/repos/standardRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/standards/grades  – get all standard grades
export async function GET() {
  try {
    const grades = await standardRepo.getAllGrades();
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get all standard grades", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
