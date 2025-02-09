import express from 'express';
import cors from 'cors';
import { DatabaseAdapter } from '../core/database';
import { createMemeCoinRoutes } from './routes/memecoins';
import { createDeveloperRoutes } from './routes/developers';
import { createFirecrawlRoutes } from './routes/firecrawl';
import { createSyncRoutes } from './routes/sync';

export function createAPI(db: DatabaseAdapter) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Routes
  app.use('/memecoins', createMemeCoinRoutes(db));
  app.use('/developers', createDeveloperRoutes(db));
  app.use('/firecrawl', createFirecrawlRoutes(db));
  app.use('/sync', createSyncRoutes(db));

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  });

  return app;
} 