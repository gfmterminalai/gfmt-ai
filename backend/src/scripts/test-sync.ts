import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { QueueService } from '../services/QueueService';
import { SyncService } from '../services/SyncService';

async function main() {
  try {
    // Verify environment variables
    console.log('Verifying environment variables...');
    const requiredVars = [
      'FIRECRAWL_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RESEND_API_KEY'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
      console.log(`✓ ${varName} is set`);
    }

    // First check what URLs need processing
    console.log('\nChecking for new URLs to process...');
    const syncService = new SyncService();
    const urlsToProcess = await syncService.getUrlsToProcess();
    console.log(`Found ${urlsToProcess.length} URLs to process:`, urlsToProcess);

    if (urlsToProcess.length === 0) {
      console.log('No new URLs to process. Exiting...');
      return;
    }

    console.log('\nStarting local sync test...');
    const queueService = new QueueService();

    // Create parent job
    console.log('\nCreating sync job...');
    const job = await queueService.queueSync();
    console.log('Parent job created:', job);

    // Process jobs until queue is empty
    console.log('\nProcessing jobs...');
    let jobsProcessed = 0;
    let lastStatus = null;
    
    while (true) {
      const status = await queueService.getJobStatus(job.id);
      
      // Only log status if it changed
      if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
        console.log(`\nJob status (processed ${status.urls_processed || 0}/${status.urls_total || 0}):`);
        console.log(JSON.stringify(status, null, 2));
        lastStatus = status;
      }

      if (status.status === 'completed') {
        console.log('\nAll jobs completed successfully!');
        break;
      }

      if (status.status === 'failed') {
        console.log('\nJob failed:', status.error);
        break;
      }

      // Process next job
      const beforeQueueLength = await queueService.getQueueLength();
      console.log(`\nQueue length before processing: ${beforeQueueLength}`);
      
      await queueService.processNextJob();
      jobsProcessed++;

      const afterQueueLength = await queueService.getQueueLength();
      console.log(`Queue length after processing: ${afterQueueLength}`);

      // If queue is empty and parent job isn't complete, something went wrong
      if (afterQueueLength === 0 && status.status !== 'completed') {
        console.log('\nQueue is empty but parent job is not complete. Something went wrong.');
        break;
      }

      // Small delay to avoid hammering APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\nProcessed ${jobsProcessed} jobs`);
  } catch (error) {
    console.error('Error in test sync:', error);
    process.exit(1);
  }
}

main().catch(console.error); 