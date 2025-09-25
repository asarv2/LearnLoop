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

    if (!company) {
      return NextResponse.json(
        { error: "Company parameter is required" },
        { status: 400 }
      );
    }

    // Get current user to verify they can access this company's data
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

    // Verify user can access this company's data
    if (currentProfile.company !== company) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch employees from the specified company
    const { data: employees, error: employeesError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        name,
        role,
        company,
        active,
        created_at,
        updated_at,
        last_active
      `
      )
      .eq("company", company)
      .order("last_active", { ascending: false, nullsLast: true });

    if (employeesError) throw employeesError;

    return NextResponse.json(employees || []);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch employees", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
