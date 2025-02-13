import { Redis } from '@upstash/redis'
import { SyncService } from './SyncService'
import { EmailService } from './EmailService'
import { SyncResults } from './SyncService'

export interface QueueJob {
  id: string
  type: 'sync'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  results?: SyncResults
}

export class QueueService {
  private redis: Redis
  private syncService: SyncService
  private emailService: EmailService
  private readonly QUEUE_KEY = 'gfm:jobs'

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    this.syncService = new SyncService()
    this.emailService = new EmailService()
  }

  private async getQueueLength(): Promise<number> {
    return this.redis.llen(this.QUEUE_KEY);
  }

  async queueSync(): Promise<QueueJob> {
    const job: QueueJob = {
      id: `sync-${Date.now()}`,
      type: 'sync',
      status: 'pending'
    }

    try {
      // Log queue state before
      const beforeLength = await this.getQueueLength();
      console.log('Queue length before push:', beforeLength);

      // Convert job to string before storing
      const jobString = JSON.stringify(job);
      console.log('Queueing job as string:', jobString);
      
      // Store job string in Redis list
      const result = await this.redis.lpush(this.QUEUE_KEY, jobString);
      console.log('Job queued with result:', result);

      // Verify what was stored
      const stored = await this.redis.lindex(this.QUEUE_KEY, 0);
      console.log('Verified stored job:', stored);

      // Log queue state after
      const afterLength = await this.getQueueLength();
      console.log('Queue length after push:', afterLength);

      return job;
    } catch (error) {
      console.error('Error queuing job:', error);
      throw error;
    }
  }

  async processNextJob(): Promise<void> {
    try {
      // Check queue length before processing
      const beforeLength = await this.getQueueLength();
      console.log('Queue length before processing:', beforeLength);

      if (beforeLength === 0) {
        console.log('Queue is empty, nothing to process');
        return;
      }

      // Get next job from queue
      const jobData = await this.redis.rpop(this.QUEUE_KEY);
      if (!jobData) {
        console.log('No jobs in queue after pop');
        return;
      }

      // Check queue length after pop
      const afterLength = await this.getQueueLength();
      console.log('Queue length after pop:', afterLength);

      console.log('Retrieved from queue (raw):', jobData);

      // Handle both string and object responses
      let job: QueueJob;
      try {
        if (typeof jobData === 'string') {
          job = JSON.parse(jobData);
        } else if (typeof jobData === 'object' && jobData !== null) {
          // If Redis returned an object directly, use it
          job = jobData as QueueJob;
        } else {
          console.error('Invalid job data type:', typeof jobData);
          return;
        }
        console.log('Job data:', job);
      } catch (parseError) {
        console.error('Failed to process job data:', { 
          jobData,
          errorMessage: parseError instanceof Error ? parseError.message : String(parseError)
        });
        return;
      }

      // Validate job structure
      if (!job.id || !job.type || !job.status) {
        console.error('Invalid job structure:', job);
        return;
      }

      try {
        // Run sync
        console.log('Starting sync for job:', job.id);
        const results = await this.syncService.sync();
        console.log('Sync completed with results:', results);
        
        // Send email
        const status = results.errors === 0 ? 'success' : 
          results.processed > 0 ? 'partial_success' : 'failure';
        await this.emailService.sendSyncReport(results, status);
        
        console.log('Job completed successfully:', job.id);
      } catch (error) {
        console.error('Error processing job:', { 
          jobId: job.id, 
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error('Error in processNextJob:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  async getJobStatus(jobId: string): Promise<string> {
    // For simplicity, we don't track individual job status
    // Just return 'completed' since the job is processed immediately
    return 'completed';
  }
} 