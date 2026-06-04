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
          hash: string | null
          id: string
          summary: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: string
          content: string
          file_path: string
          hash?: string | null
          id?: string
          summary?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string
          content?: string
          file_path?: string
          hash?: string | null
          id?: string
          summary?: string | null
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
          claim_deadline_at: string | null
          created_at: string | null
          creation_tx_hash: string
          current_participants: number | null
          description: string | null
          duration_days: number
          end_at: string | null
          escrow_campaign_key: string | null
          escrow_contract_address: string | null
          escrow_deposit_tx_hash: string | null
          escrow_funded_at: string | null
          id: string
          is_active: boolean | null
          is_refunded: boolean | null
          is_revenue_allocated: boolean | null
          is_verified_payment: boolean | null
          listing_fee: number | null
          listing_fee_usdc: number | null
          max_participants: number
          payment_token: string | null
          payment_tx_hash: string | null
          platform_code: string | null
          platform_fee_paid: number
          refund_amount_platform: number | null
          refund_amount_sponsor: number | null
          refund_tx_hash: string | null
          remaining_reward_pool: number
          reward_amount_per_user: number
          reward_symbol: string | null
          reward_token_address: string
          sbt_share_amount: number | null
          sponsor_address: string
          start_at: string
          status: string | null
          title: string
          total_reward_pool: number
        }
        Insert: {
          banner_url?: string | null
          chain_id?: number
          claim_deadline_at?: string | null
          created_at?: string | null
          creation_tx_hash: string
          current_participants?: number | null
          description?: string | null
          duration_days: number
          end_at?: string | null
          escrow_campaign_key?: string | null
          escrow_contract_address?: string | null
          escrow_deposit_tx_hash?: string | null
          escrow_funded_at?: string | null
          id?: string
          is_active?: boolean | null
          is_refunded?: boolean | null
          is_revenue_allocated?: boolean | null
          is_verified_payment?: boolean | null
          listing_fee?: number | null
          listing_fee_usdc?: number | null
          max_participants: number
          payment_token?: string | null
          payment_tx_hash?: string | null
          platform_code?: string | null
          platform_fee_paid: number
          refund_amount_platform?: number | null
          refund_amount_sponsor?: number | null
          refund_tx_hash?: string | null
          remaining_reward_pool: number
          reward_amount_per_user: number
          reward_symbol?: string | null
          reward_token_address: string
          sbt_share_amount?: number | null
          sponsor_address: string
          start_at?: string
          status?: string | null
          title: string
          total_reward_pool: number
        }
        Update: {
          banner_url?: string | null
          chain_id?: number
          claim_deadline_at?: string | null
          created_at?: string | null
          creation_tx_hash?: string
          current_participants?: number | null
          description?: string | null
          duration_days?: number
          end_at?: string | null
          escrow_campaign_key?: string | null
          escrow_contract_address?: string | null
          escrow_deposit_tx_hash?: string | null
          escrow_funded_at?: string | null
          id?: string
          is_active?: boolean | null
          is_refunded?: boolean | null
          is_revenue_allocated?: boolean | null
          is_verified_payment?: boolean | null
          listing_fee?: number | null
          listing_fee_usdc?: number | null
          max_participants?: number
          payment_token?: string | null
          payment_tx_hash?: string | null
          platform_code?: string | null
          platform_fee_paid?: number
          refund_amount_platform?: number | null
          refund_amount_sponsor?: number | null
          refund_tx_hash?: string | null
          remaining_reward_pool?: number
          reward_amount_per_user?: number
          reward_symbol?: string | null
          reward_token_address?: string
          sbt_share_amount?: number | null
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
          creator_address: string | null
          description: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_base_social_required: boolean | null
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
          token_reward_amount: number | null
          token_reward_symbol: string | null
          xp_reward: number | null
        }
        Insert: {
          account_age_requirement?: number | null
          action_type?: string | null
          created_at?: string | null
          creator_address?: string | null
          description: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_social_required?: boolean | null
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
          token_reward_amount?: number | null
          token_reward_symbol?: string | null
          xp_reward?: number | null
        }
        Update: {
          account_age_requirement?: number | null
          action_type?: string | null
          created_at?: string | null
          creator_address?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_social_required?: boolean | null
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
          token_reward_amount?: number | null
          token_reward_symbol?: string | null
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
      nexus_agent_reports: {
        Row: {
          agent_role: string
          created_at: string | null
          error_type: string
          id: string
          message: string
          resolved_at: string | null
          status: string
          target_file: string | null
        }
        Insert: {
          agent_role: string
          created_at?: string | null
          error_type: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          target_file?: string | null
        }
        Update: {
          agent_role?: string
          created_at?: string | null
          error_type?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          target_file?: string | null
        }
        Relationships: []
      }
      pending_sync_jobs: {
        Row: {
          action_type: string
          chain_id: number | null
          contract_address: string | null
          created_at: string
          error_message: string | null
          id: number
          last_attempted_at: string | null
          payload: Json | null
          resolved_at: string | null
          retry_count: number
          status: string
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          action_type: string
          chain_id?: number | null
          contract_address?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          last_attempted_at?: string | null
          payload?: Json | null
          resolved_at?: string | null
          retry_count?: number
          status?: string
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          action_type?: string
          chain_id?: number | null
          contract_address?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          last_attempted_at?: string | null
          payload?: Json | null
          resolved_at?: string | null
          retry_count?: number
          status?: string
          tx_hash?: string | null
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
          is_hidden?: boolean | null
          platform?: string | null
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
      raffle_sync_state: {
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
      raffle_tickets: {
        Row: {
          created_at: string | null
          id: string
          raffle_id: number
          ticket_count: number
          tx_hash: string
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          raffle_id: number
          ticket_count?: number
          tx_hash: string
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          raffle_id?: number
          ticket_count?: number
          tx_hash?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_tickets_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      raffles: {
        Row: {
          cancellation_tx: string | null
          category: string | null
          created_at: string | null
          finalized_at: string | null
          creator_address: string
          description: string | null
          end_time: string | null
          external_link: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          is_finalized: boolean | null
          claim_deadline_at: string | null
          max_tickets: number | null
          metadata_uri: string | null
          min_sbt_level: number | null
          nft_contract: string | null
          prize_per_winner: number | null
          prize_pool: number | null
          rejection_reason: string | null
          sponsor_address: string | null
          title: string | null
          token_id: number | null
          twitter_link: string | null
          updated_at: string | null
          winner_count: number | null
        }
        Insert: {
          cancellation_tx?: string | null
          category?: string | null
          created_at?: string | null
          finalized_at?: string | null
          creator_address: string
          description?: string | null
          end_time?: string | null
          external_link?: string | null
          id: number
          image_url?: string | null
          is_active?: boolean | null
          is_finalized?: boolean | null
          claim_deadline_at?: string | null
          max_tickets?: number | null
          metadata_uri?: string | null
          min_sbt_level?: number | null
          nft_contract?: string | null
          prize_per_winner?: number | null
          prize_pool?: number | null
          rejection_reason?: string | null
          sponsor_address?: string | null
          title?: string | null
          token_id?: number | null
          twitter_link?: string | null
          updated_at?: string | null
          winner_count?: number | null
        }
        Update: {
          cancellation_tx?: string | null
          category?: string | null
          created_at?: string | null
          finalized_at?: string | null
          creator_address?: string
          description?: string | null
          end_time?: string | null
          external_link?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          is_finalized?: boolean | null
          claim_deadline_at?: string | null
          max_tickets?: number | null
          metadata_uri?: string | null
          min_sbt_level?: number | null
          nft_contract?: string | null
          prize_per_winner?: number | null
          prize_pool?: number | null
          rejection_reason?: string | null
          sponsor_address?: string | null
          title?: string | null
          token_id?: number | null
          twitter_link?: string | null
          updated_at?: string | null
          winner_count?: number | null
        }
        Relationships: []
      }
      sbt_pool_stats: {
        Row: {
          acc_bronze: string | null
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
          share_common: number | null
          share_epic: number | null
          share_legendary: number | null
          share_participation: number | null
          share_rare: number | null
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
          share_common?: number | null
          share_epic?: number | null
          share_legendary?: number | null
          share_participation?: number | null
          share_rare?: number | null
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
          share_common?: number | null
          share_epic?: number | null
          share_legendary?: number | null
          share_participation?: number | null
          share_rare?: number | null
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
          reward_weight: number | null
          tier_name: string | null
        }
        Insert: {
          badge_url?: string | null
          created_at?: string | null
          id?: string | null
          level: number
          level_name?: string | null
          min_xp: number
          reward_weight?: number | null
          tier_name?: string | null
        }
        Update: {
          badge_url?: string | null
          created_at?: string | null
          id?: string | null
          level?: number
          level_name?: string | null
          min_xp?: number
          reward_weight?: number | null
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
      system_error_logs: {
        Row: {
          action: string | null
          bundle: string | null
          created_at: string
          error_code: string | null
          id: number
          message_sanitized: string
          metadata: Json | null
          request_id: string | null
          severity: string
          surface: string
          tx_hash: string | null
          wallet_address: string | null
        }
        Insert: {
          action?: string | null
          bundle?: string | null
          created_at?: string
          error_code?: string | null
          id?: number
          message_sanitized: string
          metadata?: Json | null
          request_id?: string | null
          severity?: string
          surface: string
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Update: {
          action?: string | null
          bundle?: string | null
          created_at?: string
          error_code?: string | null
          id?: number
          message_sanitized?: string
          metadata?: Json | null
          request_id?: string | null
          severity?: string
          surface?: string
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      system_health: {
        Row: {
          id: number
          last_error: string | null
          last_heartbeat: string | null
          metadata: Json | null
          service_key: string
          status: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          last_error?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          service_key: string
          status: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          last_error?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          service_key?: string
          status?: string
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
      telegram_chat_history: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          role?: string
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
          tx_hash?: string | null
          value_amount?: number | null
          value_symbol?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_activity_logs_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_activity_logs_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "v_user_full_profile"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      user_claims: {
        Row: {
          campaign_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          is_claimed: boolean | null
          is_verified: boolean | null
          payout_amount: number | null
          payout_authorization_nonce: string | null
          payout_deadline_at: string | null
          payout_status: string | null
          payout_tx_hash: string | null
          platform_identity: string | null
          user_address: string
          verified_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          is_claimed?: boolean | null
          is_verified?: boolean | null
          payout_amount?: number | null
          payout_authorization_nonce?: string | null
          payout_deadline_at?: string | null
          payout_status?: string | null
          payout_tx_hash?: string | null
          platform_identity?: string | null
          user_address: string
          verified_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          is_claimed?: boolean | null
          is_verified?: boolean | null
          payout_amount?: number | null
          payout_authorization_nonce?: string | null
          payout_deadline_at?: string | null
          payout_status?: string | null
          payout_tx_hash?: string | null
          platform_identity?: string | null
          user_address?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_point_logs: {
        Row: {
          activity_key: string
          created_at: string | null
          fid: number | null
          id: string
          metadata: Json | null
          points_earned: number
          user_address: string
        }
        Insert: {
          activity_key: string
          created_at?: string | null
          fid?: number | null
          id?: string
          metadata?: Json | null
          points_earned: number
          user_address: string
        }
        Update: {
          activity_key?: string
          created_at?: string | null
          fid?: number | null
          id?: string
          metadata?: Json | null
          points_earned?: number
          user_address?: string
        }
        Relationships: []
      }
      user_privileges: {
        Row: {
          feature_id: string
          granted_at: string | null
          wallet_address: string
        }
        Insert: {
          feature_id: string
          granted_at?: string | null
          wallet_address: string
        }
        Update: {
          feature_id?: string
          granted_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_status: string | null
          base_username: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          fid: number | null
          follower_count: number | null
          following_count: number | null
          google_email: string | null
          google_id: string | null
          instagram_id: string | null
          instagram_username: string | null
          is_admin: boolean | null
          is_base_social_verified: boolean | null
          is_operator: boolean | null
          is_verifier: boolean
          last_daily_bonus_claim: string | null
          last_login_at: string | null
          last_onchain_xp: number | null
          last_seen_at: string | null
          last_streak_claim: string | null
          manual_xp_bonus: number | null
          neynar_score: number | null
          oauth_provider: string | null
          pfp_url: string | null
          power_badge: boolean | null
          raffle_tickets_bought: number | null
          raffle_wins: number
          raffles_created: number | null
          referral_bonus_paid: boolean | null
          referred_by: string | null
          streak_count: number | null
          telegram_id: string | null
          telegram_username: string | null
          tier: number | null
          tier_override: number | null
          tiktok_id: string | null
          tiktok_username: string | null
          total_xp: number | null
          trust_score: number | null
          twitter_id: string | null
          twitter_username: string | null
          updated_at: string | null
          username: string | null
          verifications: string[] | null
          wallet_address: string
        }
        Insert: {
          active_status?: string | null
          base_username?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          fid?: number | null
          follower_count?: number | null
          following_count?: number | null
          google_email?: string | null
          google_id?: string | null
          instagram_id?: string | null
          instagram_username?: string | null
          is_admin?: boolean | null
          is_base_social_verified?: boolean | null
          is_operator?: boolean | null
          is_verifier?: boolean
          last_daily_bonus_claim?: string | null
          last_login_at?: string | null
          last_onchain_xp?: number | null
          last_seen_at?: string | null
          last_streak_claim?: string | null
          manual_xp_bonus?: number | null
          neynar_score?: number | null
          oauth_provider?: string | null
          pfp_url?: string | null
          power_badge?: boolean | null
          raffle_tickets_bought?: number | null
          raffle_wins?: number
          raffles_created?: number | null
          referral_bonus_paid?: boolean | null
          referred_by?: string | null
          streak_count?: number | null
          telegram_id?: string | null
          telegram_username?: string | null
          tier?: number | null
          tier_override?: number | null
          tiktok_id?: string | null
          tiktok_username?: string | null
          total_xp?: number | null
          trust_score?: number | null
          twitter_id?: string | null
          twitter_username?: string | null
          updated_at?: string | null
          username?: string | null
          verifications?: string[] | null
          wallet_address: string
        }
        Update: {
          active_status?: string | null
          base_username?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          fid?: number | null
          follower_count?: number | null
          following_count?: number | null
          google_email?: string | null
          google_id?: string | null
          instagram_id?: string | null
          instagram_username?: string | null
          is_admin?: boolean | null
          is_base_social_verified?: boolean | null
          is_operator?: boolean | null
          is_verifier?: boolean
          last_daily_bonus_claim?: string | null
          last_login_at?: string | null
          last_onchain_xp?: number | null
          last_seen_at?: string | null
          last_streak_claim?: string | null
          manual_xp_bonus?: number | null
          neynar_score?: number | null
          oauth_provider?: string | null
          pfp_url?: string | null
          power_badge?: boolean | null
          raffle_tickets_bought?: number | null
          raffle_wins?: number
          raffles_created?: number | null
          referral_bonus_paid?: boolean | null
          referred_by?: string | null
          streak_count?: number | null
          telegram_id?: string | null
          telegram_username?: string | null
          tier?: number | null
          tier_override?: number | null
          tiktok_id?: string | null
          tiktok_username?: string | null
          total_xp?: number | null
          trust_score?: number | null
          twitter_id?: string | null
          twitter_username?: string | null
          updated_at?: string | null
          username?: string | null
          verifications?: string[] | null
          wallet_address?: string
        }
        Relationships: []
      }
      user_task_claims: {
        Row: {
          action_type: string | null
          claimed_at: string | null
          id: string
          platform: string | null
          target_id: string | null
          task_id: string
          wallet_address: string
          xp_earned: number
        }
        Insert: {
          action_type?: string | null
          claimed_at?: string | null
          id?: string
          platform?: string | null
          target_id?: string | null
          task_id: string
          wallet_address: string
          xp_earned: number
        }
        Update: {
          action_type?: string | null
          claimed_at?: string | null
          id?: string
          platform?: string | null
          target_id?: string | null
          task_id?: string
          wallet_address?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "v_user_full_profile"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
    }
    Views: {
      user_stats: {
        Row: {
          badge_url: string | null
          display_name: string | null
          fid: number | null
          global_rank: number | null
          is_admin: boolean | null
          is_operator: boolean | null
          last_daily_bonus_claim: string | null
          pfp_url: string | null
          rank_name: string | null
          referred_by: string | null
          streak_count: number | null
          tier: number | null
          total_xp: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string | null
        }
        Relationships: []
      }
      v_user_daily_progress: {
        Row: {
          bonus_claimed: boolean | null
          completed_count: number | null
          wallet_address: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "user_task_claims_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: false
            referencedRelation: "v_user_full_profile"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      v_user_full_profile: {
        Row: {
          badge_url: string | null
          display_name: string | null
          fid: number | null
          global_rank: number | null
          is_admin: boolean | null
          is_operator: boolean | null
          last_daily_bonus_claim: string | null
          pfp_url: string | null
          rank_name: string | null
          referred_by: string | null
          reward_weight: number | null
          streak_count: number | null
          tier: number | null
          total_xp: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_archive_and_reset_season: {
        Args: { p_new_season_id: number; p_old_season_id: number }
        Returns: undefined
      }
      fn_compute_leaderboard_tiers: {
        Args: never
        Returns: {
          computed_tier: number
          wallet_address: string
        }[]
      }
      fn_deactivate_expired_tasks: { Args: never; Returns: undefined }
      fn_decrement_campaign_reward_pool_atomic: {
        Args: { p_campaign_id: string; p_reward_amount: number }
        Returns: Json
      }
      fn_get_leaderboard: {
        Args: { p_limit?: number; p_tier?: string }
        Returns: {
          display_name: string
          pfp_url: string
          raffle_wins: number
          raffles_created: number
          rank_name: string
          total_xp: number
          wallet_address: string
        }[]
      }
      fn_get_tier_distribution: {
        Args: never
        Returns: {
          tier_label: string
          user_count: number
        }[]
      }
      fn_increment_campaign_participants: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      fn_increment_raffle_tickets: {
        Args: { p_amount?: number; p_wallet: string }
        Returns: undefined
      }
      fn_increment_raffle_wins: {
        Args: { p_wallet: string }
        Returns: undefined
      }
      fn_increment_raffles_created: {
        Args: { p_wallet: string }
        Returns: undefined
      }
      fn_increment_user_xp: {
        Args: { p_wallet: string; p_xp: number }
        Returns: undefined
      }
      fn_increment_xp:
        | { Args: { p_amount: number; p_wallet: string }; Returns: undefined }
        | {
            Args: {
              p_amount: number
              p_is_dividend?: boolean
              p_wallet: string
            }
            Returns: undefined
          }
      fn_refresh_rank_scores: { Args: never; Returns: undefined }
      fn_refresh_sbt_pool_stats: { Args: never; Returns: undefined }
      get_auth_wallet: { Args: never; Returns: string }
      is_admin_wallet: { Args: { wallet: string }; Returns: boolean }
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
