import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  FIRECRAWL_API_KEY: z.string(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().default('re_XcTeQX4t_3KQnDoRrhMJtk4iECb2U9w6F')
});

export const config = configSchema.parse({
  PORT: process.env.PORT,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY
});

export type Config = typeof config; 