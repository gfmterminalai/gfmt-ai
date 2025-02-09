import { createClient } from '@supabase/supabase-js';
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