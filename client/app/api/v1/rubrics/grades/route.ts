import { rubricRepo } from "@/lib/repos/rubricRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import { NextResponse } from "next/server";

// GET /api/rubrics/grades  – get all rubric grades
export async function GET() {
  try {
    const grades = await rubricRepo.getAllGrades();
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get all rubric grades", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
