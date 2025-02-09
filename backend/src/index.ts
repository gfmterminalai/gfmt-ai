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
const port = 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
}); 