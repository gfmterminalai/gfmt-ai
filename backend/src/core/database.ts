import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign } from '../types/campaign';
import { MemeCoin } from '../types/memecoin';
import { Developer } from '../types/developer';
import { FirecrawlExtraction } from '../types/firecrawl';
import { PriceHistory, MarketCapHistory, LatestPrice, LatestMarketCap } from '../types/price';
import * as fs from 'fs';
import * as path from 'path';

// ... existing interfaces ...

export class DatabaseAdapter {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async transaction<T>(callback: (transaction: SupabaseClient) => Promise<T>): Promise<T> {
    // Note: Supabase doesn't support true transactions yet, this is for future compatibility
    return callback(this.client);
  }

  async createCampaign(campaign: Campaign): Promise<Campaign> {
    const { data, error } = await this.client
      .from('campaigns')
      .upsert(campaign)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCampaign(contractAddress: string): Promise<Campaign | null> {
    const { data, error } = await this.client
      .from('campaigns')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error) throw error;
    return data;
  }

  async createMemeCoin(memeCoin: MemeCoin): Promise<MemeCoin> {
    const { data, error } = await this.client
      .from('meme_coins')
      .upsert(memeCoin)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMemeCoin(contractAddress: string): Promise<MemeCoin | null> {
    const { data, error } = await this.client
      .from('meme_coins')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error) throw error;
    return data;
  }

  async createDeveloper(developer: Developer): Promise<Developer> {
    const { data, error } = await this.client
      .from('developers')
      .upsert(developer)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDeveloper(address: string): Promise<Developer | null> {
    const { data, error } = await this.client
      .from('developers')
      .select('*')
      .eq('address', address)
      .single();

    if (error) throw error;
    return data;
  }

  async processFirecrawlData(extraction: FirecrawlExtraction, client: SupabaseClient = this.client): Promise<void> {
    const { json } = extraction;

    // Create or update meme coin record
    const { error: memeError } = await client
      .from('meme_coins')
      .upsert([{
        contract_address: json.contract_address,
        ticker: json.ticker,
        supply: json.supply,
        developer_address: json.developer_address,
        market_cap_on_launch: json.market_cap_on_launch,
        created_at: json.created_at
      }], {
        onConflict: 'contract_address',
        ignoreDuplicates: false
      });

    if (memeError) throw memeError;

    // Store token distribution
    if (json.token_distribution && json.token_distribution.length > 0) {
      const { error: distError } = await client
        .from('token_distributions')
        .upsert(
          json.token_distribution.map(dist => ({
            contract_address: json.contract_address,
            entity: dist.entity,
            percentage: dist.percentage
          })),
          {
            onConflict: 'contract_address,entity',
            ignoreDuplicates: false
          }
        );

      if (distError) throw distError;
    }
  }

  async processFirecrawlBatch(extractions: FirecrawlExtraction[]) {
    const results = [];
    for (const extraction of extractions) {
      try {
        await this.processFirecrawlData(extraction);
        results.push({
          success: true,
          contract_address: extraction.json.contract_address,
          data: extraction.json
        });
      } catch (error) {
        results.push({
          success: false,
          contract_address: extraction.json.contract_address,
          error: (error as Error).message
        });
      }
    }
    return results;
  }

  async initializeSchema(): Promise<void> {
    try {
      const migrationPath = path.join(__dirname, '../migrations/001_init.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      const { error } = await this.client.rpc('init_schema', { sql_script: sql });
      if (error) throw error;
    } catch (error) {
      console.error('Error initializing schema:', error);
      throw error;
    }
  }

  async addPriceHistory(priceHistory: Omit<PriceHistory, 'id'>): Promise<PriceHistory> {
    const { data, error } = await this.client
      .from('price_history')
      .insert(priceHistory)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addMarketCapHistory(marketCapHistory: Omit<MarketCapHistory, 'id'>): Promise<MarketCapHistory> {
    const { data, error } = await this.client
      .from('market_cap_history')
      .insert(marketCapHistory)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getLatestPrice(contractAddress: string): Promise<LatestPrice | null> {
    const { data, error } = await this.client
      .from('latest_prices')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error) throw error;
    return data;
  }

  async getLatestMarketCap(contractAddress: string): Promise<LatestMarketCap | null> {
    const { data, error } = await this.client
      .from('latest_market_caps')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error) throw error;
    return data;
  }

  async getPriceHistory(
    contractAddress: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<PriceHistory[]> {
    let query = this.client
      .from('price_history')
      .select('*')
      .eq('contract_address', contractAddress)
      .order('timestamp', { ascending: false });

    if (startTime) {
      query = query.gte('timestamp', startTime.toISOString());
    }
    if (endTime) {
      query = query.lte('timestamp', endTime.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getMarketCapHistory(
    contractAddress: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<MarketCapHistory[]> {
    let query = this.client
      .from('market_cap_history')
      .select('*')
      .eq('contract_address', contractAddress)
      .order('timestamp', { ascending: false });

    if (startTime) {
      query = query.gte('timestamp', startTime.toISOString());
    }
    if (endTime) {
      query = query.lte('timestamp', endTime.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
} 