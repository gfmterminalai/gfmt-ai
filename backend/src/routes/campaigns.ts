import { Router } from 'express';
import { config } from '../core/config';
import { FirecrawlClient } from '../clients/firecrawl';

const router = Router();
const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);

// Map all campaign URLs
router.get('/map', async (req, res) => {
  try {
    console.log('Starting campaign URL mapping...');
    
    const campaignUrls = await firecrawl.mapWebsite();
    
    // Return the results
    res.json({
      success: true,
      total: campaignUrls.length,
      urls: campaignUrls
    });
  } catch (error) {
    console.error('Failed to map campaign URLs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to map campaign URLs'
    });
  }
});

export default router; 