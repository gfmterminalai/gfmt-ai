import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';
import { FirecrawlExtraction } from '../types/firecrawl';
import { EmailService } from './EmailService';

export interface SyncResults {
  processed: number;
  added: number;
  errors: number;
  skipped: number;
  distributions_added: number;
  distributions_updated: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  error_details: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
  total: number;
}

export class SyncService {
  private firecrawl: FirecrawlClient;
  private supabase: SupabaseClient;
  private emailService: EmailService;
  private hoursSinceLastSync: number | undefined;

  constructor() {
    this.firecrawl = new FirecrawlClient(process.env.FIRECRAWL_API_KEY!);
    this.supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    this.emailService = new EmailService();
  }

  private logError(results: SyncResults, type: string, message: string) {
    results.errors++;
    results.error_details.push({
      type,
      message,
      timestamp: new Date().toISOString()
    });
    console.error(`[${type}] ${message}`);
  }

  private async recordSyncHistory(results: SyncResults, status: 'success' | 'failure' | 'partial_success') {
    try {
      const { error } = await this.supabase
        .from('sync_history')
        .insert({
          start_time: results.start_time,
          end_time: results.end_time,
          duration_ms: results.duration_ms,
          status,
          campaigns_processed: results.processed,
          campaigns_added: results.added,
          distributions_added: results.distributions_added,
          distributions_updated: results.distributions_updated,
          errors: results.errors,
          skipped: results.skipped,
          error_details: results.error_details
        });

      if (error) {
        console.error('Failed to record sync history:', error);
      }
    } catch (error) {
      console.error('Error recording sync history:', error);
    }
  }

  private async checkLastSync(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_missed_syncs') as { 
          data: Array<{ hours_since_last_sync: number }> | null, 
          error: any 
        };

      if (error) {
        console.error('Failed to check last sync:', error);
        return;
      }

      if (data?.[0]?.hours_since_last_sync !== undefined) {
        this.hoursSinceLastSync = data[0].hours_since_last_sync;
        if (this.hoursSinceLastSync > 1.5) {
          console.error(`WARNING: Last sync was ${this.hoursSinceLastSync.toFixed(1)} hours ago`);
        }
      }
    } catch (error) {
      console.error('Error checking last sync:', error);
    }
  }

  async syncBatch(batchSize: number, offset: number = 0): Promise<SyncResults> {
    const startTime = new Date();
    const results: SyncResults = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0,
      distributions_added: 0,
      distributions_updated: 0,
      start_time: startTime.toISOString(),
      end_time: '',
      duration_ms: 0,
      error_details: [],
      total: 0
    };

    try {
      await this.checkLastSync();

      console.log(`Starting batch sync process (size: ${batchSize}, offset: ${offset})...`);

      // 1. Get all campaign URLs
      const campaignUrls = await this.firecrawl.mapWebsite();
      results.total = campaignUrls.length;
      
      // Extract contract addresses from URLs
      const websiteAddresses = campaignUrls
        .map(url => {
          const match = url.match(/campaigns\/([^\/]+)/);
          return match ? match[1] : null;
        })
        .filter((address): address is string => address !== null)
        .sort();
      
      // 2. Get existing campaigns from database
      const { data: existingCampaigns, error: dbError } = await this.supabase
        .from('meme_coins')
        .select('contract_address');
      
      if (dbError) {
        this.logError(results, 'DATABASE_ERROR', `Failed to fetch existing campaigns: ${dbError.message}`);
        throw dbError;
      }

      const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
      
      // Get batch of new campaigns
      const newCampaigns = websiteAddresses
        .filter(address => !existingAddresses.has(address))
        .slice(offset, offset + batchSize)
        .map(address => `https://www.gofundmeme.io/campaigns/${address}`);

      // Process batch
      if (newCampaigns.length > 0) {
        const newExtractions = await this.firecrawl.extractCampaigns(newCampaigns);
        
        // Insert new campaigns
        for (const extraction of newExtractions) {
          try {
            if (!extraction.json.contract_address) {
              results.skipped++;
              continue;
            }

            // Insert new meme coin
            const { error: insertError } = await this.supabase
              .from('meme_coins')
              .insert({
                contract_address: extraction.json.contract_address,
                developer_address: extraction.json.developer_address,
                ticker: extraction.json.ticker,
                supply: extraction.json.supply,
                market_cap_on_launch: extraction.json.market_cap_on_launch,
                created_at: extraction.json.created_at
              });

            if (insertError) {
              this.logError(results, 'INSERT_ERROR', `Failed to insert campaign ${extraction.json.contract_address}: ${insertError.message}`);
              continue;
            }

            results.added++;

            // Insert token distributions
            const combinedDistributions = new Map<string, number>();
            extraction.json.token_distribution?.forEach(dist => {
              if (dist.entity && dist.percentage) {
                const currentTotal = combinedDistributions.get(dist.entity) || 0;
                combinedDistributions.set(dist.entity, currentTotal + dist.percentage);
              }
            });

            for (const [entity, percentage] of combinedDistributions.entries()) {
              const { error: distError } = await this.supabase
                .from('token_distributions')
                .insert({
                  contract_address: extraction.json.contract_address,
                  entity,
                  percentage
                });

              if (distError) {
                this.logError(results, 'DISTRIBUTION_ERROR', `Failed to insert distribution for ${extraction.json.contract_address} (${entity}): ${distError.message}`);
              } else {
                results.distributions_added++;
              }
            }

            results.processed++;
            
          } catch (error) {
            this.logError(results, 'PROCESSING_ERROR', `Failed to process extraction: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      const endTime = new Date();
      results.end_time = endTime.toISOString();
      results.duration_ms = endTime.getTime() - startTime.getTime();

      // Determine sync status
      const status = results.errors === 0 ? 'success' :
        results.processed > 0 ? 'partial_success' : 'failure';
      
      await this.recordSyncHistory(results, status);
      
      return results;

    } catch (error) {
      const endTime = new Date();
      results.end_time = endTime.toISOString();
      results.duration_ms = endTime.getTime() - startTime.getTime();
      
      await this.recordSyncHistory(results, 'failure');
      
      this.logError(results, 'FATAL_ERROR', `Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Original sync method now uses syncBatch
  async sync(): Promise<SyncResults> {
    return this.syncBatch(5, 0);
  }
} 