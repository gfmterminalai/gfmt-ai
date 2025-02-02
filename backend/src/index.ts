import express from 'express';
import cors from 'cors';
import { config } from './core/config';
import campaignsRouter from './routes/campaigns';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/campaigns', campaignsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const port = 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
}); 