import { Router } from 'express';
import { DatabaseAdapter } from '../../core/database';

export function createMemeCoinRoutes(db: DatabaseAdapter) {
  const router = Router();

  // Get all meme coins
  router.get('/', async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const coins = await db.getMemeCoinsPaginated(Number(limit), Number(offset));
      res.json({ success: true, data: coins });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get a specific meme coin
  router.get('/:address', async (req, res) => {
    try {
      const coin = await db.getMemeCoin(req.params.address);
      if (!coin) {
        return res.status(404).json({ success: false, error: 'Meme coin not found' });
      }
      res.json({ success: true, data: coin });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get meme coins by developer
  router.get('/by-developer/:address', async (req, res) => {
    try {
      const coins = await db.getMemeCoinsByDev(req.params.address);
      res.json({ success: true, data: coins });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Create a new meme coin
  router.post('/', async (req, res) => {
    try {
      const coin = await db.insertMemeCoin(req.body);
      res.status(201).json({ success: true, data: coin });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Update a meme coin
  router.patch('/:address', async (req, res) => {
    try {
      const coin = await db.updateMemeCoin(req.params.address, req.body);
      if (!coin) {
        return res.status(404).json({ success: false, error: 'Meme coin not found' });
      }
      res.json({ success: true, data: coin });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
} 