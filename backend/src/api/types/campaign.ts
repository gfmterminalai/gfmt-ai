import { FirecrawlExtraction } from '../../types/firecrawl';

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

export interface CampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMarketCap: number;
  averageMarketCap: number;
  topPerformers: Array<{
    contractAddress: string;
    marketCap: number;
    change24h: number;
  }>;
} 