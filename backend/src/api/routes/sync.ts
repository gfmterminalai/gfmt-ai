import { Router } from 'express';
import { SyncService } from '../../services/SyncService';
import { DatabaseAdapter } from '../../core/database';
import { config } from '../../core/config';

export function createSyncRoutes(db: DatabaseAdapter) {
  const router = Router();
  const syncService = new SyncService();

  router.post('/', async (req, res) => {
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
      console.log('Starting sync process...');
      console.log('Environment:', {
        FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV
      });

      const results = await syncService.sync();
      console.log('Sync completed:', results);
      
      res.json({ 
        success: true, 
        results,
        source: 'manual'
      });
    } catch (error) {
      console.error('Sync failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : undefined
      });
    }
  });

  return router;
} 