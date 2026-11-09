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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      bank_loans: {
        Row: {
          borrowed_at: string
          created_at: string
          due_at: string
          id: string
          paid_at: string | null
          principal_amount: number
          repayment_amount: number
          season_id: string | null
          status: Database["public"]["Enums"]["loan_status"]
          team_id: string
        }
        Insert: {
          borrowed_at: string
          created_at?: string
          due_at: string
          id?: string
          paid_at?: string | null
          principal_amount: number
          repayment_amount?: number
          season_id?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          team_id: string
        }
        Update: {
          borrowed_at?: string
          created_at?: string
          due_at?: string
          id?: string
          paid_at?: string | null
          principal_amount?: number
          repayment_amount?: number
          season_id?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_loans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_loans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "bank_loans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_transfers: {
        Row: {
          created_by: string | null
          driver_id: string
          from_team_id: string
          gross_amount: number
          id: string
          notes: string | null
          to_team_id: string
          transfer_tax: number | null
          transferred_at: string
        }
        Insert: {
          created_by?: string | null
          driver_id: string
          from_team_id: string
          gross_amount: number
          id?: string
          notes?: string | null
          to_team_id: string
          transfer_tax?: number | null
          transferred_at?: string
        }
        Update: {
          created_by?: string | null
          driver_id?: string
          from_team_id?: string
          gross_amount?: number
          id?: string
          notes?: string | null
          to_team_id?: string
          transfer_tax?: number | null
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_transfers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "driver_transfers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_transfers_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "driver_transfers_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_transfers_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "driver_transfers_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_store: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      Ledger: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          created_at: string
          current_team_id: string | null
          display_name: string
          division: Database["public"]["Enums"]["division_type"] | null
          id: string
          opening_balance: number
          recruitment_team_id: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_team_id?: string | null
          display_name: string
          division?: Database["public"]["Enums"]["division_type"] | null
          id?: string
          opening_balance?: number
          recruitment_team_id?: string | null
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_team_id?: string | null
          display_name?: string
          division?: Database["public"]["Enums"]["division_type"] | null
          id?: string
          opening_balance?: number
          recruitment_team_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_current_team_fk"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "member_current_team_fk"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_recruitment_team_fk"
            columns: ["recruitment_team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "member_recruitment_team_fk"
            columns: ["recruitment_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_logs: {
        Row: {
          amount: number
          assessed_at: string
          balance_checked: number | null
          balancing_period: number
          created_by: string | null
          description: string | null
          id: string
          member_id: string
          penalty_type: string
          season_id: string | null
          team_id: string
        }
        Insert: {
          amount: number
          assessed_at?: string
          balance_checked?: number | null
          balancing_period: number
          created_by?: string | null
          description?: string | null
          id?: string
          member_id: string
          penalty_type: string
          season_id?: string | null
          team_id: string
        }
        Update: {
          amount?: number
          assessed_at?: string
          balance_checked?: number | null
          balancing_period?: number
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string
          penalty_type?: string
          season_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalty_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "penalty_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "penalty_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          balancing_period: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          race_current: number
          season_number: number
        }
        Insert: {
          balancing_period?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          race_current?: number
          season_number: number
        }
        Update: {
          balancing_period?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          race_current?: number
          season_number?: number
        }
        Relationships: []
      }
      sponsorship_tracker: {
        Row: {
          balancing_period: number
          id: string
          season_id: string
          t1_all_drivers_checkin: boolean
          t2_zero_fines: boolean
          t3_guaranteed_sponsor_funds: boolean
          t4_zero_season_debt: boolean
          team_id: string
          total_reward: number | null
        }
        Insert: {
          balancing_period?: number
          id?: string
          season_id: string
          t1_all_drivers_checkin?: boolean
          t2_zero_fines?: boolean
          t3_guaranteed_sponsor_funds?: boolean
          t4_zero_season_debt?: boolean
          team_id: string
          total_reward?: number | null
        }
        Update: {
          balancing_period?: number
          id?: string
          season_id?: string
          t1_all_drivers_checkin?: boolean
          t2_zero_fines?: boolean
          t3_guaranteed_sponsor_funds?: boolean
          t4_zero_season_debt?: boolean
          team_id?: string
          total_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_tracker_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_tracker_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "sponsorship_tracker_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          principal_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          principal_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          principal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "teams_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          code: string
          created_at: string
          default_direction: Database["public"]["Enums"]["transaction_type"]
          id: string
          is_active: boolean
          is_automatic: boolean
          name: string
          standard_amount: number | null
        }
        Insert: {
          code: string
          created_at?: string
          default_direction: Database["public"]["Enums"]["transaction_type"]
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          name: string
          standard_amount?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          default_direction?: Database["public"]["Enums"]["transaction_type"]
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          name?: string
          standard_amount?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balancing_period: number | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["transaction_type"]
          id: string
          member_id: string
          season_id: string | null
          team_id: string | null
          transaction_date: string
        }
        Insert: {
          amount: number
          balancing_period?: number | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["transaction_type"]
          id?: string
          member_id: string
          season_id?: string | null
          team_id?: string | null
          transaction_date?: string
        }
        Update: {
          amount?: number
          balancing_period?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["transaction_type"]
          id?: string
          member_id?: string
          season_id?: string | null
          team_id?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_tax_logs: {
        Row: {
          assessed_at: string
          balancing_period: number
          id: string
          principal_balance: number
          principal_member_id: string
          season_id: string | null
          tax_amount: number
          tax_rate: number
          team_id: string
        }
        Insert: {
          assessed_at?: string
          balancing_period: number
          id?: string
          principal_balance: number
          principal_member_id: string
          season_id?: string | null
          tax_amount: number
          tax_rate: number
          team_id: string
        }
        Update: {
          assessed_at?: string
          balancing_period?: number
          id?: string
          principal_balance?: number
          principal_member_id?: string
          season_id?: string | null
          tax_amount?: number
          tax_rate?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wealth_tax_logs_principal_member_id_fkey"
            columns: ["principal_member_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wealth_tax_logs_principal_member_id_fkey"
            columns: ["principal_member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wealth_tax_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wealth_tax_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "wealth_tax_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bank_financial_summary: {
        Row: {
          current_bank_balance: number | null
          fines: number | null
          loans_disbursed: number | null
          opening_capital: number | null
          repayments_and_interest: number | null
          transfer_taxes: number | null
          wealth_taxes: number | null
        }
        Relationships: []
      }
      member_balance_summary: {
        Row: {
          accumulated_salary: number | null
          current_team_id: string | null
          display_name: string | null
          division: Database["public"]["Enums"]["division_type"] | null
          ending_balance: number | null
          member_id: string | null
          opening_balance: number | null
          other_income: number | null
          role: Database["public"]["Enums"]["member_role"] | null
          salary_per_race: number | null
          status: Database["public"]["Enums"]["member_status"] | null
          total_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_current_team_fk"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "member_current_team_fk"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_eligibility: {
        Row: {
          balancing_period: number | null
          driver_count: number | null
          season_id: string | null
          t1_eligible: boolean | null
          t2_eligible: boolean | null
          t3_eligible: boolean | null
          t4_eligible: boolean | null
          team_id: string | null
          total_reward: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_tracker_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_tracker_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "sponsorship_tracker_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_balance_summary: {
        Row: {
          active_bank_debt: number | null
          principal_id: string | null
          principal_name: string | null
          team_balance: number | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "member_balance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "teams_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_member_role: {
        Args: never
        Returns: Database["public"]["Enums"]["member_role"]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      division_type: "premio" | "zwei"
      loan_status: "active" | "paid" | "overdue"
      member_role:
        | "driver"
        | "owner"
        | "principal"
        | "agent"
        | "journalist"
        | "fia"
        | "admin"
      member_status: "active" | "inactive"
      transaction_type: "income" | "expense"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      division_type: ["premio", "zwei"],
      loan_status: ["active", "paid", "overdue"],
      member_role: [
        "driver",
        "principal",
        "agent",
        "journalist",
        "fia",
        "admin",
      ],
      member_status: ["active", "inactive"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
