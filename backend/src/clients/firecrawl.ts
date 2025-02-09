import FireCrawlApp from '@mendable/firecrawl-js';
import { FirecrawlExtraction, FirecrawlExtractionJson, FirecrawlMetadata } from '../types/firecrawl';

export class FirecrawlClient {
  private app: any;
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 3;
  private readonly TIMEOUT_SECONDS = 120;
  private readonly POLL_INTERVAL_MS = 2000;

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

  private transformExtraction(rawData: Record<string, any>): FirecrawlExtraction {
    const json: FirecrawlExtractionJson = {
      contract_address: rawData.contract_address || '',
      ticker: rawData.ticker || '',
      supply: rawData.supply?.toString() || '0',
      developer_address: rawData.developer_address || '',
      token_distribution: (rawData.token_distribution || []).map((dist: any) => ({
        entity: dist.entity || '',
        percentage: Number(dist.percentage) || 0
      })),
      market_cap_on_launch: Number(rawData.market_cap_on_launch) || 0,
      created_at: rawData.created_at || new Date().toISOString(),
      title: rawData.title || '',
      description: rawData.description || '',
      social_links: rawData.social_links || []
    };

    const metadata: FirecrawlMetadata = {
      title: rawData.title || '',
      description: rawData.description || '',
      sourceURL: rawData.sourceURL || '',
      statusCode: 200
    };

    return { json, metadata };
  }

  private async extractBatchWithRetry(urls: string[], retryCount = 0): Promise<FirecrawlExtraction[]> {
    try {
      console.log(`Processing batch of ${urls.length} URLs (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
      console.log('URLs in this batch:', urls);

      const extractJob = await this.app.asyncExtract(urls, {
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
          - social_links (URLs)
          - description (campaign description)`
      });

      console.log('\nExtract job response:', JSON.stringify(extractJob, null, 2));

      const jobId = extractJob?.jobId || extractJob?.id || (typeof extractJob === 'string' ? extractJob : null);
      if (!jobId) {
        throw new Error('No job ID returned from asyncExtract');
      }

      console.log(`\nJob ${jobId} started, polling for results...`);

      // Poll for results
      let attempts = 0;
      const maxAttempts = Math.floor(this.TIMEOUT_SECONDS * 1000 / this.POLL_INTERVAL_MS);
      
      while (attempts < maxAttempts) {
        const status = await this.app.getExtractStatus(jobId);
        console.log('\nStatus response:', JSON.stringify(status, null, 2));
        
        if (status.status === 'completed' && status.data) {
          console.log('\nBatch completed successfully');
          console.log('Extracted data:', JSON.stringify(status.data, null, 2));
          const rawData = Array.isArray(status.data) ? status.data : [status.data];
          return rawData.map((data: Record<string, any>) => this.transformExtraction(data));
        } else if (status.status === 'failed') {
          throw new Error(`Extraction failed: ${status.error || 'Unknown error'}`);
        } else if (status.status === 'cancelled') {
          throw new Error('Extraction was cancelled');
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
      }

      throw new Error(`Extraction timed out after ${this.TIMEOUT_SECONDS} seconds`);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES - 1) {
        console.log(`Batch failed, retrying... (${retryCount + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        return this.extractBatchWithRetry(urls, retryCount + 1);
      }
      throw error;
    }
  }

  async extractCampaigns(urls: string[]): Promise<FirecrawlExtraction[]> {
    try {
      const results: FirecrawlExtraction[] = [];
      
      // Process URLs in small batches
      for (let i = 0; i < urls.length; i += this.BATCH_SIZE) {
        const batch = urls.slice(i, i + this.BATCH_SIZE);
        console.log(`\nProcessing batch ${Math.floor(i/this.BATCH_SIZE) + 1} of ${Math.ceil(urls.length/this.BATCH_SIZE)}`);
        
        try {
          const batchResults = await this.extractBatchWithRetry(batch);
          results.push(...batchResults);
        } catch (error) {
          console.error(`Failed to process batch starting at index ${i}:`, error);
          // Continue with next batch instead of failing completely
          continue;
        }

        // Add a delay between batches
        if (i + this.BATCH_SIZE < urls.length) {
          console.log('Waiting between batches...');
          await new Promise(resolve => setTimeout(resolve, 3000));
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

  async extractFromUrl(url: string): Promise<FirecrawlExtraction> {
    try {
      console.log('Extracting data from URL:', url);
      const results = await this.extractCampaigns([url]);
      if (!results || results.length === 0) {
        throw new Error('No data extracted from URL');
      }
      return results[0];
    } catch (error) {
      console.error('Failed to extract from URL:', error);
      throw error;
    }
  }

  async extractBatch(urls: string[]): Promise<FirecrawlExtraction[]> {
    return this.extractCampaigns(urls);
  }
} 