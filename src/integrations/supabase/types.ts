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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      // organisations and org_members are hand-added from
      // supabase/migrations/20261116150000_domain_schema.sql; regenerate this
      // file with `supabase gen types` once the migration is applied.
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          org_id: string
          role: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status: "active" | "disabled"
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          org_id: string
          role: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status?: "active" | "disabled"
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          org_id?: string
          role?: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status?: "active" | "disabled"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      // invitations is hand-added from
      // supabase/migrations/20261117100000_voice_platform.sql and
      // 20261117120000_invitation_lifecycle.sql; regenerate once applied.
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          error: string | null
          expires_at: string
          id: string
          invited_by: string | null
          invited_user_id: string | null
          org_id: string
          role: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status: "pending" | "accepted" | "revoked" | "expired" | "failed"
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          error?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          org_id: string
          role: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status?: "pending" | "accepted" | "revoked" | "expired" | "failed"
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          error?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          org_id?: string
          role?: "super_admin" | "org_admin" | "supervisor" | "agent" | "qa_analyst"
          status?: "pending" | "accepted" | "revoked" | "expired" | "failed"
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      // agents and agent_versions are hand-added (partial: only the columns
      // Agent Studio reads or writes) from
      // supabase/migrations/20261116150000_domain_schema.sql; regenerate
      // this file with `supabase gen types` once applied.
      agents: {
        Row: {
          created_at: string
          description: string
          id: string
          live_version: string | null
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          live_version?: string | null
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          live_version?: string | null
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      agent_versions: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          dictionary: Json
          first_message: string
          id: string
          org_id: string
          persona_handoff: string
          persona_tone: string
          prompt: string
          speed: number
          version: string
          voice: string
          warmth: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          dictionary?: Json
          first_message?: string
          id?: string
          org_id: string
          persona_handoff?: string
          persona_tone?: string
          prompt?: string
          speed?: number
          version: string
          voice?: string
          warmth?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          dictionary?: Json
          first_message?: string
          id?: string
          org_id?: string
          persona_handoff?: string
          persona_tone?: string
          prompt?: string
          speed?: number
          version?: string
          voice?: string
          warmth?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      // calls, evaluation_templates, evaluation_criteria, evaluations and
      // evaluation_scores are hand-added (partial: only the columns the QA
      // Scorecards screen reads or writes) from
      // supabase/migrations/20261116150000_domain_schema.sql,
      // 20261117100000_voice_platform.sql and
      // 20261118130000_evaluation_review_assignment.sql; regenerate this
      // file with `supabase gen types` once applied.
      calls: {
        Row: {
          caller_name: string
          id: string
          org_id: string
          started_at: string
          status: string
        }
        Insert: {
          caller_name?: string
          id?: string
          org_id: string
          started_at?: string
          status?: string
        }
        Update: {
          caller_name?: string
          id?: string
          org_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      evaluation_templates: {
        Row: {
          id: string
          name: string
          org_id: string
          pass_threshold: number
          status: "draft" | "active" | "retired"
          version: number
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          pass_threshold?: number
          status?: "draft" | "active" | "retired"
          version: number
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          pass_threshold?: number
          status?: "draft" | "active" | "retired"
          version?: number
        }
        Relationships: []
      }
      evaluation_criteria: {
        Row: {
          id: string
          name: string
          org_id: string
          position: number
          template_id: string
          weight: number
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          position?: number
          template_id: string
          weight: number
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          position?: number
          template_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          assigned_reviewer_id: string | null
          call_id: string
          completed_at: string | null
          created_at: string
          flagged: boolean
          id: string
          org_id: string
          overall_score: number | null
          status: "queued" | "running" | "completed" | "failed"
          template_id: string
        }
        Insert: {
          assigned_reviewer_id?: string | null
          call_id: string
          completed_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          org_id: string
          overall_score?: number | null
          status?: "queued" | "running" | "completed" | "failed"
          template_id: string
        }
        Update: {
          assigned_reviewer_id?: string | null
          call_id?: string
          completed_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          org_id?: string
          overall_score?: number | null
          status?: "queued" | "running" | "completed" | "failed"
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_scores: {
        Row: {
          criterion_id: string
          evaluation_id: string
          id: string
          org_id: string
          rationale: string
          score: number
        }
        Insert: {
          criterion_id: string
          evaluation_id: string
          id?: string
          org_id: string
          rationale?: string
          score: number
        }
        Update: {
          criterion_id?: string
          evaluation_id?: string
          id?: string
          org_id?: string
          rationale?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_reviews: {
        Row: {
          comment: string
          created_at: string
          evaluation_id: string
          id: string
          org_id: string
          override_overall: number | null
          override_scores: Json | null
          reviewer_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          evaluation_id: string
          id?: string
          org_id: string
          override_overall?: number | null
          override_scores?: Json | null
          reviewer_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          org_id?: string
          override_overall?: number | null
          override_scores?: Json | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_reviews_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_member_status: {
        Args: { org: string; member: string; new_status: string }
        Returns: Database["public"]["Tables"]["org_members"]["Row"]
      }
      submit_evaluation: {
        Args: { call_id: string; template_id: string; scores: Json; idempotency_key: string }
        Returns: Database["public"]["Tables"]["evaluations"]["Row"]
      }
      add_evaluation_review: {
        Args: { evaluation_id: string; comment?: string; override_overall?: number | null; override_scores?: Json | null }
        Returns: {
          id: string
          evaluation_id: string
          reviewer_id: string
          comment: string
          override_overall: number | null
          override_scores: Json | null
          created_at: string
        }
      }
      assign_evaluation_reviewer: {
        Args: { target_evaluation_id: string; new_reviewer_id?: string | null }
        Returns: Database["public"]["Tables"]["evaluations"]["Row"]
      }
      publish_agent_version: {
        Args: { target_agent_id: string; target_version: string }
        Returns: Database["public"]["Tables"]["agents"]["Row"]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
