export interface TokenDistribution {
  entity: string;
  percentage: number;
}

export interface FirecrawlExtractionJson {
  contract_address: string;
  ticker: string;
  supply: string;
  developer_address: string;
  token_distribution: TokenDistribution[];
  market_cap_on_launch: number;
  created_at: string;
  title: string;
  description: string;
  social_links: string[];
}

export interface FirecrawlMetadata {
  title: string;
  description: string;
  sourceURL: string;
  statusCode: number;
}

export interface FirecrawlExtraction {
  json: FirecrawlExtractionJson;
  metadata: FirecrawlMetadata;
} 