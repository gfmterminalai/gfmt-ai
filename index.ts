import { createClient } from '@supabase/supabase-js';
import * as puppeteer from 'puppeteer';
import { Command, program } from '@commander-js/extra-typings';

const GFM_URLS = {
  base: 'https://gofundmeme.io',
  homepage: 'https://gofundmeme.io',
  trending: 'https://gofundmeme.io/trending',
  pools: 'https://gofundmeme.io/pools',
  getCampaignUrl: (address: string) => `https://gofundmeme.io/campaigns/${address}`
};

interface CampaignData {
  address: string;
  name: string;
  description?: string;
  socialLinks?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  imageUrl?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function makeApiCall<T = any>(url: string, method: string = 'GET'): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, { method });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error(`API call failed for ${url}:`, error);
    return { success: false, error: String(error) };
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

async function extractCampaignData(page: puppeteer.Page, address: string): Promise<CampaignData | null> {
  try {
    await page.goto(GFM_URLS.getCampaignUrl(address), { waitUntil: 'networkidle0' });
    
    // Wait for the campaign data to load
    await page.waitForSelector('#__NEXT_DATA__', { timeout: 5000 });
    
    const campaignData = await page.evaluate(() => {
      const scriptElement = document.getElementById('__NEXT_DATA__');
      if (!scriptElement) return null;
      
      const jsonData = JSON.parse(scriptElement.textContent || '{}');
      const pageProps = jsonData.props?.pageProps;
      
      if (!pageProps) return null;
      
      return {
        address: pageProps.address || '',
        name: pageProps.name || '',
        description: pageProps.description || '',
        socialLinks: {
          twitter: pageProps.twitter || '',
          telegram: pageProps.telegram || '',
          website: pageProps.website || ''
        },
        imageUrl: pageProps.image || ''
      };
    });
    
    return campaignData;
  } catch (error) {
    console.error(`Error extracting campaign data for ${address}:`, error);
    return null;
  }
}

async function extractTokenAddresses(page: puppeteer.Page): Promise<string[]> {
  try {
    await page.goto(GFM_URLS.homepage, { waitUntil: 'networkidle0' });
    
    const addresses = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/campaigns/"]'));
      return links
        .map(link => link.getAttribute('href'))
        .filter((href): href is string => !!href)
        .map(href => href.replace('/campaigns/', ''))
        .filter(address => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address));
    }) as string[];
    
    return [...new Set(addresses)];
  } catch (error) {
    console.error('Error extracting token addresses:', error);
    return [];
  }
}

async function crawlGFM(command: Command) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Extract token addresses from the homepage
    const addresses = await extractTokenAddresses(page);
    console.log(`Found ${addresses.length} unique token addresses`);
    
    // Check which addresses we haven't processed yet
    const { data: existingAddresses } = await supabase
      .from('meme_coins')
      .select('contract_address')
      .in('contract_address', addresses);
    
    const processedAddresses = new Set(existingAddresses?.map(row => row.contract_address));
    const newAddresses = addresses.filter(addr => !processedAddresses.has(addr));
    
    console.log(`Found ${newAddresses.length} new addresses to process`);
    
    // Process each new address
    for (const address of newAddresses) {
      const campaignData = await extractCampaignData(page, address);
      if (!campaignData) continue;
      
      // Validate the token on Solscan
      const solscanData = await makeApiCall(
        `https://api.solscan.io/token/meta?token=${address}`,
        'GET'
      );
      
      if (!solscanData?.success) {
        console.log(`Invalid token address: ${address}`);
        continue;
      }
      
      // Store the token data
      const { error } = await supabase
        .from('meme_coins')
        .upsert({
          contract_address: address,
          name: campaignData.name,
          description: campaignData.description,
          twitter_url: campaignData.socialLinks?.twitter,
          telegram_url: campaignData.socialLinks?.telegram,
          website_url: campaignData.socialLinks?.website,
          image_url: campaignData.imageUrl,
          chain: 'solana',
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`Error storing token ${address}:`, error);
      } else {
        console.log(`Successfully processed token: ${address}`);
      }
      
      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('Error during crawling:', error);
  } finally {
    await browser.close();
  }
}

async function testCrawl(this: Command) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Extract token addresses from the homepage
    const addresses = await extractTokenAddresses(page);
    console.log('Found addresses:', addresses);
    
    if (addresses.length > 0) {
      // Test with the first address
      const testAddress = addresses[0];
      console.log(`Testing with address: ${testAddress}`);
      
      const campaignData = await extractCampaignData(page, testAddress);
      console.log('Campaign data:', JSON.stringify(campaignData, null, 2));
      
      if (campaignData) {
        // Validate the token on Solscan
        const solscanData = await makeApiCall(
          `https://api.solscan.io/token/meta?token=${testAddress}`,
          'GET'
        );
        console.log('Solscan data:', JSON.stringify(solscanData, null, 2));
      }
    }
  } catch (error) {
    console.error('Error during test crawl:', error);
  } finally {
    await browser.close();
  }
}

program
  .command('test-crawl')
  .description('Test the crawler with a single token')
  .action(testCrawl); 