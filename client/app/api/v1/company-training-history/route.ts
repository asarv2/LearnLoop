import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer();
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

    // First get all profile IDs for the company
    const { data: companyProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company", company);

    if (profilesError) throw profilesError;

    if (!companyProfiles || companyProfiles.length === 0) {
      return NextResponse.json([]);
    }

    const profileIds = companyProfiles.map((p) => p.id);

    // Get all attempts for employees in the company, but only for Standard and Required trainings
    const { data: attempts, error: attemptsError } = await supabase
      .from("attempts")
      .select(
        `
        id,
        training_id,
        profile_id,
        created_at,
        updated_at,
        profiles(
          id,
          name,
          company
        ),
        trainings!inner(
          id,
          title,
          description,
          training_type
        )
      `
      )
      .in("profile_id", profileIds)
      .in("trainings.training_type", ["standard", "required"])
      .order("created_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    // Get all chats for these attempts
    const attemptIds = attempts?.map((attempt) => attempt.id) || [];
    let chats: Array<{
      id: string;
      attempt_id: string | null;
      title: string;
      completed: boolean;
      completed_at?: string | null;
      created_at: string;
    }> = [];

    if (attemptIds.length > 0) {
      const { data: chatsData, error: chatsError } = await supabase
        .from("chats")
        .select(
          `
          id,
          attempt_id,
          title,
          completed,
          completed_at,
          created_at
        `
        )
        .in("attempt_id", attemptIds)
        .order("created_at", { ascending: false });

      if (chatsError) throw chatsError;
      chats = chatsData || [];
    }

    // Compile the data with chat information
    const attemptsWithDetails =
      attempts?.map((attempt) => {
        // Get all chats for this attempt
        const attemptChats = chats.filter(
          (chat) => chat.attempt_id === attempt.id
        );
        const latestChat = attemptChats[0];

        // Compile chat information
        const chatInfo =
          attemptChats.length > 0
            ? {
                title: latestChat?.title || "Untitled Interview",
                name: latestChat?.title || "Unknown Candidate",
                isCompleted: attemptChats.every((chat) => chat.completed),
                completedAt: attemptChats.every((chat) => chat.completed)
                  ? attemptChats[attemptChats.length - 1]?.completed_at
                  : undefined,
                totalChats: attemptChats.length,
                completedChats: attemptChats.filter((chat) => chat.completed)
                  .length,
              }
            : {
                title: "Untitled Interview",
                name: "Unknown Candidate",
                isCompleted: false,
                totalChats: 0,
                completedChats: 0,
              };

        return {
          id: attempt.id,
          training_id: attempt.training_id,
          profile_id: attempt.profile_id,
          created_at: attempt.created_at,
          updated_at: attempt.updated_at,
          training: attempt.trainings,
          profile: attempt.profiles,
          chatInfo,
          latestChatId: latestChat?.id || null,
        };
      }) || [];

    return NextResponse.json(attemptsWithDetails);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch company training history", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
