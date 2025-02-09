import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';
import { FirecrawlExtraction } from '../types/firecrawl';
import { config } from '../config';

async function main() {
  try {
    console.log('Starting GoFundMeme backfill...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // 1. Get all campaign URLs
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} total campaign URLs`);
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        return match ? match[1] : null;
      })
      .filter((address): address is string => address !== null);
    
    // Get existing campaigns from database
    const { data: existingCampaigns } = await supabase
      .from('meme_coins')
      .select('contract_address');

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address) || []);
    
    // Find new campaigns
    const newCampaigns = websiteAddresses
      .filter(address => !existingAddresses.has(address))
      .map(address => `https://www.gofundmeme.io/campaigns/${address}`);
    
    console.log(`Found ${newCampaigns.length} new campaigns to process`);

    // Process campaigns in batches
    const BATCH_SIZE = 3;
    let processed = 0;
    let added = 0;
    let errors = 0;

    for (let i = 0; i < newCampaigns.length; i += BATCH_SIZE) {
      const batch = newCampaigns.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(newCampaigns.length/BATCH_SIZE)}`);
      
      try {
        const extractions = await firecrawl.extractCampaigns(batch);
        
        for (const extraction of extractions) {
          try {
            if (!extraction.json.contract_address) {
              console.log('✗ Skipping campaign: Missing contract address');
              continue;
            }

            // Insert meme coin
            const { error: insertError } = await supabase
              .from('meme_coins')
              .insert({
                contract_address: extraction.json.contract_address,
                developer_address: extraction.json.developer_address,
                ticker: extraction.json.ticker,
                supply: extraction.json.supply,
                market_cap_on_launch: extraction.json.market_cap_on_launch,
                created_at: new Date(extraction.json.created_at)
              });

            if (insertError) {
              console.error(`✗ Failed to insert ${extraction.json.contract_address}:`, insertError);
              errors++;
              continue;
            }

            // Insert token distributions
            if (extraction.json.token_distribution && extraction.json.token_distribution.length > 0) {
              console.log(`Processing ${extraction.json.token_distribution.length} distributions for ${extraction.json.contract_address}`);
              
              // Insert each distribution
              for (const dist of extraction.json.token_distribution) {
                const { error: distError } = await supabase
                  .from('token_distributions')
                  .insert({
                    contract_address: extraction.json.contract_address,
                    entity: dist.entity,
                    percentage: dist.percentage
                  });

                if (distError) {
                  console.error(`✗ Failed to insert distribution for ${extraction.json.contract_address} (${dist.entity}):`, {
                    error: distError,
                    distribution: dist
                  });
                  errors++;
                } else {
                  console.log(`✓ Added distribution: ${dist.entity} = ${dist.percentage}%`);
                }
              }
            }

            added++;
            console.log(`✓ Added: ${extraction.json.contract_address} (${extraction.json.title})`);
            
            // Add to existing addresses to prevent duplicates
            existingAddresses.add(extraction.json.contract_address);
            
          } catch (error) {
            console.error('✗ Failed to process extraction:', error);
            errors++;
          }
          
          processed++;
        }

        // Add delay between batches
        if (i + BATCH_SIZE < newCampaigns.length) {
          console.log('\nWaiting between batches...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error('✗ Failed to process batch:', error);
        errors++;
      }
    }

    // Print summary
    console.log('\n=== Backfill Summary ===');
    console.log(`Total campaigns processed: ${processed}`);
    console.log(`New campaigns added: ${added}`);
    console.log(`Errors encountered: ${errors}`);

  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main(); 