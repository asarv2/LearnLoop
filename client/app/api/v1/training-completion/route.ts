import { handleHttpError } from "@/utils/HttpError";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  return await supabaseServer();
}

// GET /api/v1/training-completion - get completion rates for trainings by company
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");

    if (!company) {
      return NextResponse.json(
        { error: "Company parameter required" },
        { status: 400 }
      );
    }

    const supabase = await getSupabase();

    // Get all employees in the company
    const { data: companyEmployees, error: employeesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company", company);

    if (employeesError) throw employeesError;

    const totalCompanyEmployees = companyEmployees?.length || 0;

    // Get all required trainings for the company
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("id")
      .eq("training_type", "required")
      .eq("company", company);

    if (trainingsError) throw trainingsError;

    if (!trainings || trainings.length === 0) {
      return NextResponse.json([]);
    }

    // For each training, count how many company employees have received a score
    const completionData = await Promise.all(
      trainings.map(async (training) => {
        // Count employees who have completed this training (have a rubric grade)
        const { data: completedEmployees, error: completionError } =
          await supabase
            .from("rubric_grades")
            .select(
              `
            chat_id,
            chats!inner(
              profile_id,
              training_id,
              profiles!inner(company)
            )
          `
            )
            .eq("chats.training_id", training.id)
            .eq("chats.profiles.company", company)
            .not("score", "is", null);

        if (completionError) {
          console.error(
            `Error fetching completion for training ${training.id}:`,
            completionError
          );
          return {
            training_id: training.id,
            completed_count: 0,
            total_company_employees: totalCompanyEmployees,
            completion_rate: 0,
          };
        }

        // Get unique employees (in case they have multiple scores for same training)
        const uniqueCompletedEmployees = new Set(
          completedEmployees?.map((grade) => grade.chats?.profile_id) || []
        );

        const completedCount = uniqueCompletedEmployees.size;
        const completionRate =
          totalCompanyEmployees > 0
            ? Math.round((completedCount / totalCompanyEmployees) * 100)
            : 0;

        return {
          training_id: training.id,
          completed_count: completedCount,
          total_company_employees: totalCompanyEmployees,
          completion_rate: completionRate,
        };
      })
    );

    return NextResponse.json(completionData);
  } catch (err) {
    const { statusCode, message } = handleHttpError(err);
    await logError("Failed to fetch training completion rates", err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
