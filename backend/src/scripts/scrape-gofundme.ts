import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';
import { FirecrawlExtraction } from '../types/firecrawl';
import { config } from '../config';

async function main() {
  try {
    console.log('Starting GoFundMe scraper...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // Get all campaign URLs
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} campaign URLs`);
    
    // Process each URL
    for (let i = 0; i < campaignUrls.length; i++) {
      const url = campaignUrls[i];
      console.log(`\nProcessing URL ${i + 1} of ${campaignUrls.length}: ${url}`);
      
      try {
        const extraction = await firecrawl.extractFromUrl(url);
        if (extraction && extraction.json.contract_address) {
          // Log extracted data
          console.log('\nExtracted data:');
          console.log('Contract:', extraction.json.contract_address);
          console.log('Title:', extraction.json.title);
          
          // Store in database
          const { error } = await supabase
            .from('meme_coins')
            .upsert({
              contract_address: extraction.json.contract_address,
              developer_address: extraction.json.developer_address,
              ticker: extraction.json.ticker,
              supply: extraction.json.supply,
              market_cap_on_launch: extraction.json.market_cap_on_launch,
              created_at: new Date(extraction.json.created_at)
            });
          
          if (error) {
            console.error('Failed to store data:', error);
          } else {
            console.log('Successfully stored data');
          }
        }
      } catch (error) {
        console.error('Failed to process URL:', error);
      }
      
      // Add delay between requests
      if (i < campaignUrls.length - 1) {
        console.log('\nWaiting before next request...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main(); 