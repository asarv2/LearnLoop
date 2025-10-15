import { rubricRepo } from "@/lib/repos/rubricRepo";
import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// GET /api/rubrics/grades  – get all rubric grades for the current user
export async function GET() {
  try {
    // Get current user from Supabase
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The user ID is the same as the profile ID in this system
    const profileId = user.id;
    const grades = await rubricRepo.getAllGradesForUser(profileId);
    return NextResponse.json(grades);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to get all rubric grades", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
