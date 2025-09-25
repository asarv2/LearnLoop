import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer(cookies());
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabase();
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");

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

    // Build query - show rubrics from user's company or global rubrics (company = null)
    let query = supabase
      .from("rubrics")
      .select("*")
      .order("created_at", { ascending: false });

    if (company) {
      query = query.or(`company.eq.${company},company.is.null`);
    }

    const { data: rubrics, error: rubricsError } = await query;

    if (rubricsError) throw rubricsError;

    return NextResponse.json(rubrics || []);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch rubrics", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabase();
    const body = await request.json();
    const { name, description, company, standards } = body;

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

    // Verify user can create rubrics for this company
    if (company && company !== currentProfile.company) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create the rubric
    const { data: rubric, error: rubricError } = await supabase
      .from("rubrics")
      .insert({
        name,
        description: description || null,
        company: company || null,
        total_points: 100, // Default total points
        standard_length: standards?.length || 0,
      })
      .select()
      .single();

    if (rubricError) throw rubricError;

    // Create standards for this rubric
    if (standards && standards.length > 0) {
      const standardsData = standards.map((standard: any) => ({
        rubric_id: rubric.id,
        name: standard.name,
        description: standard.description || null,
        items: standard.items || [],
      }));

      const { error: standardsError } = await supabase
        .from("standards")
        .insert(standardsData);

      if (standardsError) throw standardsError;
    }

    return NextResponse.json({
      success: true,
      rubric,
      message: "Rubric created successfully",
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to create rubric", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
