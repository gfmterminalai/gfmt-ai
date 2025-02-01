import { createClient } from '@supabase/supabase-js';
import * as puppeteer from 'puppeteer';
import { Command, program } from '@commander-js/extra-typings';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';

// Load environment variables
dotenv.config();

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
    twitter?: string | undefined;
    telegram?: string | undefined;
    website?: string | undefined;
  };
  imageUrl?: string | undefined;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TokenRecord {
  contract_address: string;
}

interface MemeCoinsTable {
  contract_address: string;
  name?: string;
  description?: string;
  twitter_url?: string;
  telegram_url?: string;
  website_url?: string;
  image_url?: string;
  chain: string;
  created_at: string;
}

interface MemeCoinsResponse {
  data: TokenRecord[] | null;
  error: Error | null;
}

interface AddressInfo {
  contractAddress: string;
  devAddress?: string;
  timestamp: string;
}

async function makeApiCall(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GFMTerminal/1.0)',
        'Referer': 'https://solscan.io/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    return await response.json();
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Initialize Supabase client if credentials are available
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

async function extractAndSaveAddresses(page: puppeteer.Page, address: string): Promise<AddressInfo | null> {
  try {
    console.log(`Looking for copy buttons on page for ${address}...`);
    
    // Wait for copy buttons to be available
    await page.waitForSelector('[class*="mantine-ActionIcon-icon"]', { timeout: 5000 });
    
    const addresses = await page.evaluate(() => {
      const copyButtons = Array.from(document.querySelectorAll('[class*="mantine-ActionIcon-icon"]'));
      const addresses: { [key: string]: string } = {};
      
      // Get the text content of elements next to copy buttons
      copyButtons.forEach((button, index) => {
        const parentElement = button.closest('.mantine-Group-root');
        if (parentElement) {
          const addressElement = parentElement.querySelector('div[style*="font-family:monospace"]');
          if (addressElement) {
            const addressText = addressElement.textContent?.trim() || '';
            if (addressText) {
              // Try to determine if it's a contract or dev address based on position or nearby text
              const labelElement = parentElement.querySelector('div:first-child');
              const label = labelElement?.textContent?.toLowerCase() || '';
              
              if (label.includes('contract') || label.includes('token')) {
                addresses.contract = addressText;
              } else if (label.includes('dev') || label.includes('creator')) {
                addresses.dev = addressText;
              } else {
                // If we can't determine the type, use the index
                addresses[`address${index + 1}`] = addressText;
              }
            }
          }
        }
      });
      
      return addresses;
    });
    
    console.log('Found addresses:', addresses);
    
    if (Object.keys(addresses).length > 0) {
      const addressInfo: AddressInfo = {
        contractAddress: addresses.contract || address,
        devAddress: addresses.dev,
        timestamp: new Date().toISOString()
      };
      
      // Append to addresses.json file
      try {
        // Read existing addresses
        let existingAddresses: AddressInfo[] = [];
        try {
          const fileContent = await fs.readFile('addresses.json', 'utf-8');
          existingAddresses = JSON.parse(fileContent);
        } catch (error) {
          // File doesn't exist or is invalid JSON, start with empty array
          console.log('Creating new addresses.json file');
        }
        
        // Add new address info
        existingAddresses.push(addressInfo);
        
        // Write back to file
        await fs.writeFile('addresses.json', JSON.stringify(existingAddresses, null, 2));
        console.log('Saved addresses to addresses.json');
        
        return addressInfo;
      } catch (error) {
        console.error('Error saving addresses to file:', error);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting addresses for ${address}:`, error);
    return null;
  }
}

async function extractCampaignData(page: puppeteer.Page, address: string): Promise<CampaignData | null> {
  try {
    console.log(`Fetching campaign data...`);
    const campaignUrl = `https://gofundmeme.io/campaigns/${address}`;
    console.log(`Navigating to campaign page for ${address}...`);
    
    await page.goto(campaignUrl, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    });

    // Wait for content to load with increased timeout
    console.log('Waiting for campaign data to load...');
    
    // Wait for any of these selectors to appear
    const selectors = [
      'h1',
      '.mantine-Stack-root',
      '.mantine-Text-root',
      'img[src*="http"]',
      '.mantine-Table-tr'
    ];
    
    try {
      await Promise.race(
        selectors.map(selector => 
          page.waitForSelector(selector, { timeout: 20000 })
        )
      );
    } catch (e) {
      console.log('Initial selectors not found, continuing anyway...');
    }

    // Add a small delay to ensure dynamic content loads
    await page.waitForTimeout(2000);
    
    // Save screenshot for debugging
    await page.screenshot({ path: 'campaign-page.png' });
    
    // Log page info
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());

    // Extract campaign data using page.evaluate for better context
    const data = await page.evaluate(() => {
      // Helper function to safely get text content
      const getText = (selector: string): string | null => {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // Get direct text content without child elements
          let text = '';
          for (const node of el.childNodes) {
            if (node.nodeType === 3) { // Text node
              text += node.textContent?.trim() || '';
            }
          }
          text = text || el.textContent?.trim() || '';
          
          if (text && text.length > 0 && !text.includes('Loading') && !text.includes('GoFundMeme') && !text.includes('$') && !text.includes('%')) {
            return text;
          }
        }
        return null;
      };

      // Helper function to safely get attribute
      const getAttribute = (selector: string, attr: string): string | null => {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const value = el.getAttribute(attr);
          if (value) {
            return value;
          }
        }
        return null;
      };

      // Extract created date
      let createdDate = null;
      const tableRows = document.querySelectorAll('.mantine-Table-tr');
      for (const row of tableRows) {
        const text = row.textContent?.toLowerCase() || '';
        if (text.includes('created')) {
          // Extract the date part after "created"
          const dateMatch = text.match(/created(.*)/i);
          if (dateMatch) {
            createdDate = dateMatch[1].trim();
          }
          break;
        }
      }

      // Extract addresses
      const addresses: Record<string, string> = {};
      const addressPattern = /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}/;
      
      // Look for sections that might contain addresses
      document.querySelectorAll('.mantine-Stack-root').forEach(section => {
        const text = section.textContent || '';
        if (text.toLowerCase().includes('contract')) {
          const match = text.match(addressPattern);
          if (match) {
            addresses.contract = match[0];
          }
        } else if (text.toLowerCase().includes('developer')) {
          const match = text.match(addressPattern);
          if (match) {
            addresses.developer = match[0];
          }
        }
      });

      // Look for campaign name
      const nameSelectors = [
        '.mantine-Title-root',
        '.mantine-Stack-root h1',
        '.mantine-Stack-root h2',
        'h1', 
        '.campaign-title', 
        '.token-name'
      ];

      let name = null;
      for (const selector of nameSelectors) {
        name = getText(selector);
        if (name) break;
      }

      // Look for campaign description
      const descriptionSelectors = [
        '.mantine-Stack-root p:not(:empty)', 
        '.campaign-description:not(:empty)', 
        '.token-description:not(:empty)',
        '.mantine-Text-root:not(:empty)',
        '.mantine-Stack-root div:not(:empty)'
      ];

      let description = null;
      for (const selector of descriptionSelectors) {
        const text = getText(selector);
        if (text && text.length > 10 && !text.includes('$') && !text.includes('%') && !text.includes('Harvested fees')) {
          description = text;
          break;
        }
      }

      // Extract social links
      const socialLinks = {
        twitter: getAttribute('a[href*="twitter"], a[href*="x.com"]', 'href'),
        telegram: getAttribute('a[href*="telegram"], a[href*="t.me"]', 'href'),
        website: getAttribute('a[href*="http"]:not([href*="twitter"]):not([href*="telegram"])', 'href')
      };

      // Extract image URL
      const imageUrl = getAttribute('img[src*="http"]', 'src');

      // Extract token info
      const tokenInfo = {
        supply: null as string | null,
        mcap: null as string | null,
        target: null as string | null
      };

      // Look for token info in text content
      document.querySelectorAll('.mantine-Text-root').forEach(el => {
        const text = el.textContent || '';
        if (text.toLowerCase().includes('supply')) {
          const match = text.match(/supply\s*([0-9,]+)/i);
          if (match) {
            tokenInfo.supply = match[1];
          }
        } else if (text.toLowerCase().includes('mcap')) {
          const match = text.match(/mcap\s*\$?([0-9,.]+[KMB]?)/i);
          if (match) {
            tokenInfo.mcap = match[1];
          }
        } else if (text.toLowerCase().includes('target')) {
          const match = text.match(/target\s*\$?([0-9,.]+[KMB]?)/i);
          if (match) {
            tokenInfo.target = match[1];
          }
        }
      });

      return {
        name,
        description,
        socialLinks,
        imageUrl,
        addresses,
        tokenInfo,
        createdDate
      };
    });

    console.log('Extracted data:', data);

    const campaignData = {
      address,
      name: data.name || 'Unknown Campaign',
      description: data.description || 'No description available',
      socialLinks: {
        twitter: data.socialLinks.twitter || undefined,
        telegram: data.socialLinks.telegram || undefined,
        website: data.socialLinks.website || undefined
      },
      imageUrl: data.imageUrl || undefined,
      supply: data.tokenInfo.supply || undefined,
      mcap: data.tokenInfo.mcap || undefined,
      target: data.tokenInfo.target || undefined,
      createdDate: data.createdDate || undefined,
      ...data.addresses
    };

    console.log('Extracted campaign data:', campaignData);
    return campaignData;
  } catch (error) {
    console.error('Error extracting campaign data:', error);
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
    });
    
    return [...new Set(addresses)];
  } catch (error) {
    console.error('Error extracting token addresses:', error);
    return [];
  }
}

