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

      // Mock the raw data format that would come from Firecrawl
      const mockRawData = {
        title: '$Yeezy',
        supply: '1000000000',
        ticker: '$Yeezy',
        contract_address: '9QqtYGAJUmgctBUgZCjxcx8yjSNBjkXdxpByuumSVsHC',
        developer_address: 'VPtSdieQaAxe2bVVtsdojbEZsGW4T1beNCnPyS6DKKf',
        token_distribution: [
          { entity: 'liquidity pool', percentage: 50 },
          { entity: 'presalers', percentage: 50 }
        ],
        market_cap_on_launch: 6193,
        created_at: '2025-02-03T03:57:00Z',
        description: 'Yeezy token launch',
        social_links: [
          'https://x.com/AiggyAgent',
          'https://aiggy.fun/',
          'https://twitter.com/search?q=$COINY'
        ],
        sourceURL: 'https://www.gofundmeme.io/campaigns/9QqtYGAJUmgctBUgZCjxcx8yjSNBjkXdxpByuumSVsHC'
      };

      (FireCrawlApp.prototype.getExtractStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        data: mockRawData
      });

      const result = await client.extractCampaigns([TEST_CAMPAIGN_URLS[0]]);

      expect(result).toEqual([TEST_CAMPAIGN_EXTRACTIONS[0]]);
      expect(result.length).toBe(1);
    });

    it('should extract three campaign URLs successfully', async () => {
      (FireCrawlApp.prototype.asyncExtract as jest.Mock).mockResolvedValue({
        jobId: 'test-job-id'
      });

      // Mock the raw data format for all three campaigns
      const mockRawData = TEST_CAMPAIGN_EXTRACTIONS.map(extraction => ({
        ...extraction.json,
        sourceURL: extraction.metadata.sourceURL
      }));

      (FireCrawlApp.prototype.getExtractStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        data: mockRawData
      });

      const result = await client.extractCampaigns(TEST_CAMPAIGN_URLS);

      expect(result).toEqual(TEST_CAMPAIGN_EXTRACTIONS);
      expect(result.length).toBe(3);
    });
  });
}); 