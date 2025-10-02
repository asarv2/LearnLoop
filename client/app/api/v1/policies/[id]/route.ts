import { policyRepo } from "@/lib/repos/policyRepo";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user and their profile
    const supabase = await supabaseServer(cookies());
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

    // First, check if the policy exists and belongs to the user's company
    const policy = await policyRepo.find(params.id);

    if (policy.company !== profile.company) {
      return NextResponse.json(
        { error: "Policy not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the policy
    await policyRepo.remove(params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError("Failed to delete policy", err, { id: params.id });
    return NextResponse.json(
      { error: "Failed to delete policy" },
      { status: 500 }
    );
  }
}
