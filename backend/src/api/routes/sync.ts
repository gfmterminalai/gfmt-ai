import { Router } from 'express';
import { DatabaseAdapter } from '../../core/database';
import { SyncService } from '../services/SyncService';

export function createSyncRoutes(db: DatabaseAdapter) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const syncService = new SyncService();
      const results = await syncService.sync();
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error('Sync endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  return router;
} 