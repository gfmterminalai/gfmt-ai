import dotenv from 'dotenv';
import { DatabaseAdapter } from './core/database';
import { createAPI } from './api';

// Load environment variables
dotenv.config();

// Initialize database
const db = new DatabaseAdapter(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Create and start API server
const app = createAPI(db);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 