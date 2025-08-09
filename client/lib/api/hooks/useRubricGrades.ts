import { supabaseApi } from "@/utils/supabase/supabase-api";
import { useQuery } from "@tanstack/react-query";

export interface RubricGrade {
  id: string;
  name: string;
  description?: string;
  chat_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface StandardGrade {
  id: string;
  name: string;
  description?: string;
  standard_id: string;
  rubric_grade_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export const useRubricGrades = () => {
  return useQuery({
    queryKey: ["rubric_grades"],
    queryFn: async () => {
      const { data, error } = await supabaseApi
        .from("rubric_grades")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RubricGrade[];
    },
  });
};

export const useStandardGrades = () => {
  return useQuery({
    queryKey: ["standard_grades"],
    queryFn: async () => {
      const { data, error } = await supabaseApi
        .from("standard_grades")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StandardGrade[];
    },
  });
};

// Hook to get standard grades for a specific training type based on rubric/scenario matching
export const useStandardGradesByTraining = (trainingType: string) => {
  return useQuery({
    queryKey: ["standard_grades_by_training", trainingType],
    queryFn: async () => {
      // First, find trainings matching the type
      const { data: trainings, error: trainingsError } = await supabaseApi
        .from("trainings")
        .select("id, title")
        .ilike("title", `%${trainingType}%`);

      if (trainingsError) throw trainingsError;
      if (!trainings || trainings.length === 0) return [];

      // Get scenarios for these trainings
      const trainingIds = trainings.map((t) => t.id);
      const { data: scenarios, error: scenariosError } = await supabaseApi
        .from("scenarios")
        .select("rubric_id, training_id")
        .in("training_id", trainingIds);

      if (scenariosError) throw scenariosError;
      if (!scenarios || scenarios.length === 0) return [];

      // Get rubric grades for these scenarios and their standard grades
      const rubricIds = scenarios.map((s) => s.rubric_id);
      const { data: standardGrades, error: standardGradesError } =
        await supabaseApi
          .from("standard_grades")
          .select(
            `
          *,
          standards!inner(name, description, rubric_id),
          rubric_grades!inner(chat_id, created_at)
        `
          )
          .in("standards.rubric_id", rubricIds);

      if (standardGradesError) throw standardGradesError;
      return standardGrades || [];
    },
  });
};
