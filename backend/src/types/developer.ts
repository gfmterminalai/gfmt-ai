export interface Developer {
  id?: string;
  address: string;
  created_at: Date;
  reputation_score?: number;
  total_coins?: number;
  total_market_cap?: number;
  metadata?: {
    coins?: string[];  // Array of contract addresses
    raw_data?: any;
  };
} 