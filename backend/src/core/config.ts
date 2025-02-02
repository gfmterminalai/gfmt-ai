import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.FIRECRAWL_API_KEY) {
  throw new Error('FIRECRAWL_API_KEY environment variable is required');
}

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
} as const;

export type Config = typeof config; 