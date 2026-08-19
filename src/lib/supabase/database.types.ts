import type {
  AvailabilityStatus,
  CapabilityCode,
  JobPriority,
  JobStatus,
  LocationSource,
  VehicleType,
} from "@/lib/domain/types";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      capabilities: {
        Row: { code: CapabilityCode; sort_order: number; created_at: string };
        Insert: { code: CapabilityCode; sort_order: number; created_at?: string };
        Update: { code?: CapabilityCode; sort_order?: number; created_at?: string };
        Relationships: [];
      };
      operators: {
        Row: {
          id: string;
          name: string;
          phone: string;
          company_name: string | null;
          is_active: boolean;
          availability_status: AvailabilityStatus;
          base_address: string;
          base_latitude: number;
          base_longitude: number;
          base_location: unknown;
          current_latitude: number | null;
          current_longitude: number | null;
          current_location: unknown | null;
          current_location_updated_at: string | null;
          service_radius_km: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          company_name?: string | null;
          is_active?: boolean;
          availability_status?: AvailabilityStatus;
          base_address: string;
          base_latitude: number;
          base_longitude: number;
          current_latitude?: number | null;
          current_longitude?: number | null;
          current_location_updated_at?: string | null;
          service_radius_km?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["operators"]["Insert"]>;
        Relationships: [];
      };
      operator_capabilities: {
        Row: { operator_id: string; capability_code: CapabilityCode; created_at: string };
        Insert: { operator_id: string; capability_code: CapabilityCode; created_at?: string };
        Update: never;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          operator_id: string;
          name: string;
          registration_number: string | null;
          vehicle_type: VehicleType;
          max_vehicle_weight_kg: number | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operator_id: string;
          name: string;
          registration_number?: string | null;
          vehicle_type: VehicleType;
          max_vehicle_weight_kg?: number | null;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      vehicle_capabilities: {
        Row: { vehicle_id: string; capability_code: CapabilityCode; created_at: string };
        Insert: { vehicle_id: string; capability_code: CapabilityCode; created_at?: string };
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: "pending" | "dispatcher" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          customer_name: string;
          customer_phone: string;
          vehicle_registration: string | null;
          vehicle_make: string | null;
          vehicle_model: string | null;
          vehicle_type: string | null;
          latitude: number;
          longitude: number;
          location: unknown;
          location_label: string | null;
          location_source: LocationSource;
          status: JobStatus;
          priority: JobPriority;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_phone: string;
          vehicle_registration?: string | null;
          vehicle_make?: string | null;
          vehicle_model?: string | null;
          vehicle_type?: string | null;
          latitude: number;
          longitude: number;
          location_label?: string | null;
          location_source: LocationSource;
          status?: JobStatus;
          priority?: JobPriority;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      job_required_capabilities: {
        Row: { job_id: string; capability_code: CapabilityCode; created_at: string };
        Insert: { job_id: string; capability_code: CapabilityCode; created_at?: string };
        Update: never;
        Relationships: [];
      };
      job_assignments: {
        Row: {
          id: string;
          job_id: string;
          operator_id: string;
          vehicle_id: string | null;
          assigned_by: string;
          assigned_at: string;
          accepted_at: string | null;
          unassigned_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          operator_id: string;
          vehicle_id?: string | null;
          assigned_by: string;
          assigned_at?: string;
          accepted_at?: string | null;
          unassigned_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["job_assignments"]["Insert"]>;
        Relationships: [];
      };
      job_status_history: {
        Row: {
          id: number;
          job_id: string;
          from_status: JobStatus | null;
          to_status: JobStatus;
          changed_by: string;
          changed_at: string;
          notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      job_operator_matches: {
        Row: {
          job_id: string;
          operator_id: string;
          distance_km: number;
          has_required_capabilities: boolean;
          within_service_area: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      save_operator: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_phone: string;
          p_company_name: string | null;
          p_is_active: boolean;
          p_availability_status: AvailabilityStatus;
          p_base_address: string;
          p_base_latitude: number;
          p_base_longitude: number;
          p_current_latitude: number | null;
          p_current_longitude: number | null;
          p_service_radius_km: number | null;
          p_notes: string | null;
          p_capabilities: CapabilityCode[];
        };
        Returns: string;
      };
      save_vehicle: {
        Args: {
          p_id: string | null;
          p_operator_id: string;
          p_name: string;
          p_registration_number: string | null;
          p_vehicle_type: VehicleType;
          p_max_vehicle_weight_kg: number | null;
          p_is_active: boolean;
          p_notes: string | null;
          p_capabilities: CapabilityCode[];
        };
        Returns: string;
      };
      save_job: {
        Args: {
          p_id: string | null;
          p_customer_name: string;
          p_customer_phone: string;
          p_vehicle_registration: string | null;
          p_vehicle_make: string | null;
          p_vehicle_model: string | null;
          p_vehicle_type: string | null;
          p_latitude: number;
          p_longitude: number;
          p_location_label: string;
          p_location_source: LocationSource;
          p_priority: JobPriority;
          p_notes: string | null;
          p_required_capabilities: CapabilityCode[];
        };
        Returns: string;
      };
      assign_job: {
        Args: {
          p_job_id: string;
          p_operator_id: string;
          p_vehicle_id: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      set_job_status: {
        Args: { p_job_id: string; p_status: JobStatus; p_notes: string | null };
        Returns: undefined;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      operator_availability: AvailabilityStatus;
      vehicle_type: VehicleType;
      app_role: "pending" | "dispatcher" | "admin";
      job_status: JobStatus;
      job_priority: JobPriority;
      location_source: LocationSource;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type { Json };
