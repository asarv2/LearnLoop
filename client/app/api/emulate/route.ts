import { Profile } from "@/types";
import { ViewMode } from "@/types/auth";
import createServerClient from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Helper function to check if user can emulate a specific view mode
async function canEmulateViewMode(
  requesterRole: string | null,
  targetViewMode: ViewMode,
  userProfile: Pick<Profile, "active">
): Promise<{ allowed: boolean; reason?: string }> {
  // Validate requester role exists and is valid
  if (
    !requesterRole ||
    !["employee", "admin", "superadmin"].includes(requesterRole)
  ) {
    return { allowed: false, reason: "Invalid user role" };
  }

  // Only admins and superadmins can emulate different view modes
  if (requesterRole === "employee") {
    return {
      allowed: false,
      reason: "Employees cannot emulate other view modes",
    };
  }

  // Check if user profile is active
  if (!userProfile?.active) {
    return { allowed: false, reason: "User profile is not active" };
  }

  // Superadmins can emulate any view mode
  if (requesterRole === "superadmin") {
    return { allowed: true };
  }

  // Regular admins cannot emulate any view mode - they can only see admin view
  if (requesterRole === "admin") {
    return {
      allowed: false,
      reason: "Admins can only see admin view - no emulation allowed",
    };
  }

  return { allowed: false, reason: "Unauthorized emulation request" };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // Get current user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile to check their role and status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active, name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup failed:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { viewMode } = body;

    if (!viewMode) {
      return NextResponse.json({ error: "Missing viewMode" }, { status: 400 });
    }

    // Validate view mode
    const validViewModes: ViewMode[] = ["employee", "admin", "superadmin"];
    if (!validViewModes.includes(viewMode)) {
      return NextResponse.json(
        {
          error: "Invalid viewMode",
          details: `Must be one of: ${validViewModes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if user can emulate this view mode
    const { allowed, reason } = await canEmulateViewMode(
      profile.role,
      viewMode,
      profile
    );

    if (!allowed) {
      console.warn(`Emulation denied for user ${user.id}: ${reason}`);
      return NextResponse.json(
        { error: "Forbidden", details: reason },
        { status: 403 }
      );
    }

    // Additional security: Check if user is trying to emulate their own role
    if (profile.role === viewMode) {
      console.warn(
        `User ${user.id} attempted to emulate their own role: ${viewMode}`
      );
      return NextResponse.json({
        ok: true,
        viewMode,
        message: `Already viewing as ${viewMode}`,
      });
    }

    // Update user metadata with emulation mode
    const emulationData = {
      emulationMode: viewMode,
      emulationTTL: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      emulationStartedAt: Date.now(),
      originalRole: profile.role,
    };

    const { error: updateError } = await supabase.auth.updateUser({
      data: emulationData,
    });

    if (updateError) {
      console.error("Failed to update user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to start emulation" },
        { status: 500 }
      );
    }

    // Log successful emulation for audit trail
    console.info(
      `User ${user.id} (${profile.name}) started emulation: ${profile.role} -> ${viewMode}`
    );

    return NextResponse.json({
      ok: true,
      viewMode,
      originalRole: profile.role,
      message: `Now viewing as ${viewMode}`,
    });
  } catch (error) {
    console.error("Emulation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // Get current user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile for logging
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();

    // Check if user is currently emulating
    const currentEmulationMode = user.user_metadata?.emulationMode;
    if (!currentEmulationMode) {
      return NextResponse.json({
        ok: true,
        message: "No active emulation to stop",
      });
    }

    // Clear emulation mode from user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        emulationMode: null,
        emulationTTL: null,
        emulationStartedAt: null,
        originalRole: null,
      },
    });

    if (updateError) {
      console.error("Failed to clear user metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to stop emulation" },
        { status: 500 }
      );
    }

    // Log successful emulation stop for audit trail
    console.info(
      `User ${user.id} (${
        profile?.name || "Unknown"
      }) stopped emulation: ${currentEmulationMode} -> ${
        profile?.role || "unknown"
      }`
    );

    return NextResponse.json({
      ok: true,
      message: "Emulation stopped",
      restoredRole: profile?.role,
    });
  } catch (error) {
    console.error("Stop emulation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
