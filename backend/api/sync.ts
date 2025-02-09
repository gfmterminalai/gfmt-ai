import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DatabaseAdapter } from '../src/core/database';
import { SyncService } from '../src/services/SyncService';
import { config } from '../src/core/config';

// Initialize database adapter
const db = new DatabaseAdapter(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get token from Authorization header or query parameter
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.split(' ')[1]; // Extract token from "Bearer <token>"
  const queryToken = req.query.token as string;
  const token = headerToken || queryToken;
  
  if (!token || token !== process.env.VERCEL_AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const syncService = new SyncService();
    const results = await syncService.sync();
    
    res.status(200).json({
      success: true,
      results,
      source: 'manual'
    });
  } catch (error) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
} 