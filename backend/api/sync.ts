import { createClient } from '@supabase/supabase-js';
import FireCrawlApp from '@mendable/firecrawl-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variables are automatically loaded by Vercel
const firecrawl = new FireCrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all campaign URLs
    const mapResponse = await firecrawl.mapUrl('https://www.gofundmeme.io', {
      includeSubdomains: true,
      search: 'campaigns'
    });

    if ('error' in mapResponse) {
      throw new Error(`Failed to map URLs: ${mapResponse.error}`);
    }

    const campaignUrls = mapResponse.links || [];
    console.log(`Found ${campaignUrls.length} campaign URLs`);

    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    // Get existing campaigns
    const { data: existingCampaigns } = await supabase
      .from('meme_coins')
      .select('contract_address');

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    
    // Find new campaigns
    const newCampaigns = websiteAddresses
      .filter(address => !existingAddresses.has(address))
      .map(address => `https://www.gofundmeme.io/campaigns/${address}`);

    const results = {
      processed: 0,
      added: 0,
      errors: 0
    };

    // Process new campaigns in batches
    const BATCH_SIZE = 3;
    for (let i = 0; i < newCampaigns.length; i += BATCH_SIZE) {
      const batch = newCampaigns.slice(i, i + BATCH_SIZE);
      
      try {
        const extractJob = await firecrawl.asyncExtract(batch, {
          prompt: `Extract campaign details from the page:
            - title (campaign/token name)
            - supply (total token supply)
            - ticker (token symbol)
            - contract_address (Solana address)
            - developer_address (Solana address)
            - token_distribution (array of {entity, percentage})
            - market_cap_on_launch (USD)
            - created_at (ISO date)
            - social_links (URLs)
            - description (campaign description)`
        });

        if ('error' in extractJob) {
          throw new Error(`Failed to start extraction: ${extractJob.error}`);
        }

        // Handle potential response formats
        const jobId = typeof extractJob === 'string' ? extractJob : 
                     'jobId' in extractJob ? extractJob.jobId :
                     'id' in extractJob ? extractJob.id : null;

        if (!jobId) {
          throw new Error('No job ID returned from asyncExtract');
        }

        // Poll for results
        const maxAttempts = 60; // 2 minutes with 2-second intervals
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          const status = await firecrawl.getExtractStatus(jobId);
          
          if ('error' in status) {
            throw new Error(`Failed to get extraction status: ${status.error}`);
          }

          if (status.status === 'completed' && status.data) {
            const extractions = Array.isArray(status.data) ? status.data : [status.data];
            
            for (const extraction of extractions) {
              try {
                if (!extraction.contract_address) continue;

                // Insert into database
                const { error } = await supabase
                  .from('meme_coins')
                  .insert({
                    contract_address: extraction.contract_address,
                    developer_address: extraction.developer_address,
                    ticker: extraction.ticker,
                    supply: extraction.supply,
                    market_cap_on_launch: extraction.market_cap_on_launch,
                    created_at: new Date(extraction.created_at)
                  });

                if (error) {
                  console.error(`Failed to insert: ${error.message}`);
                  results.errors++;
                } else {
                  results.added++;
                }
                
              } catch (error) {
                console.error('Extraction processing error:', error);
                results.errors++;
              }
              results.processed++;
            }
            break;
          } else if (status.status === 'failed' || status.status === 'cancelled') {
            throw new Error(`Extraction ${status.status}: ${status.error || 'Unknown error'}`);
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (attempts >= maxAttempts) {
          throw new Error('Extraction timed out');
        }

        // Add delay between batches
        if (i + BATCH_SIZE < newCampaigns.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('Batch processing error:', error);
        results.errors += batch.length;
        results.processed += batch.length;
      }
    }

    return res.status(200).json({
      success: true,
      results: {
        ...results,
        total_urls: campaignUrls.length,
        new_campaigns: newCampaigns.length
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 