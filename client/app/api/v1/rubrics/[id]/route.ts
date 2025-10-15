import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer(cookies());
}

export async function DELETE(
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

    // Get the rubric to verify ownership
    const { data: rubric, error: rubricError } = await supabase
      .from("rubrics")
      .select("id, name, company")
      .eq("id", rubricId)
      .single();

    if (rubricError || !rubric) {
      return NextResponse.json({ error: "Rubric not found" }, { status: 404 });
    }

    // Verify user can delete this rubric
    // Only allow deletion of company-specific rubrics that belong to the user's company
    if (!rubric.company || rubric.company !== currentProfile.company) {
      return NextResponse.json(
        {
          error:
            "Access denied. You can only delete rubrics from your own company.",
        },
        { status: 403 }
      );
    }

    // Delete associated standards first (due to foreign key constraints)
    const { error: standardsDeleteError } = await supabase
      .from("standards")
      .delete()
      .eq("rubric_id", rubricId);

    if (standardsDeleteError) {
      throw new Error(
        `Failed to delete rubric standards: ${standardsDeleteError.message}`
      );
    }

    // Delete the rubric
    const { error: rubricDeleteError } = await supabase
      .from("rubrics")
      .delete()
      .eq("id", rubricId);

    if (rubricDeleteError) {
      throw new Error(`Failed to delete rubric: ${rubricDeleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Rubric deleted successfully",
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to delete rubric", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
