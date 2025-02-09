import { Router } from 'express';
import { SyncService } from '../../services/SyncService';
import { DatabaseAdapter } from '../../core/database';

export function createSyncRoutes(db: DatabaseAdapter) {
  const router = Router();
  const syncService = new SyncService();

  router.post('/', async (req, res) => {
    try {
      const results = await syncService.sync();
      res.json({ success: true, results });
    } catch (error) {
      console.error('Sync failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
} 