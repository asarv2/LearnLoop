import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer(cookies());
}

// GET /api/v1/analytics - get analytics data
export async function GET(request: Request) {
  try {
    const supabase = await getSupabase();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's profile to determine their company
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("company, role")
      .eq("id", user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // All users (including superadmins) are restricted to their company data
    const userCompany = currentProfile.company;

    // Build analytics queries
    const analyticsQueries = [];

    // 1. Total employees (filtered by company)
    let employeesQuery = supabase
      .from("profiles")
      .select("id, name, company, role, active", { count: "exact" });

    if (userCompany) {
      employeesQuery = employeesQuery.eq("company", userCompany);
    }

    const {
      data: employees,
      count: totalEmployees,
      error: employeesError,
    } = await employeesQuery;

    if (employeesError) throw employeesError;

    // 2. Active trainings
    const {
      data: trainings,
      count: activeTrainings,
      error: trainingsError,
    } = await supabase
      .from("trainings")
      .select("id, title, active", { count: "exact" })
      .eq("active", true);

    if (trainingsError) throw trainingsError;

    // 3. Completed sessions (chats that are completed)
    let completedSessionsQuery = supabase
      .from("chats")
      .select(
        "id, completed, completed_at, profile_id, profiles!inner(company)",
        { count: "exact" }
      )
      .eq("completed", true);

    if (userCompany) {
      completedSessionsQuery = completedSessionsQuery.eq(
        "profiles.company",
        userCompany
      );
    }

    const {
      data: completedSessions,
      count: totalCompletedSessions,
      error: sessionsError,
    } = await completedSessionsQuery;

    if (sessionsError) throw sessionsError;

    // 4. Average session time (in minutes)
    let avgSessionTimeQuery = supabase
      .from("chats")
      .select("created_at, completed_at, profile_id, profiles!inner(company)")
      .eq("completed", true)
      .not("completed_at", "is", null);

    if (userCompany) {
      avgSessionTimeQuery = avgSessionTimeQuery.eq(
        "profiles.company",
        userCompany
      );
    }

    const { data: sessionTimes, error: sessionTimeError } =
      await avgSessionTimeQuery;

    if (sessionTimeError) throw sessionTimeError;

    // Calculate average session time
    let avgSessionTime = 0;
    if (sessionTimes && sessionTimes.length > 0) {
      const totalMinutes = sessionTimes.reduce((acc, session) => {
        if (session.created_at && session.completed_at) {
          const start = new Date(session.created_at);
          const end = new Date(session.completed_at);
          const diffMs = end.getTime() - start.getTime();
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          return acc + diffMinutes;
        }
        return acc;
      }, 0);
      avgSessionTime = Math.round(totalMinutes / sessionTimes.length);
    }

    // 5. Training completion rates by company
    let trainingStatsQuery = supabase
      .from("chats")
      .select(
        `
        completed,
        training_id,
        trainings!inner(title),
        profiles!inner(company)
      `
      )
      .not("training_id", "is", null);

    if (userCompany) {
      trainingStatsQuery = trainingStatsQuery.eq(
        "profiles.company",
        userCompany
      );
    }

    const { data: trainingStats, error: trainingStatsError } =
      await trainingStatsQuery;

    if (trainingStatsError) throw trainingStatsError;

    // Group by company and training
    const companyTrainingStats: Record<
      string,
      Record<string, { total: number; completed: number }>
    > = {};

    trainingStats?.forEach((stat) => {
      const company = stat.profiles?.company || "Unknown";
      const trainingTitle = stat.trainings?.title || "Unknown Training";

      if (!companyTrainingStats[company]) {
        companyTrainingStats[company] = {};
      }

      if (!companyTrainingStats[company][trainingTitle]) {
        companyTrainingStats[company][trainingTitle] = {
          total: 0,
          completed: 0,
        };
      }

      companyTrainingStats[company][trainingTitle].total++;
      if (stat.completed) {
        companyTrainingStats[company][trainingTitle].completed++;
      }
    });

    // 6. Recent activity (last 10 completed sessions)
    let recentActivityQuery = supabase
      .from("chats")
      .select(
        `
        id,
        title,
        completed_at,
        profile_id,
        profiles!inner(name, company)
      `
      )
      .eq("completed", true)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (userCompany) {
      recentActivityQuery = recentActivityQuery.eq(
        "profiles.company",
        userCompany
      );
    }

    const { data: recentActivity, error: recentActivityError } =
      await recentActivityQuery;

    if (recentActivityError) throw recentActivityError;

    // 7. Employee performance metrics (based on rubric grades)
    let performanceQuery = supabase
      .from("rubric_grades")
      .select(
        `
        score,
        chat_id,
        chats!inner(profile_id, profiles!inner(company))
      `
      )
      .not("score", "is", null);

    if (userCompany) {
      performanceQuery = performanceQuery.eq(
        "chats.profiles.company",
        userCompany
      );
    }

    const { data: performanceData, error: performanceError } =
      await performanceQuery;

    if (performanceError) throw performanceError;

    // Calculate average performance score
    let avgPerformanceScore = 0;
    if (performanceData && performanceData.length > 0) {
      const totalScore = performanceData.reduce(
        (acc, grade) => acc + (grade.score || 0),
        0
      );
      avgPerformanceScore = Math.round(totalScore / performanceData.length);
    }

    const analytics = {
      totalEmployees: totalEmployees || 0,
      activeTrainings: activeTrainings || 0,
      completedSessions: totalCompletedSessions || 0,
      avgSessionTime,
      avgPerformanceScore,
      companyTrainingStats,
      recentActivity: recentActivity || [],
      performanceData: performanceData || [],
      employees: employees || [],
    };

    return NextResponse.json(analytics);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch analytics data", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
