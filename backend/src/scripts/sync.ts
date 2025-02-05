import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';
import { config } from '../config';

async function main() {
  try {
    console.log('Starting GoFundMeme hourly sync...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // 1. Get all campaign URLs
    const campaignUrls = await firecrawl.mapWebsite();
    console.log('\nRaw URLs from website:');
    campaignUrls.forEach(url => console.log(url));
    console.log(`\nFound ${campaignUrls.length} total campaign URLs on website`);
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        if (!match) {
          console.log('Failed to extract address from URL:', url);
          return null;
        }
        return match[1];
      })
      .filter((address): address is string => address !== null)
      .sort();

    console.log('\nWebsite Campaigns:', websiteAddresses);
    
    // 2. Get existing contract addresses from database
    const { data: existingCampaigns, error: dbError } = await supabase
      .from('meme_coins')
      .select('contract_address');
    
    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    console.log('\nDatabase Campaigns:', Array.from(existingAddresses).sort());
    console.log(`\nFound ${existingAddresses.size} existing campaigns in database`);
    
    // Find new campaigns
    const newCampaigns = websiteAddresses
      .filter(address => !existingAddresses.has(address))
      .map(address => `https://www.gofundmeme.io/campaigns/${address}`);
    
    console.log('\nNew campaigns to process:', newCampaigns.length ? newCampaigns : 'None');
    
    if (newCampaigns.length === 0) {
      console.log('No new campaigns to process');
      return;
    }

    // Extract data for all new campaigns in one batch
    console.log(`\nExtracting data for ${newCampaigns.length} campaigns...`);
    const extractions = await firecrawl.extractCampaigns(newCampaigns);
    
    // Process the results
    const results = {
      processed: newCampaigns.length,
      added: 0,
      errors: 0,
      skipped: 0,
      distributions_added: 0
    };

    // Insert each extraction into the database
    for (const extraction of extractions) {
      try {
        if (!extraction.contract_address) {
          results.skipped++;
          continue;
        }

        // First insert the meme coin
        const { error: insertError } = await supabase
          .from('meme_coins')
          .insert({
            contract_address: extraction.contract_address,
            developer_address: extraction.developer_address,
            ticker: extraction.ticker,
            supply: extraction.supply,
            market_cap_on_launch: extraction.market_cap_on_launch,
            created_at: extraction.created_at,
            avatar_url: extraction.avatar_url
          });

        if (insertError) {
          console.error(`Failed to insert ${extraction.contract_address}:`, insertError);
          results.errors++;
          continue;
        }

        // Then insert token distributions if any
        if (extraction.token_distribution && extraction.token_distribution.length > 0) {
          for (const dist of extraction.token_distribution) {
            const { error: distError } = await supabase
              .from('token_distributions')
              .insert({
                contract_address: extraction.contract_address,
                entity: dist.entity,
                percentage: dist.percentage
              });

            if (distError) {
              console.error(`Failed to insert distribution for ${extraction.contract_address} (${dist.entity}):`, distError);
            } else {
              results.distributions_added++;
            }
          }
        }

        results.added++;
        existingAddresses.add(extraction.contract_address);
        
      } catch (error) {
        console.error(`Failed to process extraction:`, error);
        results.errors++;
      }
    }

    // Print summary
    console.log('\n=== Sync Summary ===');
    console.log(`Total URLs processed: ${results.processed}`);
    console.log(`New campaigns added: ${results.added}`);
    console.log(`Token distributions added: ${results.distributions_added}`);
    console.log(`Campaigns skipped: ${results.skipped}`);
    console.log(`Errors encountered: ${results.errors}`);

  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main();