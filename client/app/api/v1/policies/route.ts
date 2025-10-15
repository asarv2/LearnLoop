import { PolicyCreateSchema, policyRepo } from "@/lib/repos/policyRepo";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await policyRepo.list();
    return NextResponse.json(data);
  } catch (err) {
    await logError("Failed to list policies", err, {});
    return NextResponse.json(
      { error: "Failed to list policies" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Get current user and their profile
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile to get their company
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company) {
      return NextResponse.json(
        { error: "User profile not found or no company assigned" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parse = PolicyCreateSchema.safeParse({
      ...body,
      profile_id: user.id, // Set the current user's profile_id
      company: profile.company, // Set the user's company
    });

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.flatten() },
        { status: 400 }
      );
    }

    const created = await policyRepo.create(parse.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    await logError("Failed to create policy", err, {});
    return NextResponse.json(
      { error: "Failed to create policy" },
      { status: 500 }
    );
  }
}