async function crawlGFM(command: Command) {
  if (!supabase) {
    console.error('Supabase client not initialized. Please check your environment variables.');
    return;
  }

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
    const { data: existingAddresses, error: queryError } = await supabase
      .from('meme_coins')
      .select('contract_address')
      .in('contract_address', addresses) as { data: MemeCoinsTable[] | null, error: Error | null };
    
    if (queryError) {
      console.error('Error fetching existing addresses:', queryError);
      return;
    }

    const processedAddresses = new Set(
      (existingAddresses || []).map((row: MemeCoinsTable) => row.contract_address)
    );
    const newAddresses = addresses.filter(addr => !processedAddresses.has(addr));
    
    console.log(`Found ${newAddresses.length} new addresses to process`);
    
    // Process each new address
    for (const address of newAddresses) {
      const campaignData = await extractCampaignData(page, address);
      if (!campaignData) continue;
      
      // Validate the token on Solscan
      const solscanData = await makeApiCall(`https://api.solscan.io/token/meta?token=${address}`);
      
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
  console.log('Starting test crawl...');
  
  if (!supabase) {
    console.error('Supabase client not initialized. Please check your environment variables.');
    return;
  }

  console.log('Supabase client initialized successfully');
  console.log('Launching browser...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    console.log('Creating new page...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to homepage...');
    await page.goto(GFM_URLS.homepage, { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');
    
    // Extract token addresses from the homepage
    console.log('Extracting token addresses...');
    const addresses = await extractTokenAddresses(page);
    console.log('Found addresses:', addresses);
    
    if (addresses.length > 0) {
      // Test with the first address
      const testAddress = addresses[0];
      console.log(`Testing with address: ${testAddress}`);
      
      console.log('Fetching campaign data...');
      const campaignData = await extractCampaignData(page, testAddress);
      console.log('Campaign data:', JSON.stringify(campaignData, null, 2));
      
      if (campaignData) {
        // Validate the token on Solscan
        console.log('Validating token on Solscan...');
        const solscanData = await makeApiCall(`https://api.solscan.io/token/meta?token=${testAddress}`);
        console.log('Solscan data:', JSON.stringify(solscanData, null, 2));
        
        // Store data in Supabase if available
        if (campaignData.name) {
          console.log('Storing data in Supabase...');
          const { error } = await supabase
            .from('meme_coins')
            .upsert({
              contract_address: testAddress,
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
            console.error('Error storing data in Supabase:', error);
          } else {
            console.log('Successfully stored data in Supabase');
          }
        } else {
          console.log('No campaign name found, skipping database storage');
        }
      } else {
        console.log('No campaign data found');
      }
    } else {
      console.log('No addresses found on the homepage');
    }
  } catch (error) {
    console.error('Error during test crawl:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Test crawl completed');
  }
}

program
  .command('test-crawl')
  .description('Test the crawler with a single token')
  .action(testCrawl);

program.parse(); 