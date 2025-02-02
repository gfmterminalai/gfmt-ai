import axios from 'axios';
import { FirecrawlExtraction } from '../types/firecrawl';

export class FirecrawlClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = 'https://api.firecrawl.dev/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async mapWebsite(baseUrl: string = 'https://www.gofundmeme.io'): Promise<string[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/map`,
        { 
          url: baseUrl,
          options: {
            include_patterns: ['/campaigns/*'],
            exclude_patterns: ['/campaigns/create', '/campaigns/edit/*']
          }
        },
        { headers: this.headers }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to map website');
      }

      return response.data.data.urls;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Firecrawl API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async extractFromUrl(url: string): Promise<FirecrawlExtraction> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/extract`,
        { 
          url,
          prompt: "Extract the following information from the campaign page: contract_address, ticker, supply, developer_address, token_distribution (array of {entity, percentage}), market_cap_on_launch, created_at, title, description, social_links"
        },
        { headers: this.headers }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to extract data');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Firecrawl API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async extractBatch(urls: string[]): Promise<FirecrawlExtraction[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/extract-batch`,
        { urls },
        { headers: this.headers }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to extract batch data');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Firecrawl API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
} 