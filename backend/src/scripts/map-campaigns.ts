import { config } from '../core/config';
import { FirecrawlClient } from '../clients/firecrawl';

async function main() {
  try {
    console.log('Starting GoFundMeme campaign URL mapping...');
    
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    
    console.log('Fetching campaign URLs...');
    const campaignUrls = await firecrawl.mapWebsite();
    
    console.log('\n=== Mapping Results ===');
    console.log(`Total URLs found: ${campaignUrls.length}`);
    
    console.log('\nCampaign URLs:');
    campaignUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });

  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main(); 