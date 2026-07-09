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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amendments: {
        Row: {
          code: string | null
          created_at: string
          id: string
          original_project_id: string
          pre_review_notes: string | null
          reception_deadline: string | null
          requester_id: string
          resolution: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          original_project_id: string
          pre_review_notes?: string | null
          reception_deadline?: string | null
          requester_id: string
          resolution?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          original_project_id?: string
          pre_review_notes?: string | null
          reception_deadline?: string | null
          requester_id?: string
          resolution?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amendments_original_project_id_fkey"
            columns: ["original_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_finding: string | null
          code: string | null
          created_at: string
          funding_source: string | null
          id: string
          location: string | null
          project_end_date: string | null
          project_id: string
          project_start_date: string | null
          requester_id: string
          required_documents_notes: string | null
          resolution_summary: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          audit_finding?: string | null
          code?: string | null
          created_at?: string
          funding_source?: string | null
          id?: string
          location?: string | null
          project_end_date?: string | null
          project_id: string
          project_start_date?: string | null
          requester_id: string
          required_documents_notes?: string | null
          resolution_summary?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          audit_finding?: string | null
          code?: string | null
          created_at?: string
          funding_source?: string | null
          id?: string
          location?: string | null
          project_end_date?: string | null
          project_id?: string
          project_start_date?: string | null
          requester_id?: string
          required_documents_notes?: string | null
          resolution_summary?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          amendment_id: string | null
          audit_finding: string | null
          audit_id: string | null
          conflict_description: string | null
          created_at: string | null
          evaluator_id: string
          general_observations: string | null
          has_conflict_of_interest: boolean | null
          id: string
          informed_consent_review: string | null
          project_id: string | null
          recommendation: string | null
          reviewer_role: string
          risk_benefit: string | null
          scientific_validity: string | null
          submitted_at: string | null
          vulnerable_groups: string | null
        }
        Insert: {
          amendment_id?: string | null
          audit_finding?: string | null
          audit_id?: string | null
          conflict_description?: string | null
          created_at?: string | null
          evaluator_id: string
          general_observations?: string | null
          has_conflict_of_interest?: boolean | null
          id?: string
          informed_consent_review?: string | null
          project_id?: string | null
          recommendation?: string | null
          reviewer_role?: string
          risk_benefit?: string | null
          scientific_validity?: string | null
          submitted_at?: string | null
          vulnerable_groups?: string | null
        }
        Update: {
          amendment_id?: string | null
          audit_finding?: string | null
          audit_id?: string | null
          conflict_description?: string | null
          created_at?: string | null
          evaluator_id?: string
          general_observations?: string | null
          has_conflict_of_interest?: boolean | null
          id?: string
          informed_consent_review?: string | null
          project_id?: string | null
          recommendation?: string | null
          reviewer_role?: string
          risk_benefit?: string | null
          scientific_validity?: string | null
          submitted_at?: string | null
          vulnerable_groups?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          amendment_id: string | null
          audit_id: string | null
          created_at: string | null
          document_type: string
          generated_by: string | null
          id: string
          project_id: string | null
          session_id: string | null
          storage_path: string
        }
        Insert: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          document_type: string
          generated_by?: string | null
          id?: string
          project_id?: string | null
          session_id?: string | null
          storage_path: string
        }
        Update: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          document_type?: string
          generated_by?: string | null
          id?: string
          project_id?: string | null
          session_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          notification_type: string
          project_id: string | null
          read_at: string | null
          recipient_id: string
          sent_at: string | null
          session_id: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          notification_type: string
          project_id?: string | null
          read_at?: string | null
          recipient_id: string
          sent_at?: string | null
          session_id?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          notification_type?: string
          project_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          session_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          confidentiality_signed: boolean | null
          conflict_declaration_signed: boolean | null
          created_at: string | null
          email: string
          faculty: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_external: boolean | null
          phone: string | null
        }
        Insert: {
          confidentiality_signed?: boolean | null
          conflict_declaration_signed?: boolean | null
          created_at?: string | null
          email: string
          faculty?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_external?: boolean | null
          phone?: string | null
        }
        Update: {
          confidentiality_signed?: boolean | null
          conflict_declaration_signed?: boolean | null
          created_at?: string | null
          email?: string
          faculty?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_external?: boolean | null
          phone?: string | null
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          amendment_id: string | null
          audit_id: string | null
          created_at: string | null
          document_type: string
          file_name: string
          id: string
          project_id: string | null
          storage_path: string
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          document_type: string
          file_name: string
          id?: string
          project_id?: string | null
          storage_path: string
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          document_type?: string
          file_name?: string
          id?: string
          project_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          project_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          project_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          abstract: string | null
          approval_date: string | null
          co_investigators: string | null
          code: string | null
          created_at: string | null
          deadline_extended: boolean | null
          duration_months: number | null
          evaluation_track: string | null
          faculty_or_center: string | null
          funding_source: string | null
          id: string
          involves_human_participants: boolean | null
          principal_investigator_id: string
          project_type: string | null
          reception_deadline: string | null
          resolution_summary: string | null
          review_deadline: string | null
          status: string | null
          submitted_at: string | null
          title: string
          updated_at: string | null
          uses_secondary_data_only: boolean | null
        }
        Insert: {
          abstract?: string | null
          approval_date?: string | null
          co_investigators?: string | null
          code?: string | null
          created_at?: string | null
          deadline_extended?: boolean | null
          duration_months?: number | null
          evaluation_track?: string | null
          faculty_or_center?: string | null
          funding_source?: string | null
          id?: string
          involves_human_participants?: boolean | null
          principal_investigator_id: string
          project_type?: string | null
          reception_deadline?: string | null
          resolution_summary?: string | null
          review_deadline?: string | null
          status?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string | null
          uses_secondary_data_only?: boolean | null
        }
        Update: {
          abstract?: string | null
          approval_date?: string | null
          co_investigators?: string | null
          code?: string | null
          created_at?: string | null
          deadline_extended?: boolean | null
          duration_months?: number | null
          evaluation_track?: string | null
          faculty_or_center?: string | null
          funding_source?: string | null
          id?: string
          involves_human_participants?: boolean | null
          principal_investigator_id?: string
          project_type?: string | null
          reception_deadline?: string | null
          resolution_summary?: string | null
          review_deadline?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string | null
          uses_secondary_data_only?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_principal_investigator_id_fkey"
            columns: ["principal_investigator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_agenda_items: {
        Row: {
          amendment_id: string | null
          audit_id: string | null
          created_at: string | null
          description: string
          id: string
          item_order: number
          project_id: string | null
          resolution: string | null
          session_id: string
          vote_result: Json | null
        }
        Insert: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          item_order: number
          project_id?: string | null
          resolution?: string | null
          session_id: string
          vote_result?: Json | null
        }
        Update: {
          amendment_id?: string | null
          audit_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          item_order?: number
          project_id?: string | null
          resolution?: string | null
          session_id?: string
          vote_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_agenda_items_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agenda_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agenda_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agenda_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendees: {
        Row: {
          attended: boolean | null
          id: string
          member_id: string
          session_id: string
          signed: boolean | null
        }
        Insert: {
          attended?: boolean | null
          id?: string
          member_id: string
          session_id: string
          signed?: boolean | null
        }
        Update: {
          attended?: boolean | null
          id?: string
          member_id?: string
          session_id?: string
          signed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "session_attendees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          minutes_summary: string | null
          quorum_met: boolean | null
          scheduled_date: string
          session_number: number
          session_type: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          minutes_summary?: string | null
          quorum_met?: boolean | null
          scheduled_date: string
          session_number: number
          session_type?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          minutes_summary?: string | null
          quorum_met?: boolean | null
          scheduled_date?: string
          session_number?: number
          session_type?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_cei_member: { Args: { _user_id: string }; Returns: boolean }
      is_investigador: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "investigador"
        | "evaluador"
        | "secretario"
        | "presidente"
        | "admin"
        | "vicepresidente"
        | "miembro_interno_cei"
        | "miembro_externo_cei"
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
      app_role: [
        "investigador",
        "evaluador",
        "secretario",
        "presidente",
        "admin",
        "vicepresidente",
        "miembro_interno_cei",
        "miembro_externo_cei",
      ],
    },
  },
} as const
