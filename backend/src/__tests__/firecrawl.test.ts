import { FirecrawlClient } from '../clients/firecrawl';
import FireCrawlApp from '@mendable/firecrawl-js';
import { TEST_CAMPAIGN_URLS, TEST_CAMPAIGN_EXTRACTIONS } from './test-data';

// Mock the FireCrawlApp
jest.mock('@mendable/firecrawl-js');

describe('FirecrawlClient', () => {
  let client: FirecrawlClient;
  const mockApiKey = process.env.FIRECRAWL_API_KEY || 'fc-d71d5895e42644abbceefbc3c2258193';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    client = new FirecrawlClient(mockApiKey);
  });

  describe('mapWebsite', () => {
    it('should return multiple campaign URLs', async () => {
      const mockUrls = [
        ...TEST_CAMPAIGN_URLS,
        'https://www.gofundmeme.io/campaigns/create', // should be filtered out
        'https://www.gofundmeme.io/campaigns/edit/abc123' // should be filtered out
      ];

      // Mock the mapUrl method
      (FireCrawlApp.prototype.mapUrl as jest.Mock).mockResolvedValue({
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
      // Mock the asyncExtract and getExtractStatus methods
      (FireCrawlApp.prototype.asyncExtract as jest.Mock).mockResolvedValue({
        jobId: 'test-job-id'
      });

      (FireCrawlApp.prototype.getExtractStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        data: TEST_CAMPAIGN_EXTRACTIONS[0] // Use $Yeezy campaign data
      });

      const result = await client.extractCampaigns([TEST_CAMPAIGN_URLS[0]]);

      expect(result).toEqual([TEST_CAMPAIGN_EXTRACTIONS[0]]);
      expect(result.length).toBe(1);
    });

    it('should extract three campaign URLs successfully', async () => {
      (FireCrawlApp.prototype.asyncExtract as jest.Mock).mockResolvedValue({
        jobId: 'test-job-id'
      });

      // Return all three campaigns at once
      (FireCrawlApp.prototype.getExtractStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        data: TEST_CAMPAIGN_EXTRACTIONS
      });

      const result = await client.extractCampaigns(TEST_CAMPAIGN_URLS);

      expect(result).toEqual(TEST_CAMPAIGN_EXTRACTIONS);
      expect(result.length).toBe(3);
    });
  });
}); 