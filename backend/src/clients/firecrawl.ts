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
  private app: any; // FireCrawlApp type not exported from package

  constructor(apiKey: string) {
    this.app = new FireCrawlApp({ apiKey });
  }

  private get schema() {
    return z.object({
      avatar_url: z.string().nullable(),
      contract_address: z.string().nullable(),
      ticker: z.string().nullable(),
      supply: z.number().nullable(),
      developer_address: z.string().nullable(),
      token_distribution: z.array(z.object({
        entity: z.string().nullable(),
        percentage: z.number().nullable()
      })).nullable(),
      market_cap_on_launch: z.number().nullable(),
      created_at: z.string().nullable(),
      title: z.string().nullable(),
      social_links: z.array(z.string()).nullable()
    });
  }

  async mapWebsite(baseUrl: string = 'https://www.gofundmeme.io'): Promise<string[]> {
    try {
      console.log('Making Firecrawl map request for:', baseUrl);
      
      const result = await this.app.mapUrl(baseUrl, {
        includeSubdomains: true
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

  async extractFromUrl(url: string): Promise<FirecrawlExtraction> {
    try {
      console.log('Making Firecrawl extract request for URL:', url);

      const result = await this.app.extract([url], {
        prompt: 'Extract from campaign page: avatar_url (the full IPFS URL for the token logo image), contract_address (full address, no truncation), developer_address (full address, no truncation), ticker, supply (as number), token_distribution (array of {entity, percentage}), market_cap_on_launch (as number), created_at (ISO date), title, and social_links (array of full URLs). Do not truncate any addresses.',
        schema: this.schema,
      });

      console.log('Firecrawl extract response:', result);
      return result.data;
    } catch (error) {
      console.error('Firecrawl extract error:', error);
      throw error;
    }
  }

  async extractBatch(urls: string[]): Promise<FirecrawlExtraction[]> {
    try {
      const result = await this.app.extract(urls, {
        prompt: 'Extract from campaign page: avatar_url (the full IPFS URL for the token logo image), contract_address (full address, no truncation), developer_address (full address, no truncation), ticker, supply (as number), token_distribution (array of {entity, percentage}), market_cap_on_launch (as number), created_at (ISO date), title, and social_links (array of full URLs). Do not truncate any addresses.',
        schema: this.schema,
      });

      return result.data;
    } catch (error) {
      console.error('Firecrawl batch extract error:', error);
      throw error;
    }
  }
} 