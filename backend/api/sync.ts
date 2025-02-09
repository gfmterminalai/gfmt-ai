import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { FirecrawlClient } from '../src/clients/firecrawl';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize clients
  const firecrawl = new FirecrawlClient(process.env.FIRECRAWL_API_KEY!);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Add debug logging for environment variables
  console.log(`Environment check: ${JSON.stringify({
    hasFirecrawlKey: !!process.env.FIRECRAWL_API_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    hasResendKey: !!process.env.RESEND_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL
  })}`);

  const startTime = new Date();
  let status: 'success' | 'failure' | 'partial_success' = 'success';
  const errorDetails: Array<{ type: string; message: string; timestamp: string }> = [];

  try {
    console.log('Starting URL mapping...');
    // Get all campaign URLs
    const campaignUrls = await firecrawl.mapWebsite();
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
      errors: 0,
      skipped: 0,
      distributions_added: 0,
      distributions_updated: 0
    };

    // Process new campaigns
    if (newCampaigns.length > 0) {
      console.log(`Processing ${newCampaigns.length} new campaigns...`);
      const extractions = await firecrawl.extractCampaigns(newCampaigns);
      
      for (const extraction of extractions) {
        try {
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
              created_at: new Date(extraction.json.created_at)
            });

          if (insertError) {
            errorDetails.push({
              type: 'INSERT_ERROR',
              message: `Failed to insert campaign ${extraction.json.contract_address}: ${insertError.message}`,
              timestamp: new Date().toISOString()
            });
            results.errors++;
          } else {
            results.added++;

            // Insert token distributions if available
            if (extraction.json.token_distribution?.length) {
              for (const dist of extraction.json.token_distribution) {
                const { error: distError } = await supabase
                  .from('token_distributions')
                  .insert({
                    contract_address: extraction.json.contract_address,
                    entity: dist.entity,
                    percentage: dist.percentage
                  });

                if (distError) {
                  errorDetails.push({
                    type: 'DISTRIBUTION_ERROR',
                    message: `Failed to insert distribution for ${extraction.json.contract_address}: ${distError.message}`,
                    timestamp: new Date().toISOString()
                  });
                } else {
                  results.distributions_added++;
                }
              }
            }
          }
          
        } catch (error) {
          errorDetails.push({
            type: 'PROCESSING_ERROR',
            message: `Failed to process extraction: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date().toISOString()
          });
          results.errors++;
        }
        results.processed++;
      }
    }

    // Determine sync status
    if (results.errors === 0) {
      status = 'success';
    } else if (results.processed > 0) {
      status = 'partial_success';
    } else {
      status = 'failure';
    }

    // Record sync history
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(`Recording sync history: ${JSON.stringify({
      status,
      processed: results.processed,
      added: results.added,
      errors: results.errors
    })}`);

    const { error: historyError } = await supabase
      .from('sync_history')
      .insert({
        start_time: startTime,
        end_time: endTime,
        duration_ms: duration,
        status,
        campaigns_processed: results.processed,
        campaigns_added: results.added,
        distributions_added: results.distributions_added,
        distributions_updated: results.distributions_updated,
        errors: results.errors,
        skipped: results.skipped,
        error_details: errorDetails
      });

    if (historyError) {
      console.error(`Failed to record sync history: ${JSON.stringify(historyError)}`);
    }

    // Send email report
    try {
      console.log('Sending email report...');
      await resend.emails.send({
        from: 'no-reply@alerts.gfmterminal.ai',
        to: 'dev@gfmterminal.ai',
        subject: `GFM Sync ${status === 'success' ? 'Completed Successfully' : status === 'partial_success' ? 'Completed with Warnings' : 'Failed'} - ${startTime.toLocaleDateString()}`,
        text: `
Sync Status Report
-----------------
Status: ${status}
Duration: ${Math.round(duration / 1000)}s
Campaigns Processed: ${results.processed}
Campaigns Added: ${results.added}
Distributions Added: ${results.distributions_added}
Distributions Updated: ${results.distributions_updated}
Errors: ${results.errors}
Skipped: ${results.skipped}

${errorDetails.length > 0 ? `\nError Details:\n${errorDetails.map(e => `- [${e.timestamp}] ${e.type}: ${e.message}`).join('\n')}` : ''}
        `
      });
    } catch (emailError) {
      console.error(`Failed to send email report: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
    }

    return res.status(200).json({
      success: true,
      results: {
        processed: results.processed,
        added: results.added,
        errors: results.errors,
        total_urls: campaignUrls.length,
        new_campaigns: newCampaigns.length
      }
    });

  } catch (error) {
    console.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Try to record the failure in sync history
    try {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      await supabase
        .from('sync_history')
        .insert({
          start_time: startTime,
          end_time: endTime,
          duration_ms: duration,
          status: 'failure',
          campaigns_processed: 0,
          campaigns_added: 0,
          distributions_added: 0,
          distributions_updated: 0,
          errors: 1,
          skipped: 0,
          error_details: [{
            type: 'FATAL_ERROR',
            message: errorMessage,
            timestamp: new Date().toISOString()
          }]
        });
    } catch (historyError) {
      console.error(`Failed to record sync failure: ${historyError instanceof Error ? historyError.message : String(historyError)}`);
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
} 