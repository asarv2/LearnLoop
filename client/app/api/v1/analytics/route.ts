import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer();
}

// GET /api/v1/analytics - get analytics data
export async function GET() {
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
    // const analyticsQueries = [];

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
      // data: trainings,
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
      // data: completedSessions,
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

    // 5. Training completion rates by company (only active required and standard trainings)
    // First get all chats with their training and profile info
    let allChatsQuery = supabase
      .from("chats")
      .select(
        `
        completed,
        training_id,
        trainings!inner(title, training_type, active),
        profiles!inner(company)
      `
      )
      .not("training_id", "is", null);

    if (userCompany) {
      allChatsQuery = allChatsQuery.eq("profiles.company", userCompany);
    }

    const { data: allChats, error: allChatsError } = await allChatsQuery;
    if (allChatsError) throw allChatsError;

    // Filter for active required and standard trainings on the application side
    const trainingStats =
      allChats?.filter((chat) => {
        const training = (
          chat as { trainings?: { active?: boolean; training_type?: string } }
        ).trainings;
        return (
          training &&
          training.active === true &&
          (training.training_type === "required" ||
            training.training_type === "standard")
        );
      }) || [];

    // Get total employees (non-admin) for the company (including inactive ones)
    let totalEmployeesQuery = supabase
      .from("profiles")
      .select("id, role", { count: "exact" })
      .neq("role", "admin")
      .neq("role", "superadmin");

    if (userCompany) {
      totalEmployeesQuery = totalEmployeesQuery.eq("company", userCompany);
    }

    const { count: totalCompanyEmployees, error: employeesCountError } =
      await totalEmployeesQuery;
    if (employeesCountError) throw employeesCountError;

    // Group by company and training, counting unique employees
    const companyTrainingStats: Record<
      string,
      Record<string, { total: number; completed: number }>
    > = {};

    // Create a map to track which employees completed each training
    const trainingCompletionMap: Record<
      string,
      Record<string, Set<string>>
    > = {};

    // Initialize company stats
    if (!companyTrainingStats[userCompany || "Unknown"]) {
      companyTrainingStats[userCompany || "Unknown"] = {};
      trainingCompletionMap[userCompany || "Unknown"] = {};
    }

    // Get all unique trainings for this company
    const companyTrainings = [
      ...new Set(
        trainingStats
          .filter(
            (stat) =>
              (stat as { profiles?: { company?: string } }).profiles
                ?.company === userCompany
          )
          .map(
            (stat) =>
              (stat as { trainings?: { title?: string } }).trainings?.title
          )
          .filter(Boolean)
      ),
    ];

    // Initialize each training with total employee count
    companyTrainings.forEach((trainingTitle) => {
      if (trainingTitle) {
        companyTrainingStats[userCompany || "Unknown"][trainingTitle] = {
          total: totalCompanyEmployees || 0,
          completed: 0,
        };
        trainingCompletionMap[userCompany || "Unknown"][trainingTitle] =
          new Set();
      }
    });

    // Count unique employees from THIS COMPANY who completed each training
    trainingStats?.forEach((stat) => {
      const company =
        (stat as { profiles?: { company?: string } }).profiles?.company ||
        "Unknown";
      const trainingTitle =
        (stat as { trainings?: { title?: string } }).trainings?.title ||
        "Unknown Training";
      const employeeId = (stat as { profile_id?: string }).profile_id;

      // Only count if it's from the same company
      if (company === userCompany && stat.completed && employeeId) {
        if (trainingCompletionMap[company]?.[trainingTitle]) {
          trainingCompletionMap[company][trainingTitle].add(employeeId);
          companyTrainingStats[company][trainingTitle].completed =
            trainingCompletionMap[company][trainingTitle].size;
        }
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

    // 8. Average training score for all active trainings (standard, required, and custom)
    let avgTrainingScoreQuery = supabase
      .from("rubric_grades")
      .select(
        `
        score,
        chat_id,
        created_at,
        chats!inner(
          training_id,
          profile_id,
          completed_at,
          trainings!inner(id, title, training_type, active),
          profiles!inner(company, name)
        )
      `
      )
      .not("score", "is", null)
      .eq("chats.trainings.active", true);

    if (userCompany) {
      avgTrainingScoreQuery = avgTrainingScoreQuery.eq(
        "chats.profiles.company",
        userCompany
      );
    }

    const { data: trainingScoreData, error: trainingScoreError } =
      await avgTrainingScoreQuery;

    if (trainingScoreError) throw trainingScoreError;

    // Calculate average training score and find best training
    let avgTrainingScore = 0;
    let bestTraining = { name: "No Training", score: 0 };

    if (trainingScoreData && trainingScoreData.length > 0) {
      // Group scores by training
      const trainingScores: Record<string, number[]> = {};

      trainingScoreData.forEach((grade) => {
        const trainingName =
          grade.chats?.trainings?.title || "Unknown Training";
        if (!trainingScores[trainingName]) {
          trainingScores[trainingName] = [];
        }
        trainingScores[trainingName].push(grade.score || 0);
      });

      // Calculate average for each training and find the best one
      let bestScore = 0;
      let bestTrainingName = "No Training";

      Object.entries(trainingScores).forEach(([trainingName, scores]) => {
        const avgScore = Math.round(
          scores.reduce((acc, score) => acc + score, 0) / scores.length
        );
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestTrainingName = trainingName;
        }
      });

      bestTraining = { name: bestTrainingName, score: bestScore };

      // Calculate overall average
      const totalScore = trainingScoreData.reduce(
        (acc, grade) => acc + (grade.score || 0),
        0
      );
      avgTrainingScore = Math.round(totalScore / trainingScoreData.length);
    }

    // 9. Performance trends over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const performanceTrends =
      trainingScoreData
        ?.filter(
          (item) =>
            item.created_at && new Date(item.created_at) >= thirtyDaysAgo
        )
        .map((item) => ({
          date: item.created_at?.split("T")[0] || "", // Get just the date part
          score: item.score,
          employeeName: item.chats?.profiles?.name || "Unknown",
          trainingName: item.chats?.trainings?.title || "Unknown Training",
        })) || [];

    // Group by date and calculate daily averages
    const dailyPerformance = performanceTrends.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { scores: [], date: item.date };
      }
      acc[item.date].scores.push(item.score);
      return acc;
    }, {} as Record<string, { scores: number[]; date: string }>);

    const performanceChart = Object.values(dailyPerformance)
      .map((day) => ({
        date: day.date,
        averageScore: Math.round(
          day.scores.reduce((a, b) => a + b, 0) / day.scores.length
        ),
        completions: day.scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 10. Training completion trends
    const completionTrends =
      allChats
        ?.filter((chat) => {
          // Since completed_at is not available in the current query, we'll use a different approach
          return chat.completed;
        })
        .map((chat) => ({
          date: new Date().toISOString().split("T")[0], // Use current date as fallback
          trainingTitle: chat.trainings?.title || "Unknown Training",
        })) || [];

    const dailyCompletions = completionTrends.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { count: 0, date: item.date };
      }
      acc[item.date].count++;
      return acc;
    }, {} as Record<string, { count: number; date: string }>);

    const completionChart = Object.values(dailyCompletions).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // 11. Employee engagement metrics
    const engagementMetrics =
      employees?.map((employee) => {
        const employeeChats =
          allChats?.filter(
            (chat) =>
              (chat as { profile_id?: string }).profile_id === employee.id
          ) || [];
        const completedChats = employeeChats.filter((chat) => chat.completed);
        const employeeScores =
          performanceData
            ?.filter((grade) => grade.chats?.profile_id === employee.id)
            .map((grade) => grade.score || 0) || [];

        const avgScore =
          employeeScores.length > 0
            ? Math.round(
                employeeScores.reduce((a, b) => a + b, 0) /
                  employeeScores.length
              )
            : 0;

        return {
          id: employee.id,
          name: employee.name,
          company: employee.company,
          totalSessions: employeeChats.length,
          completedSessions: completedChats.length,
          completionRate:
            employeeChats.length > 0
              ? Math.round((completedChats.length / employeeChats.length) * 100)
              : 0,
          averageScore: avgScore,
          lastActive: (employee as { last_active?: string }).last_active,
        };
      }) || [];

    // 12. Training effectiveness by type
    const trainingEffectiveness =
      trainingScoreData?.reduce((acc, grade) => {
        const trainingTitle = grade.chats?.trainings?.title || "Unknown";
        const trainingType = grade.chats?.trainings?.training_type || "unknown";

        if (!acc[trainingTitle]) {
          acc[trainingTitle] = {
            title: trainingTitle,
            type: trainingType,
            scores: [],
            completions: 0,
          };
        }

        acc[trainingTitle].scores.push(grade.score);
        acc[trainingTitle].completions++;

        return acc;
      }, {} as Record<string, { title: string; type: string; scores: number[]; completions: number }>) ||
      {};

    const effectivenessData = Object.values(trainingEffectiveness)
      .map((training) => ({
        title: training.title,
        type: training.type,
        averageScore: Math.round(
          training.scores.reduce((a, b) => a + b, 0) / training.scores.length
        ),
        completions: training.completions,
        effectiveness:
          training.scores.reduce((a, b) => a + b, 0) / training.scores.length >=
          80
            ? "High"
            : training.scores.reduce((a, b) => a + b, 0) /
                training.scores.length >=
              60
            ? "Medium"
            : "Low",
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    // 13. Get available trainings by type for filter options
    let availableTrainingsQuery = supabase
      .from("trainings")
      .select("id, title, training_type, company")
      .eq("active", true);

    // Include trainings that belong to the user's company OR have no company (global trainings)
    if (userCompany) {
      // Use or() with proper string format
      availableTrainingsQuery = availableTrainingsQuery.or(
        `company.eq."${userCompany}",company.is.null`
      );
    } else {
      // If no user company, show all trainings with null company (global trainings)
      availableTrainingsQuery = availableTrainingsQuery.is("company", null);
    }

    const { data: availableTrainings, error: availableTrainingsError } =
      await availableTrainingsQuery;

    if (availableTrainingsError) throw availableTrainingsError;

    // Group trainings by type
    const trainingsByType = {
      standard:
        availableTrainings?.filter((t) => t.training_type === "standard") || [],
      required:
        availableTrainings?.filter((t) => t.training_type === "required") || [],
      custom:
        availableTrainings?.filter((t) => t.training_type === "custom") || [],
    };

    // 14. Training-specific performance data
    const trainingSpecificData =
      trainingScoreData?.map((item) => ({
        date: item.created_at,
        score: item.score || 0,
        trainingId: item.chats?.trainings?.id || item.chats?.training_id,
        trainingTitle: item.chats?.trainings?.title || "Unknown",
        trainingType: item.chats?.trainings?.training_type || "unknown",
      })) || [];

    const analytics = {
      totalEmployees: totalEmployees || 0,
      activeTrainings: activeTrainings || 0,
      completedSessions: totalCompletedSessions || 0,
      avgSessionTime,
      avgPerformanceScore,
      avgTrainingScore,
      bestTraining,
      companyTrainingStats,
      recentActivity: recentActivity || [],
      performanceData: performanceData || [],
      employees: employees || [],
      performanceChart,
      completionChart,
      engagementMetrics,
      effectivenessData,
      performanceTrends,
      trainingsByType,
      trainingSpecificData,
    };

    return NextResponse.json(analytics);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch analytics data", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
