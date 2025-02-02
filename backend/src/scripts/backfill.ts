import { config } from '../core/config';
import { FirecrawlClient } from '../clients/firecrawl';
import { createClient } from '@supabase/supabase-js';

async function main() {
  try {
    console.log('Starting GoFundMeme campaign backfill...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // 1. Get all campaign URLs
    console.log('\nFetching campaign URLs...');
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} total campaign URLs`);
    
    // 2. Get existing contract addresses from database
    const { data: existingCampaigns, error: dbError } = await supabase
      .from('meme_coins')
      .select('contract_address');
    
    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    console.log(`Found ${existingAddresses.size} existing campaigns in database`);

    // 3. Process campaigns one at a time
    const results = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0,
      distributions_added: 0
    };

    for (let i = 0; i < campaignUrls.length; i++) {
      const url = campaignUrls[i];
      console.log(`\nProcessing URL ${i + 1} of ${campaignUrls.length}: ${url}`);
      
      try {
        // Extract campaign ID from URL first to check if it exists
        const urlMatch = url.match(/campaigns\/([^\/]+)/);
        if (!urlMatch) {
          console.log('✗ Skipped - No campaign ID in URL');
          results.skipped++;
          continue;
        }

        const contractAddress = urlMatch[1];
        
        if (existingAddresses.has(contractAddress)) {
          console.log(`✓ Skipped - Already exists: ${contractAddress}`);
          results.skipped++;
          continue;
        }

        // Only extract if we don't have the token
        const extraction = await firecrawl.extractFromUrl(url);
        results.processed++;
        
        if (!extraction.contract_address) {
          console.log('✗ Skipped - No contract address');
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
          console.error(`✗ Failed to insert ${extraction.contract_address}:`, insertError);
          results.errors++;
          continue;
        }

        // Then insert token distributions if any
        if (extraction.token_distribution && extraction.token_distribution.length > 0) {
          console.log(`Processing ${extraction.token_distribution.length} distributions for ${extraction.contract_address}`);
          
          // Insert each distribution as a separate row
          for (const dist of extraction.token_distribution) {
            console.log(`Inserting distribution: ${dist.entity} - ${dist.percentage}%`);
            
            const distribution = {
              contract_address: extraction.contract_address,
              entity: dist.entity,
              percentage: dist.percentage
            };
            console.log('Distribution data:', distribution);

            const { error: distError } = await supabase
              .from('token_distributions')
              .insert(distribution);

            if (distError) {
              console.error(`✗ Failed to insert distribution for ${extraction.contract_address} (${dist.entity}):`, {
                error: distError,
                code: distError.code,
                message: distError.message,
                details: distError.details,
                hint: distError.hint
              });
            } else {
              results.distributions_added++;
              console.log(`✓ Added distribution: ${dist.entity} - ${dist.percentage}%`);
            }
          }
        }

        console.log(`✓ Added: ${extraction.contract_address} (${extraction.title})`);
        results.added++;
        existingAddresses.add(extraction.contract_address);
        
      } catch (error) {
        console.error(`✗ Failed to process ${url}:`, error);
        results.errors++;
      }

      // Add a delay between requests to avoid rate limiting
      if (i < campaignUrls.length - 1) {
        const delay = 3000; // 3 seconds
        console.log(`Waiting ${delay}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Print summary
    console.log('\n=== Backfill Summary ===');
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

main(); 