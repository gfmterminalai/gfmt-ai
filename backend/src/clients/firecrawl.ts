import FireCrawlApp from '@mendable/firecrawl-js';
import { z } from 'zod';

export interface FirecrawlExtraction {
  avatar_url: string | null;
  contract_address: string | null;
  ticker: string | null;
  supply: number | null;
  developer_address: string | null;
  token_distribution: Array<{
    entity: string | null;
    percentage: number | null;
  }> | null;
  market_cap_on_launch: number | null;
  created_at: string | null;
  title: string | null;
  social_links: string[] | null;
}

export class FirecrawlClient {
  private app: any;

  constructor(apiKey: string) {
    this.app = new FireCrawlApp({ apiKey });
  }

  async mapWebsite(baseUrl: string = 'https://www.gofundmeme.io'): Promise<string[]> {
    try {
      console.log('Making Firecrawl map request for:', baseUrl);
      
      const result = await this.app.mapUrl(baseUrl, {
        includeSubdomains: true,
        search: 'campaigns'
      });

      // Filter only campaign URLs
      const campaignUrls = (result?.links as string[] || []).filter((url: string) => 
        url.includes('/campaigns/') && 
        !url.includes('/create') && 
        !url.includes('/edit/')
      );
      
      console.log(`Found ${campaignUrls.length} campaign URLs`);
      return campaignUrls;
    } catch (error) {
      console.error('Firecrawl map error:', error);
      throw error;
    }
  }

  async extractCampaigns(urls: string[]): Promise<FirecrawlExtraction[]> {
    try {
      const BATCH_SIZE = 5; // Changed from 10 to 5
      const results: FirecrawlExtraction[] = [];
      
      // Process URLs in batches of 5
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        console.log(`\nProcessing batch ${(i/BATCH_SIZE) + 1} of ${Math.ceil(urls.length/BATCH_SIZE)} (${batch.length} URLs)`);
        console.log('URLs in this batch:', batch);
        
        const extractJob = await this.app.asyncExtract(batch, {
          prompt: `Extract campaign details from the page:
            - title (campaign/token name)
            - supply (total token supply)
            - ticker (token symbol)
            - avatar_url (token logo)
            - contract_address (Solana address)
            - developer_address (Solana address)
            - token_distribution (array of {entity, percentage})
            - market_cap_on_launch (USD)
            - created_at (ISO date)
            - social_links (URLs)`
        });

        console.log('\nExtract job response:', JSON.stringify(extractJob, null, 2));

        const jobId = extractJob?.jobId || extractJob?.id || (typeof extractJob === 'string' ? extractJob : null);
        if (!jobId) {
          console.error('Invalid extract job response:', extractJob);
          throw new Error('No job ID returned from asyncExtract');
        }

        console.log(`\nJob ${jobId} started, polling for results...`);

        // Poll for results
        let attempts = 0;
        const MAX_ATTEMPTS = 30; // 1 minute timeout
        
        while (attempts < MAX_ATTEMPTS) {
          const status = await this.app.getExtractStatus(jobId);
          console.log('\nStatus response:', JSON.stringify(status, null, 2));
          
          if (status.status === 'completed' && status.data) {
            console.log('\nBatch completed successfully');
            console.log('Extracted data:', JSON.stringify(status.data, null, 2));
            // Handle both array and single object responses
            if (Array.isArray(status.data)) {
              results.push(...status.data);
            } else {
              results.push(status.data);
            }
            break;
          } else if (status.status === 'failed') {
            throw new Error(`Extraction failed: ${status.error || 'Unknown error'}`);
          } else if (status.status === 'cancelled') {
            throw new Error('Extraction was cancelled');
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (attempts >= MAX_ATTEMPTS) {
          throw new Error('Extraction timed out after 60 seconds');
        }

        // Add a small delay between batches
        if (i + BATCH_SIZE < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('\nAll batches completed. Total results:', results.length);
      console.log('Final results:', JSON.stringify(results, null, 2));
      return results;
    } catch (error) {
      console.error('Firecrawl extract error:', error);
      throw error;
    }
  }
} 