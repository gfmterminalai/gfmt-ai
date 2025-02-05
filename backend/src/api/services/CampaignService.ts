import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { FirecrawlClient, FirecrawlExtraction } from '../../clients/firecrawl';
import { CampaignFilters, BatchResult, ReconciliationResult } from '../types/campaign';
import { config } from '../../core/config';

export class CampaignService {
  private firecrawl: FirecrawlClient;
  private supabase: SupabaseClient;
  private readonly BATCH_SIZE = 5;
  private readonly BATCH_DELAY = 2000; // 2 seconds

  constructor() {
    this.firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    this.supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
  }

  async mapCampaignUrls(): Promise<string[]> {
    return await this.firecrawl.mapWebsite();
  }

  async extractCampaignData(url: string): Promise<FirecrawlExtraction> {
    const extractions = await this.firecrawl.extractCampaigns([url]);
    if (!extractions || extractions.length === 0) {
      throw new Error(`Failed to extract data for campaign: ${url}`);
    }
    return extractions[0];
  }

  async extractCampaignsBatch(urls: string[], batchSize: number = this.BATCH_SIZE): Promise<FirecrawlExtraction[]> {
    const extractions = await this.firecrawl.extractCampaigns(urls);
    return extractions;
  }

  async getCampaign(contractAddress: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('meme_coins')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error) throw error;
    return data;
  }

  async getCampaigns(filters?: CampaignFilters): Promise<any[]> {
    let query = this.supabase.from('meme_coins').select('*');

    if (filters) {
      if (filters.developerAddress) {
        query = query.eq('developer_address', filters.developerAddress);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.minMarketCap) {
        query = query.gte('market_cap_on_launch', filters.minMarketCap);
      }
      if (filters.maxMarketCap) {
        query = query.lte('market_cap_on_launch', filters.maxMarketCap);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async saveCampaign(campaign: FirecrawlExtraction): Promise<any> {
    const { error } = await this.supabase
      .from('meme_coins')
      .insert({
        contract_address: campaign.contract_address,
        developer_address: campaign.developer_address,
        ticker: campaign.ticker,
        supply: campaign.supply,
        market_cap_on_launch: campaign.market_cap_on_launch,
        created_at: campaign.created_at,
        avatar_url: campaign.avatar_url
      });

    if (error) throw error;
    return this.getCampaign(campaign.contract_address);
  }

  async saveCampaignsBatch(campaigns: FirecrawlExtraction[]): Promise<BatchResult> {
    const results: BatchResult = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0,
      errorDetails: []
    };

    for (const campaign of campaigns) {
      try {
        if (!campaign.contract_address) {
          results.skipped++;
          continue;
        }

        await this.saveCampaign(campaign);
        results.added++;
      } catch (error) {
        results.errors++;
        results.errorDetails?.push({
          contractAddress: campaign.contract_address || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      results.processed++;
    }

    return results;
  }

  async findMissingCampaigns(): Promise<string[]> {
    // Get all campaign URLs from website
    const campaignUrls = await this.mapCampaignUrls();
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        return match ? match[1] : null;
      })
      .filter((address): address is string => address !== null);
    
    // Get existing campaigns from database
    const { data: existingCampaigns } = await this.supabase
      .from('meme_coins')
      .select('contract_address');

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address) || []);
    
    // Find missing campaigns
    return websiteAddresses.filter(address => !existingAddresses.has(address));
  }

  async reconcileCampaigns(): Promise<ReconciliationResult> {
    // Get missing campaign addresses
    const missingAddresses = await this.findMissingCampaigns();
    const missingUrls = missingAddresses.map(address => `https://www.gofundmeme.io/campaigns/${address}`);

    // Get total counts
    const websiteTotal = (await this.mapCampaignUrls()).length;
    const { count: databaseTotal } = await this.supabase
      .from('meme_coins')
      .select('*', { count: 'exact', head: true });

    if (missingUrls.length === 0) {
      return {
        websiteTotal,
        databaseTotal: databaseTotal || 0,
        missing: 0,
        batchResults: {
          processed: 0,
          added: 0,
          errors: 0,
          skipped: 0
        }
      };
    }

    // Process missing campaigns in batches
    let batchResults: BatchResult = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0,
      errorDetails: []
    };

    for (let i = 0; i < missingUrls.length; i += this.BATCH_SIZE) {
      const batch = missingUrls.slice(i, i + this.BATCH_SIZE);
      
      try {
        const extractions = await this.extractCampaignsBatch(batch);
        const batchResult = await this.saveCampaignsBatch(extractions);
        
        // Merge batch results
        batchResults = {
          processed: batchResults.processed + batchResult.processed,
          added: batchResults.added + batchResult.added,
          errors: batchResults.errors + batchResult.errors,
          skipped: batchResults.skipped + batchResult.skipped,
          errorDetails: [...(batchResults.errorDetails || []), ...(batchResult.errorDetails || [])]
        };

        // Add delay between batches
        if (i + this.BATCH_SIZE < missingUrls.length) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        batchResults.errors += batch.length;
        batchResults.processed += batch.length;
        batch.forEach(url => {
          batchResults.errorDetails?.push({
            contractAddress: url.split('/').pop() || 'unknown',
            error: errorMessage
          });
        });
      }
    }

    return {
      websiteTotal,
      databaseTotal: databaseTotal || 0,
      missing: missingUrls.length,
      batchResults
    };
  }
} 