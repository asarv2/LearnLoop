export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          responses: Json
          training_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          responses?: Json
          training_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          responses?: Json
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          additional_info: string
          completed: boolean
          completed_at: string
          created_at: string
          feedback: Json | null
          id: string
          name: string
          position: string
          resume_id: string | null
          title: string
          trace_id: string | null
          training_id: string | null
          training_type: Database["public"]["Enums"]["training_type"] | null
          type: Database["public"]["Enums"]["interview_type"]
          user_id: string | null
          voice: string
        }
        Insert: {
          additional_info?: string
          completed?: boolean
          completed_at?: string
          created_at?: string
          feedback?: Json | null
          id?: string
          name?: string
          position?: string
          resume_id?: string | null
          title: string
          trace_id?: string | null
          training_id?: string | null
          training_type?: Database["public"]["Enums"]["training_type"] | null
          type?: Database["public"]["Enums"]["interview_type"]
          user_id?: string | null
          voice?: string
        }
        Update: {
          additional_info?: string
          completed?: boolean
          completed_at?: string
          created_at?: string
          feedback?: Json | null
          id?: string
          name?: string
          position?: string
          resume_id?: string | null
          title?: string
          trace_id?: string | null
          training_id?: string | null
          training_type?: Database["public"]["Enums"]["training_type"] | null
          type?: Database["public"]["Enums"]["interview_type"]
          user_id?: string | null
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          chat_id: string
          created_at: string
          errors: string[]
          green_flags: string[]
          id: string
          red_flags: string[]
          strengths: string[]
          training_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          errors?: string[]
          green_flags?: string[]
          id?: string
          red_flags?: string[]
          strengths?: string[]
          training_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          errors?: string[]
          green_flags?: string[]
          id?: string
          red_flags?: string[]
          strengths?: string[]
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_scores: {
        Row: {
          assessment_thoughtfulness: number
          category_feedback: Json
          chat_id: string
          communication_rapport: number
          created_at: string
          followup_skills: number
          id: string
          improvement_areas: string[] | null
          interview_conduct: number
          overall_feedback: string | null
          overall_score: number
          professional_judgment: number
          question_quality: number
          strengths: string[] | null
          training_id: string | null
          updated_at: string
        }
        Insert: {
          assessment_thoughtfulness: number
          category_feedback?: Json
          chat_id: string
          communication_rapport: number
          created_at?: string
          followup_skills: number
          id?: string
          improvement_areas?: string[] | null
          interview_conduct: number
          overall_feedback?: string | null
          overall_score: number
          professional_judgment: number
          question_quality: number
          strengths?: string[] | null
          training_id?: string | null
          updated_at?: string
        }
        Update: {
          assessment_thoughtfulness?: number
          category_feedback?: Json
          chat_id?: string
          communication_rapport?: number
          created_at?: string
          followup_skills?: number
          id?: string
          improvement_areas?: string[] | null
          interview_conduct?: number
          overall_feedback?: string | null
          overall_score?: number
          professional_judgment?: number
          question_quality?: number
          strengths?: string[] | null
          training_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_scores_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_scores_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          training_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          training_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          training_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          completed: boolean
          completed_at: string
          content: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          training_id: string | null
        }
        Insert: {
          chat_id: string
          completed?: boolean
          completed_at?: string
          content?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
          training_id?: string | null
        }
        Update: {
          chat_id?: string
          completed?: boolean
          completed_at?: string
          content?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_scores: {
        Row: {
          assessment_thoughtfulness: number
          category_feedback: Json
          chat_id: string
          clarity_of_next_steps: number
          communication_professionalism: number
          conflict_resolution: number
          created_at: string
          empathy_emotional_intelligence: number
          id: string
          improvement_areas: string[] | null
          overall_feedback: string | null
          overall_score: number
          strengths: string[] | null
          training_id: string | null
          transition_planning_logistics: number
          updated_at: string
        }
        Insert: {
          assessment_thoughtfulness: number
          category_feedback?: Json
          chat_id: string
          clarity_of_next_steps?: number
          communication_professionalism: number
          conflict_resolution: number
          created_at?: string
          empathy_emotional_intelligence: number
          id?: string
          improvement_areas?: string[] | null
          overall_feedback?: string | null
          overall_score: number
          strengths?: string[] | null
          training_id?: string | null
          transition_planning_logistics: number
          updated_at?: string
        }
        Update: {
          assessment_thoughtfulness?: number
          category_feedback?: Json
          chat_id?: string
          clarity_of_next_steps?: number
          communication_professionalism?: number
          conflict_resolution?: number
          created_at?: string
          empathy_emotional_intelligence?: number
          id?: string
          improvement_areas?: string[] | null
          overall_feedback?: string | null
          overall_score?: number
          strengths?: string[] | null
          training_id?: string | null
          transition_planning_logistics?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_scores_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_scores_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          content: string | null
          created_at: string
          google_file_id: string | null
          id: string
          training_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          google_file_id?: string | null
          id?: string
          training_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          google_file_id?: string | null
          id?: string
          training_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resumes_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          additional_info: Json | null
          created_at: string
          id: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          additional_info?: Json | null
          created_at?: string
          id?: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          additional_info?: Json | null
          created_at?: string
          id?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      interview_type: "regular" | "cheating" | "ai-assisted"
      log_level: "info" | "error" | "warn" | "debug"
      message_role: "user" | "assistant"
      training_type: "interview" | "offboarding"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      interview_type: ["regular", "cheating", "ai-assisted"],
      log_level: ["info", "error", "warn", "debug"],
      message_role: ["user", "assistant"],
      training_type: ["interview", "offboarding"],
    },
  },
} as const
