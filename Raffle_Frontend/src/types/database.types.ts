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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_address: string
          created_at: string | null
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_address: string
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_address?: string
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      agent_vault: {
        Row: {
          category: string
          content: string
          file_path: string
          id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: string
          content: string
          file_path: string
          id?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string
          content?: string
          file_path?: string
          id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      agents_vault: {
        Row: {
          created_at: string | null
          id: string
          input_data: Json | null
          metadata: Json | null
          output_data: Json | null
          parent_task_id: string | null
          requested_by_wallet: string
          status: string | null
          target_agent: string
          task_description: string | null
          task_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          parent_task_id?: string | null
          requested_by_wallet: string
          status?: string | null
          target_agent: string
          task_description?: string | null
          task_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          parent_task_id?: string | null
          requested_by_wallet?: string
          status?: string | null
          target_agent?: string
          task_description?: string | null
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_vault_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "agents_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_tokens: {
        Row: {
          address: string
          chain_id: number
          decimals: number
          is_active: boolean | null
          symbol: string
        }
        Insert: {
          address: string
          chain_id: number
          decimals: number
          is_active?: boolean | null
          symbol: string
        }
        Update: {
          address?: string
          chain_id?: number
          decimals?: number
          is_active?: boolean | null
          symbol?: string
        }
        Relationships: []
      }
      api_action_log: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          signature_hash: string
          wallet_address: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          signature_hash: string
          wallet_address: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          signature_hash?: string
          wallet_address?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      campaign_tasks: {
        Row: {
          action_type: string
          campaign_id: string | null
          id: string
          order_index: number | null
          target_id: string
          target_url: string
        }
        Insert: {
          action_type: string
          campaign_id?: string | null
          id?: string
          order_index?: number | null
          target_id: string
          target_url: string
        }
        Update: {
          action_type?: string
          campaign_id?: string | null
          id?: string
          order_index?: number | null
          target_id?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          banner_url: string | null
          chain_id: number
          created_at: string | null
          creation_tx_hash: string
          current_participants: number | null
          description: string | null
          duration_days: number
          end_at: string | null
          id: string
          is_refunded: boolean | null
          max_participants: number
          platform_code: string | null
          platform_fee_paid: number
          refund_amount_platform: number | null
          refund_amount_sponsor: number | null
          refund_tx_hash: string | null
          remaining_reward_pool: number
          reward_amount_per_user: number
          reward_token_address: string
          sponsor_address: string
          start_at: string
          status: string | null
          title: string
          total_reward_pool: number
        }
        Insert: {
          banner_url?: string | null
          chain_id?: number
          created_at?: string | null
          creation_tx_hash: string
          current_participants?: number | null
          description?: string | null
          duration_days: number
          end_at?: string | null\n          id?: string
          is_refunded?: boolean | null
          max_participants: number
          platform_code?: string | null
          platform_fee_paid: number
          refund_amount_platform?: number | null
          refund_amount_sponsor?: number | null
          refund_tx_hash?: string | null
          remaining_reward_pool: number
          reward_amount_per_user: number
          reward_token_address: string
          sponsor_address: string
          start_at?: string
          status?: string | null
          title: string
          total_reward_pool: number
        }
        Update: {
          banner_url?: string | null
          chain_id?: number
          created_at?: string | null
          creation_tx_hash?: string
          current_participants?: number | null
          description?: string | null
          duration_days?: number
          end_at?: string | null
          id?: string
          is_refunded?: boolean | null
          max_participants?: number
          platform_code?: string | null
          platform_fee_paid?: number
          refund_amount_platform?: number | null
          refund_amount_sponsor?: number | null
          refund_tx_hash?: string | null
          remaining_reward_pool?: number
          reward_amount_per_user?: number
          reward_token_address?: string
          sponsor_address?: string
          start_at?: string
          status?: string | null
          title?: string
          total_reward_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_platform_code_fkey"
            columns: ["platform_code"]
            isOneToOne: false
            referencedRelation: "supported_platforms"
            referencedColumns: ["code"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          account_age_requirement: number | null
          action_type: string | null
          created_at: string | null
          description: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          link: string | null
          min_followers: number | null
          min_neynar_score: number | null
          min_tier: number | null
          no_spam_filter: boolean | null
          onchain_id: number | null
          platform: string | null
          power_badge_required: boolean | null
          requires_verification: boolean | null
          target_id: string | null
          task_type: string | null
          title: string | null
          xp_reward: number | null
        }
        Insert: {
          account_age_requirement?: number | null
          action_type?: string | null
          created_at?: string | null
          description: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link?: string | null
          min_followers?: number | null
          min_neynar_score?: number | null
          min_tier?: number | null
          no_spam_filter?: boolean | null
          onchain_id?: number | null
          platform?: string | null
          power_badge_required?: boolean | null
          requires_verification?: boolean | null
          target_id?: string | null
          task_type?: string | null
          title?: string | null
          xp_reward?: number | null
        }
        Update: {
          account_age_requirement?: number | null
          action_type?: string | null
          created_at?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link?: string | null
          min_followers?: number | null
          min_neynar_score?: number | null
          min_tier?: number | null
          no_spam_filter?: boolean | null
          onchain_id?: number | null
          platform?: string | null
          power_badge_required?: boolean | null
          requires_verification?: boolean | null
          target_id?: string | null
          task_type?: string | null
          title?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      ens_subdomains: {
        Row: {
          created_at: string
          fid: number
          full_name: string
          id: string
          label: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          fid: number
          full_name: string
          id?: string
          label: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          fid?: number
          full_name?: string
          id?: string
          label?: string
          wallet_address?: string
        }
        Relationships: []
      }
      point_settings: {
        Row: {
          action_type: string | null
          activity_key: string
          description: string | null
          id: number
          is_active: boolean | null
          is_hidden: boolean | null
          platform: string | null
          points_value: number
          updated_at: string | null
        }
        Insert: {
          action_type?: string | null
          activity_key: string
          description?: string | null
          id?: never
          is_active?: boolean | null
          is_hidden?: boolean | null\n          platform?: string | null
          points_value?: number
          updated_at?: string | null
        }
        Update: {
          action_type?: string | null
          activity_key?: string
          description?: string | null
          id?: never
          is_active?: boolean | null
          is_hidden?: boolean | null
          platform?: string | null
          points_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      project_revenue_logs: {
        Row: {
          amount_eth: number
          created_at: string | null
          id: string
          raffle_id: number | null
          source_type: string
          tx_hash: string | null
        }
        Insert: {
          amount_eth: number
          created_at?: string | null
          id?: string
          raffle_id?: number | null
          source_type: string
          tx_hash?: string | null
        }
        Update: {
          amount_eth?: number
          created_at?: string | null
          id?: string
          raffle_id?: number | null
          source_type?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_revenue_logs_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      raffles: {
        Row: {
          created_at: string | null\n          creator_address: string
          end_time: string | null
          id: number
          is_active: boolean | null
          is_finalized: boolean | null
          max_tickets: number | null
          metadata_uri: string | null
          nft_contract: string | null
          prize_per_winner: number | null
          prize_pool: number | null
          sponsor_address: string | null
          token_id: number | null
          updated_at: string | null
          winner_count: number | null
        }
        Insert: {
          created_at?: string | null
          creator_address: string
          end_time?: string | null
          id: number
          is_active?: boolean | null
          is_finalized?: boolean | null
          max_tickets?: number | null
          metadata_uri?: string | null
          nft_contract?: string | null
          prize_per_winner?: number | null
          prize_pool?: number | null
          sponsor_address?: string | null
          token_id?: number | null
          updated_at?: string | null
          winner_count?: number | null
        }
        Update: {
          created_at?: string | null
          creator_address?: string
          end_time?: string | null
          id?: number
          is_active?: boolean | null
          is_finalized?: boolean | null
          max_tickets?: number | null
          metadata_uri?: string | null
          nft_contract?: string | null
          prize_per_winner?: number | null
          prize_pool?: number | null
          sponsor_address?: string | null
          token_id?: number | null
          updated_at?: string | null
          winner_count?: number | null
        }
        Relationships: []
      }
      sbt_pool_stats: {
        Row: {\n          acc_bronze: string | null
          acc_diamond: string | null
          acc_gold: string | null
          acc_platinum: string | null
          acc_silver: string | null
          bronze_holders: number | null
          diamond_holders: number | null
          gold_holders: number | null
          id: number
          last_distribution_at: string | null
          platinum_holders: number | null
          silver_holders: number | null
          total_locked_rewards: number | null
          total_pool_balance: number | null
          updated_at: string | null
        }
        Insert: {
          acc_bronze?: string | null
          acc_diamond?: string | null
          acc_gold?: string | null
          acc_platinum?: string | null
          acc_silver?: string | null
          bronze_holders?: number | null
          diamond_holders?: number | null
          gold_holders?: number | null
          id: number
          last_distribution_at?: string | null
          platinum_holders?: number | null
          silver_holders?: number | null
          total_locked_rewards?: number | null
          total_pool_balance?: number | null
          updated_at?: string | null
        }
        Update: {
          acc_bronze?: string | null
          acc_diamond?: string | null
          acc_gold?: string | null
          acc_platinum?: string | null
          acc_silver?: string | null
          bronze_holders?: number | null
          diamond_holders?: number | null
          gold_holders?: number | null
          id?: number
          last_distribution_at?: string | null
          platinum_holders?: number | null
          silver_holders?: number | null
          total_locked_rewards?: number | null
          total_pool_balance?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sbt_thresholds: {
        Row: {
          badge_url: string | null
          created_at: string | null
          id: string | null
          level: number
          level_name: string | null
          min_xp: number
          tier_name: string | null
        }
        Insert: {
          badge_url?: string | null
          created_at?: string | null
          id?: string | null
          level: number
          level_name?: string | null
          min_xp: number
          tier_name?: string | null
        }
        Update: {
          badge_url?: string | null
          created_at?: string | null
          id?: string | null
          level?: number
          level_name?: string | null
          min_xp?: number
          tier_name?: string | null
        }
        Relationships: []
      }
      sponsor_stats: {
        Row: {
          sponsor_address: string
          total_earnings_accumulated: number | null
          total_raffles_created: number | null
          total_tickets_sold: number | null
          updated_at: string | null
        }
        Insert: {
          sponsor_address: string
          total_earnings_accumulated?: number | null
          total_raffles_created?: number | null
          total_tickets_sold?: number | null
          updated_at?: string | null
        }
        Update: {
          sponsor_address?: string
          total_earnings_accumulated?: number | null
          total_raffles_created?: number | null
          total_tickets_sold?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supported_platforms: {
        Row: {
          api_provider: string | null
          code: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          api_provider?: string | null
          code: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          api_provider?: string | null
          code?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          id: string
          last_synced_block: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_synced_block?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_synced_block?: number
          updated_at?: string | null
        }
        Relationships: []
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
      user_activity_logs: {
        Row: {
          activity_type: string
          category: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          tx_hash: string | null
          value_amount: number | null
          value_symbol: string | null
          wallet_address: string
        }
        Insert: {
          activity_type: string
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tx_hash?: string | null
          value_amount?: number | null
          value_symbol?: string | null
          wallet_address: string
        }
        Update: {
          activity_type?: string
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tx_hash?: string | null\n          value_amount?: number | null\n          value_symbol?: string | null\n          wallet_address?: string\n        }\n        Relationships: []\n      }\n      user_claims: {\n        Row: {\n          campaign_id: string | null\n          claimed_at: string | null\n          created_at: string | null\n          id: string\n          is_claimed: boolean | null\n          is_verified: boolean | null\n          payout_amount: number | null\n          payout_status: string | null\n          payout_tx_hash: string | null\n          platform_identity: string | null\n          user_address: string\n          verified_at: string | null\n        }\n        Insert: {\n          campaign_id?: string | null\n          claimed_at?: string | null\n          created_at?: string | null\n          id?: string\n          is_claimed?: boolean | null\n          is_verified?: boolean | null\n          payout_amount?: number | null\n          payout_status?: string | null\n          payout_tx_hash?: string | null\n          platform_identity?: string | null\n          user_address: string\n          verified_at?: string | null\n        }\n        Update: {\n          campaign_id?: string | null\n          claimed_at?: string | null\n          created_at?: string | null\n          id?: string\n          is_claimed?: boolean | null\n          is_verified?: boolean | null\n          payout_amount?: number | null\n          payout_status?: string | null\n          payout_tx_hash?: string | null\n          platform_identity?: string | null\n          user_address?: string\n          verified_at?: string | null\n        }\n        Relationships: [\n          {\n            foreignKeyName: \"user_claims_campaign_id_fkey\"\n            columns: [\"campaign_id\"]\n            isOneToOne: false\n            referencedRelation: \"campaigns\"\n            referencedColumns: [\"id\"]\n          },\n        ]\n      }\n      user_point_logs: {\n        Row: {\n          activity_key: string\n          created_at: string | null\n          fid: number | null\n          id: string\n          metadata: Json | null\n          points_earned: number\n          user_address: string\n        }\n        Insert: {\n          activity_key: string\n          created_at?: string | null\n          fid?: number | null\n          id?: string\n          metadata?: Json | null\n          points_earned: number\n          user_address: string\n        }\n        Update: {\n          activity_key?: string\n          created_at?: string | null\n          fid?: number | null\n          id?: string\n          metadata?: Json | null\n          points_earned?: number\n          user_address?: string\n        }\n        Relationships: []\n      }\n      user_privileges: {\n        Row: {\n          feature_id: string\n          granted_at: string | null\n          wallet_address: string\n        }\n        Insert: {\n          feature_id: string\n          granted_at?: string | null\n          wallet_address: string\n        }\n        Update: {\n          feature_id?: string\n          granted_at?: string | null\n          wallet_address?: string\n        }\n        Relationships: []\n      }\n      user_profiles: {\n        Row: {\n          active_status: string | null\n          bio: string | null\n          created_at: string | null\n          display_name: string | null\n          fid: number | null\n          follower_count: number | null\n          following_count: number | null\n          google_email: string | null\n          google_id: string | null\n          instagram_id: string | null\n          instagram_username: string | null\n          is_admin: boolean | null\n          is_operator: boolean | null\n          last_daily_bonus_claim: string | null\n          last_login_at: string | null\n          last_streak_claim: string | null\n          neynar_score: number | null\n          oauth_provider: string | null\n          pfp_url: string | null\n          power_badge: boolean | null\n          raffle_tickets_bought: number | null\n          raffle_wins: number\n          raffles_created: number | null\n          referred_by: string | null\n          streak_count: number | null\n          telegram_id: string | null\n          telegram_username: string | null\n          tier: number | null\n          tier_override: number | null\n          tiktok_id: string | null\n          tiktok_username: string | null\n          total_xp: number | null\n          trust_score: number | null\n          twitter_id: string | null\n          twitter_username: string | null\n          updated_at: string | null\n          username: string | null\n          verifications: string[] | null\n          wallet_address: string\n        }\n        Insert: {\n          active_status?: string | null\n          bio?: string | null\n          created_at?: string | null\n          display_name?: string | null\n          fid?: number | null\n          follower_count?: number | null\n          following_count?: number | null\n          google_email?: string | null\n          google_id?: string | null\n          instagram_id?: string | null\n          instagram_username?: string | null\n          is_admin?: boolean | null\n          is_operator?: boolean | null\n          last_daily_bonus_claim?: string | null\n          last_login_at?: string | null\n          last_streak_claim?: string | null\n          neynar_score?: number | null\n          oauth_provider?: string | null\n          pfp_url?: string | null\n          power_badge?: boolean | null\n          raffle_tickets_bought?: number | null\n          raffle_wins?: number\n          raffles_created?: number | null\n          referred_by?: string | null\n          streak_count?: number | null\n          telegram_id?: string | null\n          telegram_username?: string | null\n          tier?: number | null\n          tier_override?: number | null\n          tiktok_id?: string | null\n          tiktok_username?: string | null\n          total_xp?: number | null\n          trust_score?: number | null\n          twitter_id?: string | null\n          twitter_username?: string | null\n          updated_at?: string | null\n          username?: string | null\n          verifications?: string[] | null\n          wallet_address: string\n        }\n        Update: {\n          active_status?: string | null\n          bio?: string | null\n          created_at?: string | null\n          display_name?: string | null\n          fid?: number | null\n          follower_count?: number | null\n          following_count?: number | null\n          google_email?: string | null\n          google_id?: string | null\n          instagram_id?: string | null\n          instagram_username?: string | null\n          is_admin?: boolean | null\n          is_operator?: boolean | null\n          last_daily_bonus_claim?: string | null\n          last_login_at?: string | null\n          last_streak_claim?: string | null\n          neynar_score?: number | null\n          oauth_provider?: string | null\n          pfp_url?: string | null\n          power_badge?: boolean | null\n          raffle_tickets_bought?: number | null\n          raffle_wins?: number\n          raffles_created?: number | null\n          referred_by?: string | null\n          streak_count?: number | null\n          telegram_id?: string | null\n          telegram_username?: string | null\n          tier?: number | null\n          tier_override?: number | null\n          tiktok_id?: string | null\n          tiktok_username?: string | null\n          total_xp?: number | null\n          trust_score?: number | null\n          twitter_id?: string | null\n          twitter_username?: string | null\n          updated_at?: string | null\n          username?: string | null\n          verifications?: string[] | null\n          wallet_address?: string\n        }\n        Relationships: []\n      }\n      user_task_claims: {\n        Row: {\n          action_type: string | null\n          claimed_at: string | null\n          id: string\n          platform: string | null\n          target_id: string | null\n          task_id: string\n          wallet_address: string\n          xp_earned: number\n        }\n        Insert: {\n          action_type?: string | null\n          claimed_at?: string | null\n          id?: string\n          platform?: string | null\n          target_id?: string | null\n          task_id: string\n          wallet_address: string\n          xp_earned: number\n        }\n        Update: {\n          action_type?: string | null\n          claimed_at?: string | null\n          id?: string\n          platform?: string | null\n          target_id?: string | null\n          task_id?: string\n          wallet_address?: string\n          xp_earned?: number\n        }\n        Relationships: [\n          {\n            foreignKeyName: \"user_task_claims_task_id_fkey\"\n            columns: [\"task_id\"]\n            isOneToOne: false\n            referencedRelation: \"daily_tasks\"\n            referencedColumns: [\"id\"]\n          },\n          {\n            foreignKeyName: \"user_task_claims_wallet_address_fkey\"\n            columns: [\"wallet_address\"]\n            isOneToOne: false\n            referencedRelation: \"user_profiles\"\n            referencedColumns: [\"wallet_address\"]\n          },\n          {\n            foreignKeyName: \"user_task_claims_wallet_address_fkey\"\n            columns: [\"wallet_address\"]\n            isOneToOne: false\n            referencedRelation: \"user_stats\"\n            referencedColumns: [\"wallet_address\"]\n          },\n          {\n            foreignKeyName: \"user_task_claims_wallet_address_fkey\"\n            columns: [\"wallet_address\"]\n            isOneToOne: false\n            referencedRelation: \"v_user_full_profile\"\n            referencedColumns: [\"wallet_address\"]\n          },\n        ]\n      }\n    }\n    Views: {\n      user_stats: {\n        Row: {\n          display_name: string | null\n          fid: number | null\n          is_admin: boolean | null\n          is_operator: boolean | null\n          last_daily_bonus_claim: string | null\n          pfp_url: string | null\n          rank_name: string | null\n          referred_by: string | null\n          streak_count: number | null\n          tier: number | null\n          total_xp: number | null\n          updated_at: string | null\n          username: string | null\n          wallet_address: string | null\n        }\n        Relationships: []\n      }\n      v_user_full_profile: {\n        Row: {\n          active_status: string | null\n          bio: string | null\n          display_name: string | null\n          fid: number | null\n          follower_count: number | null\n          following_count: number | null\n          google_email: string | null\n          google_id: string | null\n          is_admin: boolean | null\n          is_operator: boolean | null\n          last_daily_bonus_claim: string | null\n          neynar_score: number | null\n          oauth_provider: string | null\n          pfp_url: string | null\n          power_badge: boolean | null\n          rank_name: string | null\n          referred_by: string | null\n          streak_count: number | null\n          tier: number | null\n          total_xp: number | null\n          twitter_id: string | null\n          twitter_username: string | null\n          updated_at: string | null\n          username: string | null\n          verifications: string[] | null\n          wallet_address: string | null\n        }\n        Relationships: []\n      }\n    }\n    Functions: {\n      fn_archive_and_reset_season: {\n        Args: { p_new_season_id: number; p_old_season_id: number }\n        Returns: undefined\n      }\n      fn_compute_leaderboard_tiers: {\n        Args: never\n        Returns: {\n          computed_tier: number\n          wallet_address: string\n        }[]\n      }\n      fn_deactivate_expired_tasks: { Args: never; Returns: undefined }\n      fn_get_leaderboard: {\n        Args: { p_limit?: number; p_tier?: string }\n        Returns: {\n          display_name: string\n          pfp_url: string\n          raffle_wins: number\n          raffles_created: number\n          rank_name: string\n          total_xp: number\n          wallet_address: string\n        }[]\n      }\n      fn_get_tier_distribution: {\n        Args: never\n        Returns: {\n          tier_label: string\n          user_count: number\n        }[]\n      }\n      fn_increment_campaign_participants: {\n        Args: { p_campaign_id: string }\n        Returns: undefined\n      }\n      fn_increment_raffle_tickets: {\n        Args: { p_amount?: number; p_wallet: string }\n        Returns: undefined\n      }\n      fn_increment_raffle_wins: {\n        Args: { p_wallet: string }\n        Returns: undefined\n      }\n      fn_increment_raffles_created: {\n        Args: { p_wallet: string }\n        Returns: undefined\n      }\n      fn_increment_user_xp: {\n        Args: { p_wallet: string; p_xp: number }\n        Returns: undefined\n      }\n      fn_refresh_rank_scores: { Args: never; Returns: undefined }\n      is_admin_wallet: { Args: { wallet: string }; Returns: boolean }\n    }\n    Enums: {\n      [_ in never]: never\n    }\n    CompositeTypes: {\n      [_ in never]: never\n    }\n  }\n}

export type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

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
