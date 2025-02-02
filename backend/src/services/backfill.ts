import { FirecrawlClient } from '../clients/firecrawl';
import { DatabaseAdapter } from '../core/database';
import { Campaign } from '../types/database';

export class BackfillService {
  constructor(
    private readonly firecrawl: FirecrawlClient,
    private readonly db: DatabaseAdapter
  ) {}

  async backfillAllCampaigns(options: { batchSize?: number; dryRun?: boolean } = {}) {
    const { batchSize = 10, dryRun = false } = options;
    
    try {
      console.log(`Starting campaign backfill... (${dryRun ? 'DRY RUN' : 'LIVE MODE'})`);
      
      // Get all campaign URLs
      const urls = await this.firecrawl.mapWebsite();
      console.log(`Found ${urls.length} campaign URLs`);

      // Process in batches to avoid rate limits
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${i / batchSize + 1}/${Math.ceil(urls.length / batchSize)}`);

        try {
          // Extract data for batch
          const extractedData = await this.firecrawl.extractBatch(batch);

          // Process each campaign
          for (const data of extractedData) {
            try {
              // Create campaign record
              const campaign: Partial<Campaign> = {
                contract_address: data.json.contract_address,
                gofundmeme_url: data.metadata.sourceURL,
                ticker: data.json.ticker,
                created_at: new Date(data.json.created_at),
                status: 'active',
                metadata: {
                  title: data.json.title,
                  description: data.json.description,
                  social_links: data.json.social_links
                }
              };

              if (dryRun) {
                console.log('\n=== DRY RUN - Extracted Data ===');
                console.log('URL:', data.metadata.sourceURL);
                console.log('Contract:', data.json.contract_address);
                console.log('Ticker:', data.json.ticker);
                console.log('Supply:', data.json.supply);
                console.log('Developer:', data.json.developer_address);
                console.log('Market Cap on Launch:', data.json.market_cap_on_launch);
                console.log('Token Distribution:');
                data.json.token_distribution.forEach(({ entity, percentage }) => {
                  console.log(`  - ${entity}: ${percentage}%`);
                });
                console.log('Created At:', data.json.created_at);
                console.log('Title:', data.json.title);
                console.log('Social Links:', data.json.social_links.join(', '));
                console.log('=== END EXTRACTED DATA ===\n');
              } else {
                // Save campaign and related data
                await this.db.transaction(async (trx) => {
                  await this.db.createCampaign(campaign, trx);
                  await this.db.processFirecrawlData(data, trx);
                });
                console.log(`Successfully processed campaign: ${campaign.contract_address}`);
              }
            } catch (error) {
              console.error(`Failed to process campaign: ${data.metadata.sourceURL}`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to process batch starting at index ${i}`, error);
        }

        // Rate limit compliance - wait between batches
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`\nCampaign backfill completed (${dryRun ? 'DRY RUN' : 'LIVE MODE'})`);
    } catch (error) {
      console.error('Backfill failed:', error);
      throw error;
    }
  }
} 