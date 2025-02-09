import { FirecrawlClient } from '../clients/firecrawl';
import FireCrawlApp from '@mendable/firecrawl-js';
import { TEST_CAMPAIGN_URLS, TEST_CAMPAIGN_EXTRACTIONS } from './test-data';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { FirecrawlExtraction } from '../types/firecrawl';

// Mock the FireCrawlApp
jest.mock('@mendable/firecrawl-js');

describe('FirecrawlClient', () => {
  let client: FirecrawlClient;
  const mockApiKey = process.env.FIRECRAWL_API_KEY || 'fc-d71d5895e42644abbceefbc3c2258193';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementation
    (FireCrawlApp as jest.MockedClass<typeof FireCrawlApp>).mockImplementation(() => ({
      apiKey: mockApiKey,
      apiUrl: 'https://api.firecrawl.com',
      mapUrl: jest.fn(),
      asyncExtract: jest.fn(),
      getExtractStatus: jest.fn(),
      // Add other required methods with empty implementations
      scrapeUrl: jest.fn(),
      search: jest.fn(),
      handleError: jest.fn()
    }));

    client = new FirecrawlClient(mockApiKey);
  });

  describe('mapWebsite', () => {
    it('should return multiple campaign URLs', async () => {
      const mockUrls = [
        ...TEST_CAMPAIGN_URLS,
        'https://www.gofundmeme.io/campaigns/create', // should be filtered out
        'https://www.gofundmeme.io/campaigns/edit/abc123' // should be filtered out
      ];

      const mockApp = (client as any).app;
      mockApp.mapUrl.mockResolvedValue({
        success: true,
        links: mockUrls
      });

      const result = await client.mapWebsite();

      // Should only include valid campaign URLs
      expect(result).toEqual(TEST_CAMPAIGN_URLS);
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('extractCampaigns', () => {
    it('should extract single campaign URL successfully', async () => {
      const mockApp = (client as any).app;
      mockApp.asyncExtract.mockResolvedValue({
        success: true,
        jobId: 'test-job-id'
      });

      // Mock the raw data format that would come from Firecrawl
      const mockRawData = {
        ...TEST_CAMPAIGN_EXTRACTIONS[0].json,
        sourceURL: TEST_CAMPAIGN_EXTRACTIONS[0].metadata.sourceURL
      };

      mockApp.getExtractStatus.mockResolvedValue({
        success: true,
        status: 'completed',
        data: mockRawData
      });

      const result = await client.extractCampaigns([TEST_CAMPAIGN_URLS[0]]);
      expect(result).toEqual([TEST_CAMPAIGN_EXTRACTIONS[0]]);
      expect(result.length).toBe(1);
    });

    it('should extract three campaign URLs successfully', async () => {
      const mockApp = (client as any).app;
      mockApp.asyncExtract.mockResolvedValue({
        success: true,
        jobId: 'test-job-id'
      });

      // Mock the raw data format for all three campaigns
      const mockRawData = TEST_CAMPAIGN_EXTRACTIONS.map(extraction => ({
        ...extraction.json,
        sourceURL: extraction.metadata.sourceURL
      }));

      mockApp.getExtractStatus.mockResolvedValue({
        success: true,
        status: 'completed',
        data: mockRawData
      });

      const result = await client.extractCampaigns(TEST_CAMPAIGN_URLS);
      expect(result).toEqual(TEST_CAMPAIGN_EXTRACTIONS);
      expect(result.length).toBe(3);
    });
  });
}); 