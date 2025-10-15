import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer();
}

// GET /api/v1/training-employees - get detailed employee completion data for a specific training
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("training_id");
    const company = searchParams.get("company");

    if (!trainingId || !company) {
      return NextResponse.json(
        { error: "training_id and company parameters required" },
        { status: 400 }
      );
    }

    const supabase = await getSupabase();

    // Get all employees in the company
    const { data: companyEmployees, error: employeesError } = await supabase
      .from("profiles")
      .select("id, name, created_at")
      .eq("company", company);

    if (employeesError) throw employeesError;

    // Get employees who have completed this training (have a rubric grade)
    const { data: completedData, error: completionError } = await supabase
      .from("rubric_grades")
      .select(
        `
        created_at,
        score,
        chat_id,
        chats!inner(
          profile_id,
          training_id,
          created_at,
          profiles!inner(id, name, company)
        )
      `
      )
      .eq("chats.training_id", trainingId)
      .eq("chats.profiles.company", company)
      .not("score", "is", null);

    if (completionError) throw completionError;

    // Create a map of completed employees with their completion dates
    const completedEmployeeMap = new Map();
    completedData?.forEach((grade) => {
      const profileId = grade.chats?.profile_id;
      const profileName = grade.chats?.profiles?.name;
      const completedAt = grade.created_at;

      if (profileId && profileName) {
        // Keep the earliest completion date if there are multiple scores
        if (
          !completedEmployeeMap.has(profileId) ||
          (completedAt &&
            new Date(completedAt) <
              new Date(completedEmployeeMap.get(profileId).completedAt))
        ) {
          completedEmployeeMap.set(profileId, {
            id: profileId,
            name: profileName,
            completedAt: completedAt,
          });
        }
      }
    });

    // Separate completed and pending employees
    const completedEmployees = Array.from(completedEmployeeMap.values());

    const pendingEmployees =
      companyEmployees
        ?.filter((employee) => !completedEmployeeMap.has(employee.id))
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          assignedAt: employee.created_at, // Use employee creation date as assignment date
        })) || [];

    return NextResponse.json({
      completed: completedEmployees,
      pending: pendingEmployees,
      total_employees: companyEmployees?.length || 0,
      completed_count: completedEmployees.length,
      pending_count: pendingEmployees.length,
    });
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch training employee details", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
