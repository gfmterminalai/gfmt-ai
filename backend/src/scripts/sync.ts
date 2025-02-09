import { createClient } from '@supabase/supabase-js';
import { FirecrawlClient } from '../clients/firecrawl';
import { config } from '../config';

async function main() {
  try {
    console.log('Starting GoFundMeme hourly sync...');
    
    // Initialize clients
    const firecrawl = new FirecrawlClient(config.FIRECRAWL_API_KEY);
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
    
    // 1. Get all campaign URLs
    const campaignUrls = await firecrawl.mapWebsite();
    console.log('\nRaw URLs from website:');
    campaignUrls.forEach(url => console.log(url));
    console.log(`\nFound ${campaignUrls.length} total campaign URLs on website`);
    
    // Extract contract addresses from URLs
    const websiteAddresses = campaignUrls
      .map(url => {
        const match = url.match(/campaigns\/([^\/]+)/);
        if (!match) {
          console.log('Failed to extract address from URL:', url);
          return null;
        }
        return match[1];
      })
      .filter((address): address is string => address !== null)
      .sort();

    console.log('\nWebsite Campaigns:', websiteAddresses);
    
    // 2. Get existing campaigns from database
    const { data: existingCampaigns, error: dbError } = await supabase
      .from('meme_coins')
      .select('contract_address');
    
    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const existingAddresses = new Set(existingCampaigns?.map(c => c.contract_address));
    console.log('\nDatabase Campaigns:', Array.from(existingAddresses).sort());
    console.log(`\nFound ${existingAddresses.size} existing campaigns in database`);
    
    // Find new campaigns
    const newCampaigns = websiteAddresses
      .filter(address => !existingAddresses.has(address))
      .map(address => `https://www.gofundmeme.io/campaigns/${address}`);
    
    console.log('\nNew campaigns to process:', newCampaigns.length ? newCampaigns : 'None');
    
    // Track results
    const results = {
      processed: 0,
      added: 0,
      errors: 0,
      skipped: 0,
      distributions_added: 0,
      distributions_updated: 0
    };

    // Process new campaigns first
    if (newCampaigns.length > 0) {
      console.log(`\nExtracting data for ${newCampaigns.length} new campaigns...`);
      const newExtractions = await firecrawl.extractCampaigns(newCampaigns);
      
      // Insert new campaigns
      for (const extraction of newExtractions) {
        try {
          if (!extraction.contract_address) {
            results.skipped++;
            continue;
          }

          // Insert new meme coin
          const { error: insertError } = await supabase
            .from('meme_coins')
            .insert({
              contract_address: extraction.contract_address,
              developer_address: extraction.developer_address,
              ticker: extraction.ticker,
              supply: extraction.supply,
              market_cap_on_launch: extraction.market_cap_on_launch,
              created_at: extraction.created_at,
              avatar_url: extraction.avatar_url
            });

          if (insertError) {
            console.error(`Failed to insert campaign ${extraction.contract_address}:`, insertError);
            results.errors++;
            continue;
          }

          results.added++;

          // Insert token distributions
          const combinedDistributions = new Map<string, number>();
          extraction.token_distribution?.forEach(dist => {
            if (dist.entity && dist.percentage) {
              const currentTotal = combinedDistributions.get(dist.entity) || 0;
              combinedDistributions.set(dist.entity, currentTotal + dist.percentage);
            }
          });

          for (const [entity, percentage] of combinedDistributions.entries()) {
            const { error: distError } = await supabase
              .from('token_distributions')
              .insert({
                contract_address: extraction.contract_address,
                entity,
                percentage
              });

            if (distError) {
              console.error(`Failed to insert distribution for ${extraction.contract_address} (${entity}):`, distError);
            } else {
              results.distributions_added++;
            }
          }

          existingAddresses.add(extraction.contract_address);
          results.processed++;
          
        } catch (error) {
          console.error(`Failed to process extraction:`, error);
          results.errors++;
        }
      }
    }

    // 3. Check for campaigns missing token distributions
    console.log('\nChecking for campaigns missing token distributions...');
    const { data: campaignsWithDistributions, error: distError } = await supabase
      .from('meme_coins')
      .select(`
        contract_address,
        token_distributions (
          entity,
          percentage
        )
      `);
    
    if (distError) {
      throw new Error(`Failed to check token distributions: ${distError.message}`);
    }

    const campaignsNeedingDistributions = campaignsWithDistributions
      ?.filter(campaign => !campaign.token_distributions?.length)
      .map(campaign => `https://www.gofundmeme.io/campaigns/${campaign.contract_address}`) || [];

    console.log('\nCampaigns missing token distributions:', campaignsNeedingDistributions);

    // Process campaigns missing token distributions
    if (campaignsNeedingDistributions.length > 0) {
      console.log(`\nRe-extracting data for ${campaignsNeedingDistributions.length} campaigns missing token distributions...`);
      const distributionExtractions = await firecrawl.extractCampaigns(campaignsNeedingDistributions);

      for (const extraction of distributionExtractions) {
        try {
          if (!extraction.contract_address || !extraction.token_distribution?.length) {
            results.skipped++;
            continue;
          }

          // Combine token distributions
          const combinedDistributions = new Map<string, number>();
          extraction.token_distribution.forEach(dist => {
            if (dist.entity && dist.percentage) {
              const currentTotal = combinedDistributions.get(dist.entity) || 0;
              combinedDistributions.set(dist.entity, currentTotal + dist.percentage);
            }
          });

          // Insert token distributions
          for (const [entity, percentage] of combinedDistributions.entries()) {
            const { error: distError } = await supabase
              .from('token_distributions')
              .insert({
                contract_address: extraction.contract_address,
                entity,
                percentage
              });

            if (distError) {
              console.error(`Failed to insert distribution for ${extraction.contract_address} (${entity}):`, distError);
            } else {
              results.distributions_updated++;
            }
          }

          results.processed++;
          
        } catch (error) {
          console.error(`Failed to process token distribution:`, error);
          results.errors++;
        }
      }
    }

    // Print summary
    console.log('\n=== Sync Summary ===');
    console.log(`Total campaigns processed: ${results.processed}`);
    console.log(`New campaigns added: ${results.added}`);
    console.log(`New token distributions added: ${results.distributions_added}`);
    console.log(`Token distributions updated: ${results.distributions_updated}`);
    console.log(`Campaigns skipped: ${results.skipped}`);
    console.log(`Errors encountered: ${results.errors}`);

  } catch (error) {
    console.error('Script failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main();