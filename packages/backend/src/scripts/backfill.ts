import dotenv from 'dotenv';
import { DatabaseAdapter } from '../core/database';
import { FirecrawlClient } from '../clients/firecrawl';
import { BackfillService } from '../services/backfill';

// Load environment variables
dotenv.config();

async function main() {
  // Parse command line arguments
  const dryRun = process.argv.includes('--dry-run');
  const batchSize = Number(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10;

  // Initialize services
  const db = new DatabaseAdapter(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  
  const firecrawl = new FirecrawlClient(
    process.env.FIRECRAWL_API_KEY!
  );

  const backfillService = new BackfillService(firecrawl, db);

  try {
    await backfillService.backfillAllCampaigns({ dryRun, batchSize });
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main(); 