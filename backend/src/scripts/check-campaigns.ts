import { config } from '../core/config';
import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';

async function main() {
  try {
    console.log('Starting campaign database check...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // 1. Get all campaign URLs
    console.log('\nFetching campaign URLs...');
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} total campaign URLs`);
    
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
    
    // Check each address in the database
    console.log('\nChecking each campaign in database:');
    for (const address of websiteAddresses) {
      const { data, error } = await supabase
        .from('meme_coins')
        .select('contract_address, ticker, created_at')
        .eq('contract_address', address)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ ${address}: Not found in database`);
        } else {
          console.error(`Error checking ${address}:`, error);
        }
      } else {
        console.log(`✅ ${address}: Found in database (ticker: ${data.ticker}, created: ${data.created_at})`);
      }
    }

  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main(); 