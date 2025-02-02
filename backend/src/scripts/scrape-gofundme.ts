import { config } from '../core/config';
import { FirecrawlClient, FirecrawlExtraction } from '../clients/firecrawl';

interface ExtractionError {
  url: string;
  error: string;
}

async function main() {
  try {
    console.log('Starting GoFundMeme campaign mapping and data extraction...');
    
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    
    // First, map all campaign URLs
    console.log('Mapping campaign URLs...');
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} campaign URLs`);

    // Extract data from each campaign
    console.log('\nExtracting data from campaigns...');
    const results: FirecrawlExtraction[] = [];
    const errors: ExtractionError[] = [];

    for (const url of campaignUrls) {
      try {
        console.log(`\nProcessing: ${url}`);
        const extraction = await firecrawl.extractFromUrl(url);
        
        if (extraction && extraction.contract_address) {
          results.push(extraction);
          console.log('✓ Successfully extracted data');
          console.log('Contract:', extraction.contract_address);
          console.log('Title:', extraction.title);
        } else {
          console.log('✗ Skipped - No contract address found');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`✗ Failed to extract data from ${url}:`, errorMessage);
        errors.push({ url, error: errorMessage });
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Print summary
    console.log('\n=== Extraction Summary ===');
    console.log(`Total URLs processed: ${campaignUrls.length}`);
    console.log(`Successful extractions: ${results.length}`);
    console.log(`Failed extractions: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.forEach(({ url, error }) => {
        console.log(`${url}: ${error}`);
      });
    }

    // Print the extracted data
    console.log('\nExtracted Campaign Data:');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Script failed:', errorMessage);
    process.exit(1);
  }
}

main(); 