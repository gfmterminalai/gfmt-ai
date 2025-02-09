export interface MemeCoin {
  id?: string;
  contract_address: string;
  ticker: string;
  supply: string;
  developer_address: string;
  market_cap_on_launch: number;
  created_at: Date;
  metadata?: {
    token_distribution?: Array<{
      entity: string;
      percentage: number;
    }>;
    raw_data?: any;
  };
} 