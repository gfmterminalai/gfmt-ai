import { Router } from 'express';
import { config } from '../core/config';
import { FirecrawlClient } from '../clients/firecrawl';
import { createClient } from '@supabase/supabase-js';
import { FirecrawlExtraction } from '../types/firecrawl';
import { DatabaseAdapter } from '../core/database';

const router = Router();
const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);

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

// Reconcile campaigns with website
router.post('/reconcile', async (req, res) => {
  try {
    console.log('Starting campaign reconciliation...');
    
    // Get all campaign URLs from website
    const campaignUrls = await firecrawl.mapWebsite();
    console.log(`Found ${campaignUrls.length} campaign URLs on website`);
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        return match ? match[1] : null;
      })
      .filter((address): address is string => address !== null);
    
    // Get existing campaigns from database
    const { data: existingCampaigns, error: dbError } = await supabase
      .from('meme_coins')
      .select('contract_address');
    
    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    
    // Find missing campaigns
    const missingAddresses = websiteAddresses.filter(address => !existingAddresses.has(address));
    const missingUrls = missingAddresses.map(address => `https://www.gofundmeme.io/campaigns/${address}`);
    
    console.log(`Found ${missingUrls.length} missing campaigns`);
    
    if (missingUrls.length === 0) {
      return res.json({
        success: true,
        message: 'No missing campaigns found',
        stats: {
          website_total: websiteAddresses.length,
          database_total: existingAddresses.size,
          missing: 0
        }
      });
    }
    
    // Process missing campaigns in batches of 5
    const results = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0
    };
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < missingUrls.length; i += BATCH_SIZE) {
      const batch = missingUrls.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(missingUrls.length/BATCH_SIZE)}`);
      
      try {
        const extractions = await firecrawl.extractCampaigns(batch);
        
        // Process each extraction
        for (const extraction of extractions) {
          if (!extraction.json.contract_address) {
            results.skipped++;
            continue;
          }
          
          // Insert into database
          const { error: insertError } = await supabase
            .from('meme_coins')
            .insert({
              contract_address: extraction.json.contract_address,
              developer_address: extraction.json.developer_address,
              ticker: extraction.json.ticker,
              supply: extraction.json.supply,
              market_cap_on_launch: extraction.json.market_cap_on_launch,
              created_at: extraction.json.created_at
            });
            
          if (insertError) {
            console.error(`Failed to insert campaign ${extraction.json.contract_address}:`, insertError);
            results.errors++;
          } else {
            results.added++;
          }
        }
        
        results.processed += batch.length;
        
        // Add delay between batches
        if (i + BATCH_SIZE < missingUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to process batch:`, error);
        results.errors += batch.length;
        results.processed += batch.length;
      }
    }
    
    res.json({
      success: true,
      message: 'Reconciliation completed',
      stats: {
        website_total: websiteAddresses.length,
        database_total: existingAddresses.size,
        missing: missingUrls.length,
        results
      }
    });
    
  } catch (error) {
    console.error('Reconciliation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reconcile campaigns'
    });
  }
});

export function createCampaignRoutes(db: DatabaseAdapter) {
  const router = Router();
  const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);

  // Get all campaigns
  router.get('/', async (req, res) => {
    try {
      const campaigns = await db.getMemeCoinsPaginated();
      res.json({ success: true, data: campaigns });
    } catch (error) {
      console.error('Failed to get campaigns:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get a specific campaign
  router.get('/:address', async (req, res) => {
    try {
      const campaign = await db.getMemeCoin(req.params.address);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
      }
      res.json({ success: true, data: campaign });
    } catch (error) {
      console.error('Failed to get campaign:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create a new campaign
  router.post('/', async (req, res) => {
    try {
      const url = req.body.url;
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      const extraction = await firecrawl.extractFromUrl(url);
      if (!extraction.json.contract_address) {
        return res.status(400).json({
          success: false,
          error: 'Failed to extract contract address from campaign'
        });
      }

      // Insert campaign
      const memeCoin = await db.insertMemeCoin({
        contract_address: extraction.json.contract_address,
        developer_address: extraction.json.developer_address,
        ticker: extraction.json.ticker,
        supply: extraction.json.supply,
        market_cap_on_launch: extraction.json.market_cap_on_launch,
        created_at: new Date(extraction.json.created_at)
      });

      res.json({
        success: true,
        data: memeCoin
      });
    } catch (error) {
      console.error('Failed to create campaign:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default router; 