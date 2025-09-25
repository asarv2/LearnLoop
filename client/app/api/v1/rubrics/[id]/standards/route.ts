import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer(cookies());
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabase();
    const { id: rubricId } = await params;

    // Get current user to verify they can access this data
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's profile to verify company access
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("company, role")
      .eq("id", user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get the rubric first to verify access
    const { data: rubric, error: rubricError } = await supabase
      .from("rubrics")
      .select("id, name, company")
      .eq("id", rubricId)
      .single();

    if (rubricError || !rubric) {
      return NextResponse.json({ error: "Rubric not found" }, { status: 404 });
    }

    // Verify user can access this rubric (company match or null company)
    if (rubric.company && rubric.company !== currentProfile.company) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get standards for this rubric
    const { data: standards, error: standardsError } = await supabase
      .from("standards")
      .select(
        `
        id,
        name,
        description,
        items,
        created_at,
        updated_at
      `
      )
      .eq("rubric_id", rubricId)
      .order("created_at", { ascending: true });

    if (standardsError) throw standardsError;

    return NextResponse.json({
      rubric: {
        id: rubric.id,
        name: rubric.name,
        company: rubric.company,
      },
      standards: standards || [],
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch rubric standards", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
