import { config } from '../core/config';
import { FirecrawlClient } from '../clients/firecrawl';
import { createClient } from '@supabase/supabase-js';

async function main() {
  try {
    console.log('Starting campaign reconciliation...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // Get all campaign URLs from website
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} campaign URLs on website`);
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        return match ? match[1] : null;
      })
      .filter((address): address is string => address !== null)
      .sort();
    
    console.log('\nWebsite Campaigns:', websiteAddresses);
    
    // Get existing campaigns from database
    const { data: existingCampaigns, error: dbError } = await supabase
      .from('meme_coins')
      .select('contract_address');
    
    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    console.log('\nDatabase Campaigns:', Array.from(existingAddresses).sort());
    console.log(`\nFound ${existingAddresses.size} existing campaigns in database`);
    
    // Find missing campaigns
    const missingAddresses = websiteAddresses.filter(address => !existingAddresses.has(address));
    const missingUrls = missingAddresses.map(address => `https://www.gofundmeme.io/campaigns/${address}`);
    
    console.log('\nMissing campaigns:', missingUrls.length ? missingUrls : 'None');
    
    if (missingUrls.length === 0) {
      console.log('No missing campaigns to process');
      return;
    }
    
    // Process missing campaigns in batches of 5
    const results = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0
    };
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < missingUrls.length; i += BATCH_SIZE) {
      const batch = missingUrls.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(missingUrls.length/BATCH_SIZE)}`);
      console.log('URLs in this batch:', batch);
      
      try {
        const extractions = await firecrawl.extractCampaigns(batch);
        console.log('\nExtractions:', JSON.stringify(extractions, null, 2));
        
        // Process each extraction
        for (const extraction of extractions) {
          if (!extraction.contract_address) {
            console.log(`Skipping extraction - no contract address`);
            results.skipped++;
            continue;
          }
          
          // Insert into database
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
            console.error(`Failed to insert campaign ${extraction.contract_address}:`, insertError);
            results.errors++;
          } else {
            console.log(`Successfully added campaign: ${extraction.contract_address}`);
            results.added++;
          }
        }
        
        results.processed += batch.length;
        
        // Add delay between batches
        if (i + BATCH_SIZE < missingUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to process batch:`, error);
        results.errors += batch.length;
        results.processed += batch.length;
      }
    }
    
    console.log('\nReconciliation completed');
    console.log('Results:', {
      website_total: websiteAddresses.length,
      database_total: existingAddresses.size,
      missing: missingUrls.length,
      results
    });
    
  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main(); 