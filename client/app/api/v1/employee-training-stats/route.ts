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

    // Get all employees from the company
    const { data: employees, error: employeesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company", company);

    if (employeesError) throw employeesError;

    const employeeIds = employees?.map((emp) => emp.id) || [];
    const stats: Record<
      string,
      { completed_count: number; average_score: number }
    > = {};

    // Initialize stats for all employees
    employeeIds.forEach((id) => {
      stats[id] = { completed_count: 0, average_score: 0 };
    });

    if (employeeIds.length > 0) {
      // Get training completion counts and average scores for each employee
      const { data: trainingStats, error: statsError } = await supabase
        .from("rubric_grades")
        .select(
          `
          score,
          chats!inner(
            profile_id,
            training_id
          )
        `
        )
        .in("chats.profile_id", employeeIds)
        .not("score", "is", null);

      if (statsError) throw statsError;

      // Process the data to calculate stats per employee
      const employeeStats: Record<
        string,
        { scores: number[]; completedTrainings: Set<string> }
      > = {};

      trainingStats?.forEach((grade) => {
        const profileId = grade.chats?.profile_id;
        const trainingId = grade.chats?.training_id;
        const score = grade.score;

        if (profileId && trainingId && score !== null) {
          if (!employeeStats[profileId]) {
            employeeStats[profileId] = {
              scores: [],
              completedTrainings: new Set(),
            };
          }
          employeeStats[profileId].scores.push(score);
          employeeStats[profileId].completedTrainings.add(trainingId);
        }
      });

      // Calculate final stats
      Object.entries(employeeStats).forEach(([employeeId, data]) => {
        const completedCount = data.completedTrainings.size;
        const averageScore =
          data.scores.length > 0
            ? data.scores.reduce((sum, score) => sum + score, 0) /
              data.scores.length
            : 0;

        stats[employeeId] = {
          completed_count: completedCount,
          average_score: averageScore,
        };
      });
    }

    return NextResponse.json(stats);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch employee training stats", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
