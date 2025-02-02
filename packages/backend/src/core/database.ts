import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Campaign } from '../types/database';
import { FirecrawlExtraction } from '../types/firecrawl';

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

  async createCampaign(campaign: Partial<Campaign>, client: SupabaseClient = this.client): Promise<Campaign> {
    const { data, error } = await client
      .from('campaigns')
      .upsert([campaign], { 
        onConflict: 'contract_address',
        ignoreDuplicates: false 
      })
      .select()
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
          contract_address: extraction.contract_address,
          data: extraction.json
        });
      } catch (error) {
        results.push({
          success: false,
          contract_address: extraction.contract_address,
          error: (error as Error).message
        });
      }
    }
    return results;
  }
} 