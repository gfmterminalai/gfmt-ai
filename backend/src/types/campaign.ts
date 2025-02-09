export interface CampaignFilters {
  developerAddress?: string;
  startDate?: Date;
  endDate?: Date;
  minMarketCap?: number;
  maxMarketCap?: number;
}

export interface BatchResult {
  processed: number;
  added: number;
  errors: number;
  skipped: number;
  errorDetails?: Array<{
    contractAddress: string;
    error: string;
  }>;
}

export interface ReconciliationResult {
  websiteTotal: number;
  databaseTotal: number;
  missing: number;
  batchResults: BatchResult;
}

export interface Campaign {
  id: string;
  contract_address: string;
  gofundmeme_url: string;
  ticker: string;
  created_at: Date;
  status: 'active' | 'inactive';
  metadata: {
    title: string;
    description: string;
    social_links: {
      twitter?: string;
      telegram?: string;
      discord?: string;
    };
  };
} 