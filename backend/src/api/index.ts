import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { DatabaseAdapter } from '../core/database';
import { createMemeCoinRoutes } from './routes/memecoins';
import { createDeveloperRoutes } from './routes/developers';
import { createFirecrawlRoutes } from './routes/firecrawl';

export function createAPI(db: DatabaseAdapter) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(json());

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  // API version prefix
  const apiRouter = express.Router();
  app.use('/api/v1', apiRouter);

  // Routes
  apiRouter.use('/memecoins', createMemeCoinRoutes(db));
  apiRouter.use('/developers', createDeveloperRoutes(db));
  apiRouter.use('/firecrawl', createFirecrawlRoutes(db));

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