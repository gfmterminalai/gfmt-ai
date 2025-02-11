import express from 'express';
import cors from 'cors';
import { config } from './core/config';
import campaignRoutes from './api/routes/campaignRoutes';
import { createSyncRoutes } from './api/routes/sync';
import { DatabaseAdapter } from './core/database';

const app = express();

// Initialize database adapter
const db = new DatabaseAdapter(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sync', createSyncRoutes(db));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const host = '0.0.0.0';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

try {
  console.log('Starting server...');
  console.log('Current directory:', process.cwd());
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: port,
    HOST: host,
    SUPABASE_URL: !!config.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!config.SUPABASE_ANON_KEY
  });
  
  const server = app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
    console.log('Available routes:');
    app._router.stack
      .filter((r: any) => r.route)
      .forEach((r: any) => {
        console.log(`${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
      });
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
} 