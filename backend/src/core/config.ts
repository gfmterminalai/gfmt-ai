import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  FIRECRAWL_API_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_PROJECT_ID: z.string().optional(),
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string(),
  VERCEL_AUTH_TOKEN: z.string().optional(),
  VERCEL_URL: z.string().optional()
});

export const config = configSchema.parse({
  PORT: process.env.PORT,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_PROJECT_ID: process.env.SUPABASE_PROJECT_ID,
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  VERCEL_AUTH_TOKEN: process.env.VERCEL_AUTH_TOKEN,
  VERCEL_URL: process.env.VERCEL_URL
});

export type Config = typeof config; 