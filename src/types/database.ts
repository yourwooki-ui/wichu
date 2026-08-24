export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          display_name: string;
          birth_date: string;
          gender: string;
          interested_in: string[];
          country_code: string;
          native_language: string | null;
          languages: string[];
          bio: string;
          profile_completeness: number;
          profile_completed: boolean;
          review_status: Database['public']['Enums']['profile_review_status'];
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
          is_active: boolean;
          terms_accepted_at: string;
          privacy_accepted_at: string;
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          display_name: string;
          birth_date: string;
          gender: string;
          interested_in: string[];
          country_code: string;
          native_language?: string | null;
          languages: string[];
          terms_accepted_at: string;
          privacy_accepted_at: string;
          bio?: string;
          profile_completeness?: number;
          profile_completed?: boolean;
          review_status?: Database['public']['Enums']['profile_review_status'];
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
          is_active?: boolean;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          display_name?: string;
          birth_date?: string;
          gender?: string;
          interested_in?: string[];
          country_code?: string;
          native_language?: string | null;
          languages?: string[];
          terms_accepted_at?: string;
          privacy_accepted_at?: string;
          bio?: string;
          profile_completeness?: number;
          profile_completed?: boolean;
          review_status?: Database['public']['Enums']['profile_review_status'];
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
          is_active?: boolean;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      profile_details: Table<
        {
          profile_id: string;
          occupation: string | null;
          education_level: string | null;
          height_cm: number | null;
          personality_type: string | null;
          drinking: string | null;
          smoking: string | null;
          exercise: string | null;
          pets: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          profile_id: string;
          occupation?: string | null;
          education_level?: string | null;
          height_cm?: number | null;
          personality_type?: string | null;
          drinking?: string | null;
          smoking?: string | null;
          exercise?: string | null;
          pets?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          profile_id?: string;
          occupation?: string | null;
          education_level?: string | null;
          height_cm?: number | null;
          personality_type?: string | null;
          drinking?: string | null;
          smoking?: string | null;
          exercise?: string | null;
          pets?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: 'profile_details_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      profile_photos: Table<
        {
          id: string;
          profile_id: string;
          storage_path: string;
          position: number;
          review_status: Database['public']['Enums']['profile_review_status'];
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
          created_at: string;
        },
        {
          id?: string;
          profile_id: string;
          storage_path: string;
          position: number;
          review_status?: Database['public']['Enums']['profile_review_status'];
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          profile_id?: string;
          storage_path?: string;
          position?: number;
          review_status?: Database['public']['Enums']['profile_review_status'];
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
        },
        [
          {
            foreignKeyName: 'profile_photos_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      interests: Table<
        { id: string; slug: string; label: string; created_at: string },
        { id?: string; slug: string; label: string; created_at?: string },
        { id?: string; slug?: string; label?: string; created_at?: string }
      >;
      profile_interests: Table<
        { profile_id: string; interest_id: string; created_at: string },
        { profile_id: string; interest_id: string; created_at?: string },
        { profile_id?: string; interest_id?: string; created_at?: string }
      >;
      profile_languages: Table<
        {
          profile_id: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          created_at: string;
        },
        {
          profile_id: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          created_at?: string;
        },
        {
          profile_id?: string;
          language_code?: string;
          proficiency?: Database['public']['Enums']['language_proficiency'];
          created_at?: string;
        }
      >;
      profile_tags: Table<
        {
          profile_id: string;
          category: string;
          value: string;
          created_at: string;
        },
        {
          profile_id: string;
          category: string;
          value: string;
          created_at?: string;
        },
        {
          profile_id?: string;
          category?: string;
          value?: string;
          created_at?: string;
        }
      >;
      swipes: Table<
        {
          id: string;
          swiper_id: string;
          target_id: string;
          action: Database['public']['Enums']['swipe_action'];
          created_at: string;
        },
        {
          id?: string;
          swiper_id?: string;
          target_id: string;
          action: Database['public']['Enums']['swipe_action'];
          created_at?: string;
        },
        {
          id?: string;
          swiper_id?: string;
          target_id?: string;
          action?: Database['public']['Enums']['swipe_action'];
          created_at?: string;
        }
      >;
      matches: Table<
        {
          id: string;
          user_a: string;
          user_b: string;
          matched_at: string;
          status: Database['public']['Enums']['match_status'];
        },
        {
          id?: string;
          user_a: string;
          user_b: string;
          matched_at?: string;
          status?: Database['public']['Enums']['match_status'];
        },
        {
          id?: string;
          user_a?: string;
          user_b?: string;
          matched_at?: string;
          status?: Database['public']['Enums']['match_status'];
        }
      >;
      messages: Table<
        {
          id: string;
          match_id: string;
          sender_id: string;
          client_id: string | null;
          content: string;
          original_language: string | null;
          translated_content: Json;
          created_at: string;
        },
        {
          id?: string;
          match_id: string;
          sender_id?: string;
          client_id?: string | null;
          content: string;
          original_language?: string | null;
          translated_content?: Json;
          created_at?: string;
        },
        {
          id?: string;
          match_id?: string;
          sender_id?: string;
          client_id?: string | null;
          content?: string;
          original_language?: string | null;
          translated_content?: Json;
          created_at?: string;
        }
      >;
      match_read_states: Table<
        {
          match_id: string;
          user_id: string;
          last_read_at: string;
          updated_at: string;
        },
        {
          match_id: string;
          user_id: string;
          last_read_at?: string;
          updated_at?: string;
        },
        {
          match_id?: string;
          user_id?: string;
          last_read_at?: string;
          updated_at?: string;
        }
      >;
      blocks: Table<
        { id: string; blocker_id: string; blocked_id: string; created_at: string },
        { id?: string; blocker_id?: string; blocked_id: string; created_at?: string },
        { id?: string; blocker_id?: string; blocked_id?: string; created_at?: string }
      >;
      reports: Table<
        {
          id: string;
          reporter_id: string;
          reported_id: string;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
        },
        {
          id?: string;
          reporter_id?: string;
          reported_id: string;
          reason: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        },
        {
          id?: string;
          reporter_id?: string;
          reported_id?: string;
          reason?: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        }
      >;
      user_settings: Table<
        {
          user_id: string;
          min_age: number;
          max_age: number;
          max_distance_km: number;
          country_codes: string[];
          exclude_same_country: boolean;
          discovery_enabled: boolean;
          push_matches: boolean;
          push_messages: boolean;
          locale: string;
          updated_at: string;
        },
        {
          user_id: string;
          min_age?: number;
          max_age?: number;
          max_distance_km?: number;
          country_codes?: string[];
          exclude_same_country?: boolean;
          discovery_enabled?: boolean;
          push_matches?: boolean;
          push_messages?: boolean;
          locale?: string;
          updated_at?: string;
        },
        {
          user_id?: string;
          min_age?: number;
          max_age?: number;
          max_distance_km?: number;
          country_codes?: string[];
          exclude_same_country?: boolean;
          discovery_enabled?: boolean;
          push_matches?: boolean;
          push_messages?: boolean;
          locale?: string;
          updated_at?: string;
        }
      >;
      subscriptions: Table<
        {
          id: string;
          user_id: string;
          product_id: string;
          platform: string;
          status: Database['public']['Enums']['subscription_status'];
          current_period_end: string | null;
          provider_reference: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          product_id: string;
          platform: string;
          status?: Database['public']['Enums']['subscription_status'];
          current_period_end?: string | null;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          product_id?: string;
          platform?: string;
          status?: Database['public']['Enums']['subscription_status'];
          current_period_end?: string | null;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      profile_visits: Table<
        {
          profile_id: string;
          visitor_id: string;
          first_visited_at: string;
          last_visited_at: string;
          visit_count: number;
        },
        {
          profile_id: string;
          visitor_id?: string;
          first_visited_at?: string;
          last_visited_at?: string;
          visit_count?: number;
        },
        {
          profile_id?: string;
          visitor_id?: string;
          first_visited_at?: string;
          last_visited_at?: string;
          visit_count?: number;
        }
      >;
      push_devices: Table<
        {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: string;
          device_name: string | null;
          enabled: boolean;
          last_registered_at: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          expo_push_token: string;
          platform: string;
          device_name?: string | null;
          enabled?: boolean;
          last_registered_at?: string;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          expo_push_token?: string;
          platform?: string;
          device_name?: string | null;
          enabled?: boolean;
          last_registered_at?: string;
          created_at?: string;
        }
      >;
      notification_outbox: Table<
        {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string;
          route: string;
          source_id: string;
          status: string;
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
          processing_started_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body: string;
          route: string;
          source_id: string;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
          processing_started_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          body?: string;
          route?: string;
          source_id?: string;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
          processing_started_at?: string | null;
          created_at?: string;
        }
      >;
      push_delivery_receipts: Table<
        {
          id: string;
          outbox_id: string;
          push_device_id: string | null;
          expo_ticket_id: string | null;
          ticket_status: string;
          delivery_status: string;
          error_code: string | null;
          checked_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          outbox_id: string;
          push_device_id?: string | null;
          expo_ticket_id?: string | null;
          ticket_status: string;
          delivery_status?: string;
          error_code?: string | null;
          checked_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          outbox_id?: string;
          push_device_id?: string | null;
          expo_ticket_id?: string | null;
          ticket_status?: string;
          delivery_status?: string;
          error_code?: string | null;
          checked_at?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<never, never>;
    Functions: {
      record_my_swipe: {
        Args: {
          p_target_id: string;
          p_action: Database['public']['Enums']['swipe_action'];
        };
        Returns: { swipe_id: string; match_id: string | null }[];
      };
      undo_my_swipe: {
        Args: { p_target_id: string };
        Returns: { undone: boolean; unlimited: boolean; credits_remaining: number }[];
      };
      get_my_undo_entitlement: {
        Args: Record<never, never>;
        Returns: { unlimited: boolean; credits: number }[];
      };
      grant_rewarded_undo_credit: {
        Args: { p_user_id: string; p_provider_event_id: string };
        Returns: number;
      };
      send_my_message: {
        Args: {
          p_match_id: string;
          p_client_id: string;
          p_content: string;
          p_original_language?: string;
        };
        Returns: Database['public']['Tables']['messages']['Row'];
      };
      mark_match_read: { Args: { p_match_id: string }; Returns: string };
      get_my_unread_counts: {
        Args: Record<never, never>;
        Returns: { match_id: string; unread_count: number }[];
      };
      get_my_match_connections: {
        Args: { p_limit?: number };
        Returns: {
          match_id: string;
          matched_at: string;
          profile_id: string;
          display_name: string;
          birth_date: string;
          country_code: string;
          last_active_at: string | null;
          photo_path: string | null;
          last_message_content: string | null;
          last_message_created_at: string | null;
          last_message_sender_id: string | null;
          unread_count: number;
        }[];
      };
      claim_my_message_translation: {
        Args: { p_message_id: string; p_target_language: string };
        Returns: {
          content: string;
          source_language: string;
          target_language: string;
          cached_translation: string | null;
        }[];
      };
      complete_message_translation: {
        Args: {
          p_message_id: string;
          p_target_language: string;
          p_translated_text: string;
        };
        Returns: string;
      };
      fail_message_translation: {
        Args: { p_message_id: string; p_target_language: string };
        Returns: undefined;
      };
      get_discovery_candidates: {
        Args: {
          p_min_age?: number;
          p_max_age?: number;
          p_max_distance_km?: number;
          p_genders?: string[] | null;
          p_country_codes?: string[] | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          display_name: string;
          birth_date: string;
          gender: string;
          country_code: string;
          languages: string[];
          language_details: Json;
          bio: string;
          created_at: string;
          last_active_at: string | null;
          distance_km: number | null;
          is_gold_pass: boolean;
          photo_paths: string[];
          interests: string[];
        }[];
      };
      update_my_location: {
        Args: { p_latitude: number; p_longitude: number };
        Returns: string;
      };
      touch_presence: {
        Args: Record<never, never>;
        Returns: string | null;
      };
      record_profile_visit: {
        Args: { p_profile_id: string };
        Returns: undefined;
      };
      get_my_profile_visitors: {
        Args: { p_limit?: number };
        Returns: {
          visitor_id: string;
          display_name: string;
          birth_date: string;
          country_code: string;
          last_active_at: string | null;
          distance_km: number | null;
          is_gold_pass: boolean;
          last_visited_at: string;
          visit_count: number;
          photo_path: string | null;
        }[];
      };
      get_my_incoming_likes: {
        Args: { p_limit?: number };
        Returns: {
          profile_id: string;
          display_name: string;
          birth_date: string;
          country_code: string;
          last_active_at: string | null;
          distance_km: number | null;
          is_gold_pass: boolean;
          liked_at: string;
          photo_path: string | null;
        }[];
      };
      submit_profile_for_review: {
        Args: Record<never, never>;
        Returns: Database['public']['Enums']['profile_review_status'];
      };
      deactivate_my_account: { Args: Record<never, never>; Returns: undefined };
      request_my_account_deletion: { Args: Record<never, never>; Returns: undefined };
      claim_my_account_deletion: { Args: Record<never, never>; Returns: boolean };
      save_my_profile_for_review: {
        Args: {
          p_display_name: string;
          p_birth_date: string;
          p_gender: string;
          p_interested_in: string[];
          p_country_code: string;
          p_native_language: string;
          p_languages: string[];
          p_bio: string;
          p_min_age: number;
          p_max_age: number;
          p_locale: string;
          p_interest_ids: string[];
          p_spoken_languages: Json;
          p_tags: Json;
          p_photo_paths: string[];
        };
        Returns: string[];
      };
      review_profile_submission: {
        Args: {
          profile_id: string;
          decision: Database['public']['Enums']['profile_review_status'];
          note?: string | null;
        };
        Returns: Database['public']['Enums']['profile_review_status'];
      };
      get_pending_profile_reviews: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          id: string;
          display_name: string;
          age: number;
          gender: string;
          country_code: string;
          languages: string[];
          bio: string;
          submitted_at: string | null;
          photo_paths: string[];
          interests: string[];
          profile_tags: Json;
        }[];
      };
      get_my_admin_access: {
        Args: Record<never, never>;
        Returns: { role: 'master' | 'operator'; active: boolean }[];
      };
      get_my_blocked_users: {
        Args: Record<never, never>;
        Returns: {
          block_id: string;
          profile_id: string;
          display_name: string;
          country_code: string;
          photo_path: string | null;
          blocked_at: string;
        }[];
      };
      get_pending_reports: {
        Args: { p_limit?: number; p_before?: string | null };
        Returns: {
          id: string;
          reporter_id: string;
          reported_id: string;
          reported_display_name: string;
          reported_photo_path: string | null;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
        }[];
      };
      resolve_report: {
        Args: {
          p_report_id: string;
          p_resolution: Database['public']['Enums']['report_resolution'];
        };
        Returns: string;
      };
      end_my_match: {
        Args: { p_match_id: string };
        Returns: Database['public']['Enums']['match_status'];
      };
      register_my_push_device: {
        Args: {
          p_expo_push_token: string;
          p_platform: string;
          p_device_name?: string | null;
        };
        Returns: string;
      };
      claim_notification_outbox: {
        Args: { p_outbox_id: string };
        Returns: Database['public']['Tables']['notification_outbox']['Row'] | null;
      };
      complete_push_receipts: {
        Args: { p_results: Json };
        Returns: Json;
      };
    };
    Enums: {
      language_proficiency: 'beginner' | 'intermediate' | 'advanced' | 'fluent';
      profile_review_status: 'draft' | 'pending' | 'approved' | 'rejected';
      report_resolution: 'reviewed' | 'closed';
      swipe_action: 'like' | 'pass';
      match_status: 'active' | 'unmatched';
      subscription_status: 'inactive' | 'active' | 'expired' | 'cancelled';
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
