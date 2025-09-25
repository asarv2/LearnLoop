export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
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
          title: string
          training_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          title?: string
          training_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          title?: string
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
      attempts: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string | null
          training_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          training_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          training_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          attempt_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          idle_timeout: number | null
          max_turns: Json
          parameter_ids: string[] | null
          persona_ids: string[]
          persona_mapping: Json
          profile_id: string | null
          prompts: Json
          require_users: boolean
          scenario_id: string | null
          title: string
          trace_id: string | null
          training_id: string | null
          voice: string
        }
        Insert: {
          attempt_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idle_timeout?: number | null
          max_turns?: Json
          parameter_ids?: string[] | null
          persona_ids?: string[]
          persona_mapping?: Json
          profile_id?: string | null
          prompts?: Json
          require_users?: boolean
          scenario_id?: string | null
          title: string
          trace_id?: string | null
          training_id?: string | null
          voice?: string
        }
        Update: {
          attempt_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idle_timeout?: number | null
          max_turns?: Json
          parameter_ids?: string[] | null
          persona_ids?: string[]
          persona_mapping?: Json
          profile_id?: string | null
          prompts?: Json
          require_users?: boolean
          scenario_id?: string | null
          title?: string
          trace_id?: string | null
          training_id?: string | null
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
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
      documents: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          profile_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          chat_id: string
          created_at: string
          errors: string[]
          id: string
          strengths: string[]
          training_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          errors?: string[]
          id?: string
          strengths?: string[]
          training_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          errors?: string[]
          id?: string
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
      fields: {
        Row: {
          created_at: string | null
          description: string | null
          field_type: Database["public"]["Enums"]["field_type"]
          hidden: boolean
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          field_type: Database["public"]["Enums"]["field_type"]
          hidden?: boolean
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          field_type?: Database["public"]["Enums"]["field_type"]
          hidden?: boolean
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          field_ids: string[]
          id: string
          level_field_id: string | null
          mood_field_id: string | null
          name: string | null
          persona_field_id: string | null
          position_field_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_ids?: string[]
          id?: string
          level_field_id?: string | null
          mood_field_id?: string | null
          name?: string | null
          persona_field_id?: string | null
          position_field_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          field_ids?: string[]
          id?: string
          level_field_id?: string | null
          mood_field_id?: string | null
          name?: string | null
          persona_field_id?: string | null
          position_field_id?: string | null
        }
        Relationships: []
      }
      hints: {
        Row: {
          contents: string[] | null
          created_at: string | null
          difficulty: string
          id: string
          message_id: string | null
          updated_at: string | null
        }
        Insert: {
          contents?: string[] | null
          created_at?: string | null
          difficulty?: string
          id?: string
          message_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contents?: string[] | null
          created_at?: string | null
          difficulty?: string
          id?: string
          message_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hints_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
          error: string | null
          id: string
          interruption_ms: number | null
          persona_id: string | null
          role: Database["public"]["Enums"]["message_role"]
          training_id: string | null
          word_timestamps: Json[]
        }
        Insert: {
          chat_id: string
          completed?: boolean
          completed_at?: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          interruption_ms?: number | null
          persona_id?: string | null
          role: Database["public"]["Enums"]["message_role"]
          training_id?: string | null
          word_timestamps?: Json[]
        }
        Update: {
          chat_id?: string
          completed?: boolean
          completed_at?: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          interruption_ms?: number | null
          persona_id?: string | null
          role?: Database["public"]["Enums"]["message_role"]
          training_id?: string | null
          word_timestamps?: Json[]
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
            foreignKeyName: "messages_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
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
      parameters: {
        Row: {
          created_at: string | null
          description: string | null
          field_id: string | null
          id: string
          name: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          field_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          field_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parameters_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          active: boolean
          created_at: string | null
          description: string | null
          id: string
          level: Database["public"]["Enums"]["level"] | null
          name: string
          parent_id: string | null
          position: string | null
          profile_id: string | null
          realtime_prompt: string | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string | null
          voice: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["level"] | null
          name: string
          parent_id?: string | null
          position?: string | null
          profile_id?: string | null
          realtime_prompt?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["level"] | null
          name?: string
          parent_id?: string | null
          position?: string | null
          profile_id?: string | null
          realtime_prompt?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          company: string | null
          created_at: string | null
          id: string
          last_active: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          viewed_intro: boolean
        }
        Insert: {
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          id?: string
          last_active?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          viewed_intro?: boolean
        }
        Update: {
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          id?: string
          last_active?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          viewed_intro?: boolean
        }
        Relationships: []
      }
      questions: {
        Row: {
          assessment_id: string | null
          created_at: string | null
          default_question: boolean | null
          id: string
          options: string[] | null
          question_type: Database["public"]["Enums"]["question_type"]
          stem: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string | null
          default_question?: boolean | null
          id?: string
          options?: string[] | null
          question_type: Database["public"]["Enums"]["question_type"]
          stem: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string | null
          default_question?: boolean | null
          id?: string
          options?: string[] | null
          question_type?: Database["public"]["Enums"]["question_type"]
          stem?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_grades: {
        Row: {
          chat_id: string | null
          created_at: string | null
          description: string | null
          id: string
          improvements: string[]
          name: string
          score: number
          strengths: string[]
          updated_at: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          improvements?: string[]
          name: string
          score: number
          strengths?: string[]
          updated_at?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          improvements?: string[]
          name?: string
          score?: number
          strengths?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_grades_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          standard_length: number | null
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          standard_length?: number | null
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          standard_length?: number | null
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          created_at: string | null
          description: string | null
          document_ids: string[]
          field_ids: string[] | null
          group_ids: string[]
          id: string
          objectives: string[]
          parameter_ids: string[]
          parent_id: string | null
          persona_ids: string[]
          problem_statement: string | null
          prompt_mapping: Json
          prompts: Json
          rubric_id: string | null
          title: string
          training_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_ids?: string[]
          field_ids?: string[] | null
          group_ids?: string[]
          id?: string
          objectives?: string[]
          parameter_ids?: string[]
          parent_id?: string | null
          persona_ids?: string[]
          problem_statement?: string | null
          prompt_mapping?: Json
          prompts?: Json
          rubric_id?: string | null
          title: string
          training_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_ids?: string[]
          field_ids?: string[] | null
          group_ids?: string[]
          id?: string
          objectives?: string[]
          parameter_ids?: string[]
          parent_id?: string | null
          persona_ids?: string[]
          problem_statement?: string | null
          prompt_mapping?: Json
          prompts?: Json
          rubric_id?: string | null
          title?: string
          training_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_grades: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          rubric_grade_id: string | null
          score: number
          standard_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          rubric_grade_id?: string | null
          score: number
          standard_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          rubric_grade_id?: string | null
          score?: number
          standard_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standard_grades_rubric_grade_id_fkey"
            columns: ["rubric_grade_id"]
            isOneToOne: false
            referencedRelation: "rubric_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_grades_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      standards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          items: string[] | null
          name: string
          rubric_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          items?: string[] | null
          name: string
          rubric_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          items?: string[] | null
          name?: string
          rubric_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standards_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          active: boolean | null
          company: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          practice: boolean
          show_documents: boolean
          title: string
          training_type: string | null
          updated_at: string
          user_id: string | null
          what_not_to_do: string[] | null
          what_to_do: string[] | null
        }
        Insert: {
          active?: boolean | null
          company?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          practice?: boolean
          show_documents?: boolean
          title: string
          training_type?: string | null
          updated_at?: string
          user_id?: string | null
          what_not_to_do?: string[] | null
          what_to_do?: string[] | null
        }
        Update: {
          active?: boolean | null
          company?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          practice?: boolean
          show_documents?: boolean
          title?: string
          training_type?: string | null
          updated_at?: string
          user_id?: string | null
          what_not_to_do?: string[] | null
          what_to_do?: string[] | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_text: string
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_text?: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_insights: {
        Row: {
          based_on_conversations: number
          based_on_rubric_grades: number
          created_at: string
          generated_at: string
          id: string
          improvements_blurb: string
          strengths_blurb: string
          updated_at: string
          user_id: string
        }
        Insert: {
          based_on_conversations?: number
          based_on_rubric_grades?: number
          created_at?: string
          generated_at?: string
          id?: string
          improvements_blurb: string
          strengths_blurb: string
          updated_at?: string
          user_id: string
        }
        Update: {
          based_on_conversations?: number
          based_on_rubric_grades?: number
          created_at?: string
          generated_at?: string
          id?: string
          improvements_blurb?: string
          strengths_blurb?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      field_type: "persona" | "document" | "numerical" | "categorical" | "text"
      interview_type: "regular" | "cheating" | "ai-assisted"
      level: "junior" | "mid" | "senior" | "executive"
      log_level: "info" | "error" | "warn" | "debug"
      message_role: "user" | "assistant"
      question_type: "mcq" | "frq"
      training_type: "interview" | "offboarding"
      user_role: "employee" | "admin" | "superadmin"
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
      field_type: ["persona", "document", "numerical", "categorical", "text"],
      interview_type: ["regular", "cheating", "ai-assisted"],
      level: ["junior", "mid", "senior", "executive"],
      log_level: ["info", "error", "warn", "debug"],
      message_role: ["user", "assistant"],
      question_type: ["mcq", "frq"],
      training_type: ["interview", "offboarding"],
      user_role: ["employee", "admin", "superadmin"],
    },
  },
} as const
