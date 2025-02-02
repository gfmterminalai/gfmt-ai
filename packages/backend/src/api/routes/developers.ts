import { Router } from 'express';
import { DatabaseAdapter } from '../../core/database';

export function createDeveloperRoutes(db: DatabaseAdapter) {
  const router = Router();

  // Get all developers (paginated)
  router.get('/', async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const developers = await db.getDevelopersPaginated(Number(limit), Number(offset));
      res.json({ success: true, data: developers });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get a specific developer
  router.get('/:address', async (req, res) => {
    try {
      const developer = await db.getDeveloper(req.params.address);
      if (!developer) {
        return res.status(404).json({ success: false, error: 'Developer not found' });
      }
      res.json({ success: true, data: developer });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get top developers
  router.get('/top/by-rank', async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const developers = await db.getTopDevelopers(Number(limit));
      res.json({ success: true, data: developers });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get developers by reputation
  router.get('/top/by-reputation', async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const developers = await db.getDevelopersByReputation(Number(limit));
      res.json({ success: true, data: developers });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Search developers
  router.get('/search/:query', async (req, res) => {
    try {
      const developers = await db.searchDevelopers(req.params.query);
      res.json({ success: true, data: developers });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get developer stats
  router.get('/stats/overview', async (req, res) => {
    try {
      const stats = await db.getDevStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
} 