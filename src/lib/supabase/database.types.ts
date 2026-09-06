import type {
  AvailabilityStatus,
  BillingAction,
  BillingPayableStatus,
  BillingPayerType,
  BillingReceivableStatus,
  CapabilityCode,
  JobContactChannel,
  JobContactPurpose,
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
      customer_intake_links: {
        Row: {
          id: string;
          job_id: string;
          token_hash: string;
          expires_at: string;
          first_opened_at: string | null;
          revoked_at: string | null;
          submitted_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          token_hash: string;
          expires_at: string;
          first_opened_at?: string | null;
          revoked_at?: string | null;
          submitted_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_intake_links"]["Insert"]>;
        Relationships: [];
      };
      operators: {
        Row: {
          id: string;
          user_id: string | null;
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
          driver_invited_at: string | null;
          driver_access_activated_at: string | null;
          driver_access_disabled_at: string | null;
          service_radius_km: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
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
          driver_invited_at?: string | null;
          driver_access_activated_at?: string | null;
          driver_access_disabled_at?: string | null;
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
          role: "pending" | "dispatcher" | "admin" | "driver";
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
          customer_notes: string | null;
          customer_intake_submitted_at: string | null;
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
          customer_notes?: string | null;
          customer_intake_submitted_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      job_photos: {
        Row: {
          id: string;
          job_id: string;
          customer_intake_link_id: string;
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
          uploaded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          customer_intake_link_id: string;
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
          uploaded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_photos"]["Insert"]>;
        Relationships: [];
      };
      job_billing: {
        Row: {
          job_id: string;
          payer_type: BillingPayerType | null;
          payer_name: string | null;
          payer_kennitala: string | null;
          payer_email: string | null;
          payer_phone: string | null;
          payer_address: string | null;
          authorization_reference: string | null;
          billing_reference: string | null;
          service_summary: string | null;
          payer_amount_isk: number | null;
          provider_amount_isk: number | null;
          currency: "ISK";
          receivable_status: BillingReceivableStatus;
          payer_invoice_number: string | null;
          payer_invoice_issued_at: string | null;
          payer_due_at: string | null;
          payer_paid_at: string | null;
          payable_status: BillingPayableStatus;
          provider_invoice_number: string | null;
          provider_invoice_received_at: string | null;
          provider_due_at: string | null;
          provider_paid_at: string | null;
          notes: string | null;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      job_billing_events: {
        Row: {
          id: number;
          job_id: string;
          action: BillingAction;
          reference: string | null;
          due_at: string | null;
          notes: string | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      job_contact_events: {
        Row: {
          id: number;
          job_id: string;
          operator_id: string;
          channel: JobContactChannel;
          purpose: JobContactPurpose;
          initiated_by: string;
          initiated_at: string;
        };
        Insert: never;
        Update: never;
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
          declined_at: string | null;
          decline_reason: string | null;
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
          declined_at?: string | null;
          decline_reason?: string | null;
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
      iceland_addresses: {
        Row: {
          source_id: number;
          address_label: string;
          street_name: string;
          house_number: string | null;
          postal_code: string | null;
          municipality_code: string | null;
          special_name: string | null;
          latitude: number;
          longitude: number;
          location: unknown;
          search_text: string;
          search_key: string;
          source_updated_at: string | null;
          imported_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      iceland_places: {
        Row: {
          source_type: "node" | "way" | "relation";
          source_id: number;
          name: string;
          category: string;
          category_label: string;
          search_priority: number;
          latitude: number;
          longitude: number;
          search_text: string;
          search_key: string;
          imported_at: string;
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
      current_operator_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_driver: { Args: Record<PropertyKey, never>; Returns: boolean };
      driver_has_job: { Args: { p_job_id: string }; Returns: boolean };
      set_driver_availability: {
        Args: { p_status: AvailabilityStatus };
        Returns: undefined;
      };
      respond_to_driver_assignment: {
        Args: { p_assignment_id: string; p_accept: boolean; p_notes: string | null };
        Returns: string;
      };
      set_driver_job_status: {
        Args: { p_job_id: string; p_status: JobStatus; p_notes: string | null };
        Returns: undefined;
      };
      save_job_billing: {
        Args: {
          p_job_id: string;
          p_payer_type: BillingPayerType | null;
          p_payer_name: string | null;
          p_payer_kennitala: string | null;
          p_payer_email: string | null;
          p_payer_phone: string | null;
          p_payer_address: string | null;
          p_authorization_reference: string | null;
          p_billing_reference: string | null;
          p_service_summary: string | null;
          p_payer_amount_isk: number | null;
          p_provider_amount_isk: number | null;
          p_notes: string | null;
        };
        Returns: undefined;
      };
      transition_job_billing: {
        Args: {
          p_job_id: string;
          p_action: Exclude<BillingAction, "details_updated">;
          p_reference: string | null;
          p_due_at: string | null;
          p_notes: string | null;
        };
        Returns: undefined;
      };
      link_driver_user: {
        Args: { p_operator_id: string; p_user_id: string };
        Returns: undefined;
      };
      set_driver_access_disabled: {
        Args: { p_operator_id: string; p_disabled: boolean };
        Returns: undefined;
      };
      activate_current_driver_access: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      create_customer_intake_link: {
        Args: { p_job_id: string; p_token_hash: string; p_expires_at: string };
        Returns: string;
      };
      mark_customer_intake_link_opened: {
        Args: { p_link_id: string };
        Returns: string;
      };
      record_job_contact: {
        Args: {
          p_job_id: string;
          p_operator_id: string;
          p_channel: JobContactChannel;
          p_purpose: JobContactPurpose;
        };
        Returns: number;
      };
      revoke_customer_intake_link: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      submit_customer_intake: {
        Args: {
          p_token_hash: string;
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
          p_customer_notes: string;
        };
        Returns: string;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      search_iceland_addresses: {
        Args: { p_query: string; p_limit?: number };
        Returns: Array<{
          id: string;
          label: string;
          latitude: number;
          longitude: number;
        }>;
      };
      reverse_geocode_iceland_address: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_max_distance_meters?: number;
        };
        Returns: Array<{
          id: string;
          label: string;
          latitude: number;
          longitude: number;
          distance_meters: number;
        }>;
      };
    };
    Enums: {
      operator_availability: AvailabilityStatus;
      vehicle_type: VehicleType;
      app_role: "pending" | "dispatcher" | "admin" | "driver";
      job_status: JobStatus;
      job_priority: JobPriority;
      location_source: LocationSource;
      billing_payer_type: BillingPayerType;
      billing_receivable_status: BillingReceivableStatus;
      billing_payable_status: BillingPayableStatus;
      billing_action: BillingAction;
      job_contact_channel: JobContactChannel;
      job_contact_purpose: JobContactPurpose;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type { Json };
