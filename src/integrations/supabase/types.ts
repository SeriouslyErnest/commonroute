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
      account_status: {
        Row: {
          changed_at: string
          changed_by: string | null
          reason: string | null
          state: Database["public"]["Enums"]["account_state"]
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          reason?: string | null
          state?: Database["public"]["Enums"]["account_state"]
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          reason?: string | null
          state?: Database["public"]["Enums"]["account_state"]
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at: string
          created_by: string | null
          disabled_at: string | null
          status: Database["public"]["Enums"]["admin_status"]
          user_id: string
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          status?: Database["public"]["Enums"]["admin_status"]
          user_id: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          status?: Database["public"]["Enums"]["admin_status"]
          user_id?: string
        }
        Relationships: []
      }
      entitlement_grants: {
        Row: {
          bundle: string
          created_at: string
          ends_at: string | null
          granted_by: string | null
          id: string
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["grant_source"]
          starts_at: string
          status: Database["public"]["Enums"]["grant_status"]
          user_id: string
        }
        Insert: {
          bundle: string
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          reason: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["grant_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["grant_status"]
          user_id: string
        }
        Update: {
          bundle?: string
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["grant_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["grant_status"]
          user_id?: string
        }
        Relationships: []
      }
      kintrip_memberships: {
        Row: {
          destination: string | null
          share_code: string
          title: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          destination?: string | null
          share_code: string
          title?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          destination?: string | null
          share_code?: string
          title?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kintrip_trips: {
        Row: {
          share_code: string
          state: Json
          trip_id: string
          updated_at: string
        }
        Insert: {
          share_code: string
          state: Json
          trip_id: string
          updated_at?: string
        }
        Update: {
          share_code?: string
          state?: Json
          trip_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotion_redemptions: {
        Row: {
          grant_id: string | null
          id: string
          promotion_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          grant_id?: string | null
          id?: string
          promotion_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          grant_id?: string | null
          id?: string
          promotion_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "entitlement_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          bundle: string | null
          campaign_name: string
          code: string
          created_at: string
          created_by: string | null
          duration_days: number | null
          ends_at: string | null
          id: string
          internal_notes: string | null
          max_redemptions: number | null
          new_accounts_only: boolean
          per_account_limit: number
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
        }
        Insert: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          bundle?: string | null
          campaign_name: string
          code: string
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          internal_notes?: string | null
          max_redemptions?: number | null
          new_accounts_only?: boolean
          per_account_limit?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          bundle?: string | null
          campaign_name?: string
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          internal_notes?: string | null
          max_redemptions?: number | null
          new_accounts_only?: boolean
          per_account_limit?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_role_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
    }
    Enums: {
      account_state: "active" | "suspended"
      admin_role:
        | "super_admin"
        | "billing_admin"
        | "support_admin"
        | "read_only_admin"
      admin_status: "active" | "disabled"
      benefit_type:
        | "free_plan_access"
        | "percent_discount"
        | "fixed_discount"
        | "trial_extension"
      grant_source:
        | "complimentary"
        | "trial"
        | "promotion"
        | "paid_subscription"
      grant_status: "active" | "revoked"
      promotion_status:
        | "draft"
        | "scheduled"
        | "active"
        | "paused"
        | "expired"
        | "exhausted"
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
      account_state: ["active", "suspended"],
      admin_role: [
        "super_admin",
        "billing_admin",
        "support_admin",
        "read_only_admin",
      ],
      admin_status: ["active", "disabled"],
      benefit_type: [
        "free_plan_access",
        "percent_discount",
        "fixed_discount",
        "trial_extension",
      ],
      grant_source: [
        "complimentary",
        "trial",
        "promotion",
        "paid_subscription",
      ],
      grant_status: ["active", "revoked"],
      promotion_status: [
        "draft",
        "scheduled",
        "active",
        "paused",
        "expired",
        "exhausted",
      ],
    },
  },
} as const
