export interface PriceHistory {
  id: number;
  contract_address: string;
  price_usd: number;
  volume_24h?: number;
  price_change_1h?: number;
  price_change_6h?: number;
  price_change_24h?: number;
  price_change_5m?: number;
  timestamp: Date;
  source: string;
}

export interface MarketCapHistory {
  id: number;
  contract_address: string;
  market_cap_usd: number;
  circulating_supply?: number;
  total_supply?: number;
  market_cap_change_24h?: number;
  market_cap_change_7d?: number;
  timestamp: Date;
  source: string;
}

// For the latest price view
export interface LatestPrice {
  contract_address: string;
  price_usd: number;
  volume_24h?: number;
  price_change_1h?: number;
  price_change_6h?: number;
  price_change_24h?: number;
  price_change_5m?: number;
  timestamp: Date;
}

// For the latest market cap view
export interface LatestMarketCap {
  contract_address: string;
  market_cap_usd: number;
  circulating_supply?: number;
  total_supply?: number;
  market_cap_change_24h?: number;
  market_cap_change_7d?: number;
  timestamp: Date;
}

// Enum for data sources
export enum PriceDataSource {
  DEXSCREENER = 'dexscreener',
  COINGECKO = 'coingecko',
  DEXTOOLS = 'dextools',
  CALCULATED = 'calculated' // For when we calculate it ourselves
} 