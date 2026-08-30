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
      app_settings: {
        Row: {
          key: string
          label: string | null
          value: number
        }
        Insert: {
          key: string
          label?: string | null
          value: number
        }
        Update: {
          key?: string
          label?: string | null
          value?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chargers: {
        Row: {
          charger_capacity_kw: number | null
          charger_code: string
          charger_location: string | null
          charger_voltage: number | null
          created_at: string
          id: string
          maintenance_center_id: string | null
          manufacturing_year: number | null
          status_id: string | null
          updated_at: string
        }
        Insert: {
          charger_capacity_kw?: number | null
          charger_code: string
          charger_location?: string | null
          charger_voltage?: number | null
          created_at?: string
          id?: string
          maintenance_center_id?: string | null
          manufacturing_year?: number | null
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          charger_capacity_kw?: number | null
          charger_code?: string
          charger_location?: string | null
          charger_voltage?: number | null
          created_at?: string
          id?: string
          maintenance_center_id?: string | null
          manufacturing_year?: number | null
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargers_maintenance_center_id_fkey"
            columns: ["maintenance_center_id"]
            isOneToOne: false
            referencedRelation: "maintenance_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chargers_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      charging_sessions: {
        Row: {
          battery_end_pct: number | null
          battery_start_pct: number | null
          charger_id: string
          charging_duration: string | null
          charging_end_time: string | null
          charging_session_code: string
          charging_start_time: string | null
          created_at: string
          created_by: string | null
          energy_consumed_kwh: number | null
          id: string
          notes: string | null
          plugs_used: Database["public"]["Enums"]["plug_selection"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          battery_end_pct?: number | null
          battery_start_pct?: number | null
          charger_id: string
          charging_duration?: string | null
          charging_end_time?: string | null
          charging_session_code: string
          charging_start_time?: string | null
          created_at?: string
          created_by?: string | null
          energy_consumed_kwh?: number | null
          id?: string
          notes?: string | null
          plugs_used: Database["public"]["Enums"]["plug_selection"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          battery_end_pct?: number | null
          battery_start_pct?: number | null
          charger_id?: string
          charging_duration?: string | null
          charging_end_time?: string | null
          charging_session_code?: string
          charging_start_time?: string | null
          created_at?: string
          created_by?: string | null
          energy_consumed_kwh?: number | null
          id?: string
          notes?: string | null
          plugs_used?: Database["public"]["Enums"]["plug_selection"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charging_sessions_charger_id_fkey"
            columns: ["charger_id"]
            isOneToOne: false
            referencedRelation: "chargers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "charging_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "charging_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_vehicle_operations: {
        Row: {
          battery_consumed_pct: number | null
          created_at: string
          created_by: string | null
          driver_id: string | null
          driver_tips: number | null
          ending_battery_pct: number | null
          ending_odometer_km: number | null
          id: string
          operating_percentage: number | null
          operation_code: string
          operation_date: string
          remarks: string | null
          route_id: string | null
          shift_type_id: string
          starting_battery_pct: number | null
          starting_odometer_km: number | null
          status_id: string
          total_distance_km: number | null
          updated_at: string
          vehicle_id: string
          vendor_id: string | null
        }
        Insert: {
          battery_consumed_pct?: number | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          driver_tips?: number | null
          ending_battery_pct?: number | null
          ending_odometer_km?: number | null
          id?: string
          operating_percentage?: number | null
          operation_code: string
          operation_date: string
          remarks?: string | null
          route_id?: string | null
          shift_type_id: string
          starting_battery_pct?: number | null
          starting_odometer_km?: number | null
          status_id?: string
          total_distance_km?: number | null
          updated_at?: string
          vehicle_id: string
          vendor_id?: string | null
        }
        Update: {
          battery_consumed_pct?: number | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          driver_tips?: number | null
          ending_battery_pct?: number | null
          ending_odometer_km?: number | null
          id?: string
          operating_percentage?: number | null
          operation_code?: string
          operation_date?: string
          remarks?: string | null
          route_id?: string | null
          shift_type_id?: string
          starting_battery_pct?: number | null
          starting_odometer_km?: number | null
          status_id?: string
          total_distance_km?: number | null
          updated_at?: string
          vehicle_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_vehicle_operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          driver_code: string
          driver_name: string
          has_tourism_id: boolean
          hiring_date: string | null
          id: string
          license_expiry_date: string | null
          license_grade_id: string | null
          license_number: string | null
          mobile_number: string | null
          status_id: string | null
          tourism_id_expiry_date: string | null
          tourism_id_issuing_company: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          driver_code: string
          driver_name: string
          has_tourism_id?: boolean
          hiring_date?: string | null
          id?: string
          license_expiry_date?: string | null
          license_grade_id?: string | null
          license_number?: string | null
          mobile_number?: string | null
          status_id?: string | null
          tourism_id_expiry_date?: string | null
          tourism_id_issuing_company?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          driver_code?: string
          driver_name?: string
          has_tourism_id?: boolean
          hiring_date?: string | null
          id?: string
          license_expiry_date?: string | null
          license_grade_id?: string | null
          license_number?: string | null
          mobile_number?: string | null
          status_id?: string | null
          tourism_id_expiry_date?: string | null
          tourism_id_issuing_company?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_license_grade_id_fkey"
            columns: ["license_grade_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_categories: {
        Row: {
          key: string
          label: string
        }
        Insert: {
          key: string
          label: string
        }
        Update: {
          key?: string
          label?: string
        }
        Relationships: []
      }
      lookups: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label_ar: string | null
          label_en: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lookups_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "lookup_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      maintenance_centers: {
        Row: {
          center_code: string
          center_name: string
          contact_person: string | null
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          mobile_number: string | null
          updated_at: string
        }
        Insert: {
          center_code: string
          center_name: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          mobile_number?: string | null
          updated_at?: string
        }
        Update: {
          center_code?: string
          center_name?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          mobile_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          part_code: string
          part_name: string
          pm_interval_km: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          part_code: string
          part_name: string
          pm_interval_km?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          part_code?: string
          part_name?: string
          pm_interval_km?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_engineer: boolean
          job_title: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          is_engineer?: boolean
          job_title?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_engineer?: boolean
          job_title?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rfr_issues: {
        Row: {
          id: string
          is_skipped: boolean
          issue_type_id: string
          notes: string | null
          rfr_id: string
          skip_reason_id: string | null
        }
        Insert: {
          id?: string
          is_skipped?: boolean
          issue_type_id: string
          notes?: string | null
          rfr_id: string
          skip_reason_id?: string | null
        }
        Update: {
          id?: string
          is_skipped?: boolean
          issue_type_id?: string
          notes?: string | null
          rfr_id?: string
          skip_reason_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfr_issues_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfr_issues_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "rfrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfr_issues_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_access_time"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "rfr_issues_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_aging_alerts"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "rfr_issues_skip_reason_id_fkey"
            columns: ["skip_reason_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      rfr_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          rfr_id: string
          stage_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          rfr_id: string
          stage_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          rfr_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfr_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfr_stage_history_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "rfrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfr_stage_history_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_access_time"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "rfr_stage_history_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_aging_alerts"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "rfr_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      rfrs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          driver_id: string | null
          id: string
          odometer_km: number | null
          request_at: string
          rfr_number: string
          skip_reason_id: string | null
          stage_id: string
          updated_at: string
          vehicle_id: string
          vehicle_location: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          driver_id?: string | null
          id?: string
          odometer_km?: number | null
          request_at: string
          rfr_number?: string
          skip_reason_id?: string | null
          stage_id: string
          updated_at?: string
          vehicle_id: string
          vehicle_location: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          driver_id?: string | null
          id?: string
          odometer_km?: number | null
          request_at?: string
          rfr_number?: string
          skip_reason_id?: string | null
          stage_id?: string
          updated_at?: string
          vehicle_id?: string
          vehicle_location?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfrs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfrs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfrs_skip_reason_id_fkey"
            columns: ["skip_reason_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfrs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stations: {
        Row: {
          id: string
          route_id: string
          sequence_number: number
          station_id: string
        }
        Insert: {
          id?: string
          route_id: string
          sequence_number: number
          station_id: string
        }
        Update: {
          id?: string
          route_id?: string
          sequence_number?: number
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          id: string
          number_of_stations: number | null
          route_code: string
          route_distance_km: number | null
          route_name: string
          standard_leg_time: string | null
          standard_round_trip_time: string | null
          status_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          number_of_stations?: number | null
          route_code: string
          route_distance_km?: number | null
          route_name: string
          standard_leg_time?: string | null
          standard_round_trip_time?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          number_of_stations?: number | null
          route_code?: string
          route_distance_km?: number | null
          route_name?: string
          standard_leg_time?: string | null
          standard_round_trip_time?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filters: {
        Row: {
          created_at: string
          filter_state: Json
          id: string
          is_default: boolean
          module: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_state?: Json
          id?: string
          is_default?: boolean
          module: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_state?: Json
          id?: string
          is_default?: boolean
          module?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_lines: {
        Row: {
          achieved_points: number | null
          id: string
          kpi_name: string
          metric_weight: number
          notes: string | null
          section_id: string
          sort_order: number
        }
        Insert: {
          achieved_points?: number | null
          id?: string
          kpi_name: string
          metric_weight: number
          notes?: string | null
          section_id: string
          sort_order?: number
        }
        Update: {
          achieved_points?: number | null
          id?: string
          kpi_name?: string
          metric_weight?: number
          notes?: string | null
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_lines_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "scorecard_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_sections: {
        Row: {
          id: string
          scorecard_id: string
          section_name: string
          section_weight: number
          sort_order: number
        }
        Insert: {
          id?: string
          scorecard_id: string
          section_name: string
          section_weight: number
          sort_order?: number
        }
        Update: {
          id?: string
          scorecard_id?: string
          section_name?: string
          section_weight?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_sections_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "v_scorecard_totals"
            referencedColumns: ["scorecard_id"]
          },
          {
            foreignKeyName: "scorecard_sections_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi_trend"
            referencedColumns: ["scorecard_id"]
          },
          {
            foreignKeyName: "scorecard_sections_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "vendor_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          id: string
          station_code: string
          station_name: string
          status_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          station_code: string
          station_name: string
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          station_code?: string
          station_name?: string
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_part_schedules: {
        Row: {
          created_at: string
          id: string
          interval_km: number
          is_active: boolean
          last_service_date: string | null
          last_service_km: number | null
          last_work_order_id: string | null
          part_id: string
          scheduled_km: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_km: number
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          last_work_order_id?: string | null
          part_id: string
          scheduled_km?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_km?: number
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          last_work_order_id?: string | null
          part_id?: string
          scheduled_km?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_part_schedules_last_work_order_id_fkey"
            columns: ["last_work_order_id"]
            isOneToOne: false
            referencedRelation: "v_work_order_repeat_index"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "vehicle_part_schedules_last_work_order_id_fkey"
            columns: ["last_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_part_schedules_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_part_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_part_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_part_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          battery_capacity_kwh: number | null
          created_at: string
          current_odometer_date: string | null
          current_odometer_km: number | null
          default_driver_id: string | null
          fuel_type_id: string | null
          id: string
          license_expiry_date: string | null
          plate_number: string
          status_id: string | null
          updated_at: string
          vehicle_code: string
          vehicle_type_id: string | null
          vendor_id: string
        }
        Insert: {
          battery_capacity_kwh?: number | null
          created_at?: string
          current_odometer_date?: string | null
          current_odometer_km?: number | null
          default_driver_id?: string | null
          fuel_type_id?: string | null
          id?: string
          license_expiry_date?: string | null
          plate_number: string
          status_id?: string | null
          updated_at?: string
          vehicle_code: string
          vehicle_type_id?: string | null
          vendor_id: string
        }
        Update: {
          battery_capacity_kwh?: number | null
          created_at?: string
          current_odometer_date?: string | null
          current_odometer_km?: number | null
          default_driver_id?: string | null
          fuel_type_id?: string | null
          id?: string
          license_expiry_date?: string | null
          plate_number?: string
          status_id?: string | null
          updated_at?: string
          vehicle_code?: string
          vehicle_type_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_default_driver_id_fkey"
            columns: ["default_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          achieved_pct: number | null
          billing_basis: string | null
          bus_quantity: number | null
          created_at: string
          created_by: string | null
          currency: string
          gross_amount: number | null
          id: string
          net_amount: number | null
          notes: string | null
          period_month: string
          rate_amount: number | null
          scorecard_id: string | null
          shift_type_id: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          achieved_pct?: number | null
          billing_basis?: string | null
          bus_quantity?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          period_month: string
          rate_amount?: number | null
          scorecard_id?: string | null
          shift_type_id?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          achieved_pct?: number | null
          billing_basis?: string | null
          bus_quantity?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          period_month?: string
          rate_amount?: number | null
          scorecard_id?: string | null
          shift_type_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "v_scorecard_totals"
            referencedColumns: ["scorecard_id"]
          },
          {
            foreignKeyName: "vendor_invoices_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi_trend"
            referencedColumns: ["scorecard_id"]
          },
          {
            foreignKeyName: "vendor_invoices_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "vendor_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_scorecards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean | null
          notes: string | null
          period_month: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean | null
          notes?: string | null
          period_month?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean | null
          notes?: string | null
          period_month?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_scorecards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_scorecards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_scorecards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          apply_kpi: boolean
          billing_basis: string | null
          billing_notes: string | null
          contact_person: string | null
          created_at: string
          currency: string
          email_address: string | null
          id: string
          is_company: boolean
          mobile_number: string | null
          rate_amount: number | null
          status_id: string | null
          updated_at: string
          vendor_code: string
          vendor_name: string
          vendor_type_id: string | null
        }
        Insert: {
          apply_kpi?: boolean
          billing_basis?: string | null
          billing_notes?: string | null
          contact_person?: string | null
          created_at?: string
          currency?: string
          email_address?: string | null
          id?: string
          is_company?: boolean
          mobile_number?: string | null
          rate_amount?: number | null
          status_id?: string | null
          updated_at?: string
          vendor_code: string
          vendor_name: string
          vendor_type_id?: string | null
        }
        Update: {
          apply_kpi?: boolean
          billing_basis?: string | null
          billing_notes?: string | null
          contact_person?: string | null
          created_at?: string
          currency?: string
          email_address?: string | null
          id?: string
          is_company?: boolean
          mobile_number?: string | null
          rate_amount?: number | null
          status_id?: string | null
          updated_at?: string
          vendor_code?: string
          vendor_name?: string
          vendor_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_vendor_type_id_fkey"
            columns: ["vendor_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_parts: {
        Row: {
          part_id: string
          quantity: number
          work_order_id: string
        }
        Insert: {
          part_id: string
          quantity?: number
          work_order_id: string
        }
        Update: {
          part_id?: string
          quantity?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_work_order_repeat_index"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "work_order_parts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_engineer_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_skipped: boolean
          issue_type_id: string | null
          maintenance_category_id: string | null
          maintenance_center_id: string | null
          maintenance_type_id: string | null
          repair_end_at: string | null
          repair_start_at: string | null
          rfr_id: string
          skip_notes: string | null
          skip_reason_id: string | null
          technician_1: string | null
          technician_2: string | null
          technician_3: string | null
          updated_at: string
          vehicle_status_after_id: string | null
          work_order_number: string
        }
        Insert: {
          assigned_engineer_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_skipped?: boolean
          issue_type_id?: string | null
          maintenance_category_id?: string | null
          maintenance_center_id?: string | null
          maintenance_type_id?: string | null
          repair_end_at?: string | null
          repair_start_at?: string | null
          rfr_id: string
          skip_notes?: string | null
          skip_reason_id?: string | null
          technician_1?: string | null
          technician_2?: string | null
          technician_3?: string | null
          updated_at?: string
          vehicle_status_after_id?: string | null
          work_order_number?: string
        }
        Update: {
          assigned_engineer_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_skipped?: boolean
          issue_type_id?: string | null
          maintenance_category_id?: string | null
          maintenance_center_id?: string | null
          maintenance_type_id?: string | null
          repair_end_at?: string | null
          repair_start_at?: string | null
          rfr_id?: string
          skip_notes?: string | null
          skip_reason_id?: string | null
          technician_1?: string | null
          technician_2?: string | null
          technician_3?: string | null
          updated_at?: string
          vehicle_status_after_id?: string | null
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_category_id_fkey"
            columns: ["maintenance_category_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_center_id_fkey"
            columns: ["maintenance_center_id"]
            isOneToOne: false
            referencedRelation: "maintenance_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_type_id_fkey"
            columns: ["maintenance_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "rfrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_access_time"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "work_orders_rfr_id_fkey"
            columns: ["rfr_id"]
            isOneToOne: false
            referencedRelation: "v_rfr_aging_alerts"
            referencedColumns: ["rfr_id"]
          },
          {
            foreignKeyName: "work_orders_skip_reason_id_fkey"
            columns: ["skip_reason_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_status_after_id_fkey"
            columns: ["vehicle_status_after_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_audit_log: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          detail: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fleet_utilization_monthly: {
        Row: {
          active_vehicle_count: number | null
          fleet_size: number | null
          period_month: string | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      v_periodic_maintenance: {
        Row: {
          actual_km: number | null
          current_odometer_date: string | null
          interval_km: number | null
          km_remaining: number | null
          last_service_km: number | null
          maintenance_status: string | null
          part_code: string | null
          part_name: string | null
          plate_number: string | null
          schedule_id: string | null
          scheduled_km: number | null
          vehicle_code: string | null
          vehicle_id: string | null
        }
        Relationships: []
      }
      v_pm_alerts: {
        Row: {
          actual_km: number | null
          current_odometer_date: string | null
          interval_km: number | null
          km_remaining: number | null
          last_service_km: number | null
          maintenance_status: string | null
          part_code: string | null
          part_name: string | null
          plate_number: string | null
          schedule_id: string | null
          scheduled_km: number | null
          vehicle_code: string | null
          vehicle_id: string | null
        }
        Relationships: []
      }
      v_pm_compliance_summary: {
        Row: {
          compliance_pct: number | null
          ok_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      v_rfr_access_time: {
        Row: {
          access_display: string | null
          access_minutes: number | null
          rfr_id: string | null
          rfr_number: string | null
          vehicle_id: string | null
        }
        Insert: {
          access_display?: never
          access_minutes?: never
          rfr_id?: string | null
          rfr_number?: string | null
          vehicle_id?: string | null
        }
        Update: {
          access_display?: never
          access_minutes?: never
          rfr_id?: string | null
          rfr_number?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rfr_aging_alerts: {
        Row: {
          access_display: string | null
          access_minutes: number | null
          description: string | null
          plate_number: string | null
          request_at: string | null
          rfr_id: string | null
          rfr_number: string | null
          vehicle_code: string | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rfr_resolution_summary: {
        Row: {
          avg_access_minutes: number | null
          completed_count: number | null
          median_access_minutes: number | null
          period_month: string | null
        }
        Relationships: []
      }
      v_scorecard_totals: {
        Row: {
          period_month: string | null
          scorecard_id: string | null
          sections_weight_total: number | null
          total_achieved_pct: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_scorecards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vendor_kpi_section_trend: {
        Row: {
          period_month: string | null
          section_name: string | null
          section_score_pct: number | null
          section_weight: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_scorecards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vendor_kpi_trend: {
        Row: {
          period_month: string | null
          scorecard_id: string | null
          sections_weight_total: number | null
          total_achieved_pct: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_scorecards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vendor_monthly_bus_counts: {
        Row: {
          avg_daily_buses: number | null
          bus_days: number | null
          operating_days: number | null
          period_month: string | null
          shift_type_id: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_vehicle_operations_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_vehicle_operations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_work_order_repeat_index: {
        Row: {
          issue_type_id: string | null
          repeat_10d: number | null
          repeat_20d: number | null
          repeat_30d: number | null
          repeat_50d: number | null
          vehicle_id: string | null
          work_order_id: string | null
          work_order_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_periodic_maintenance"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_pm_alerts"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rfrs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "lookups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      access_display: {
        Args: { r: Database["public"]["Tables"]["rfrs"]["Row"] }
        Returns: string
      }
      access_minutes: {
        Args: { r: Database["public"]["Tables"]["rfrs"]["Row"] }
        Returns: number
      }
      can_read: { Args: never; Returns: boolean }
      can_see_money: { Args: never; Returns: boolean }
      can_write_master: { Args: never; Returns: boolean }
      can_write_ops: { Args: never; Returns: boolean }
      current_role_of: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      fn_default_operation_status: { Args: never; Returns: string }
      fn_format_minutes: { Args: { p_minutes: number }; Returns: string }
      fn_generate_invoice: {
        Args: { p_month: string; p_shift_type_id: string; p_vendor_id: string }
        Returns: string
      }
      fn_init_pm_schedules: { Args: { p_vehicle_id: string }; Returns: number }
      fn_last_driver_for_vehicle: {
        Args: { p_date: string; p_vehicle_id: string }
        Returns: string
      }
      fn_last_odometer_for_vehicle: {
        Args: { p_date: string; p_vehicle_id: string }
        Returns: number
      }
      fn_log_audit: {
        Args: {
          p_action: string
          p_detail: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      fn_lookup_code: { Args: { p_id: string }; Returns: string }
      fn_odometer_on_date: {
        Args: { p_date: string; p_vehicle_id: string }
        Returns: number
      }
      fn_open_month: {
        Args: { p_month: string; p_vendor_id: string }
        Returns: string
      }
      fn_recalc_pm_schedules: {
        Args: { p_vehicle_id: string }
        Returns: number
      }
      fn_repeat_count: {
        Args: {
          p_days: number
          p_issue_type_id: string
          p_ref: string
          p_vehicle_id: string
        }
        Returns: number
      }
      fn_rfr_access_minutes: { Args: { p_rfr_id: string }; Returns: number }
      fn_rfr_stage_transition_allowed: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      is_super: { Args: never; Returns: boolean }
      lookup_in: {
        Args: { p_category: string; p_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "supervisor" | "data_admin"
      plug_selection: "A" | "B" | "A+B"
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
      app_role: ["super_admin", "admin", "supervisor", "data_admin"],
      plug_selection: ["A", "B", "A+B"],
    },
  },
} as const
