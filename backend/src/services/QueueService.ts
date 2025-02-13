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
  retry_count?: number
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

  async queueSync(): Promise<QueueJob> {
    const job: QueueJob = {
      id: `sync-${Date.now()}`,
      type: 'sync',
      status: 'pending'
    }

    try {
      // Convert job to string before storing
      const jobString = JSON.stringify(job);
      console.log('[Queue] Queueing job as string:', jobString);
      
      // Store job string in Redis list
      await this.redis.lpush(this.QUEUE_KEY, jobString);
      const queueLength = await this.redis.llen(this.QUEUE_KEY);
      console.log('[Queue] Job queued, queue length:', queueLength);

      // Store job status separately for tracking
      await this.redis.set(`job:${job.id}`, JSON.stringify({ ...job, queued_at: new Date().toISOString() }));
      console.log('[Queue] Job status stored separately for tracking');

      return job;
    } catch (error) {
      console.error('[Queue] Error queuing job:', error);
      throw error;
    }
  }

  async processNextJob(): Promise<void> {
    try {
      console.log('[Worker] Attempting to process next job...');
      const jobData = await this.redis.rpop(this.QUEUE_KEY);
      
      if (!jobData) {
        console.log('[Worker] No jobs in queue');
        return;
      }

      console.log('[Worker] Retrieved from queue (raw):', jobData);

      // Handle both string and object responses
      let job: QueueJob;
      try {
        if (typeof jobData === 'string') {
          job = JSON.parse(jobData);
        } else if (typeof jobData === 'object' && jobData !== null) {
          job = jobData as QueueJob;
        } else {
          console.error('[Worker] Invalid job data type:', typeof jobData);
          return;
        }
        console.log('[Worker] Parsed job data:', job);
      } catch (parseError) {
        console.error('[Worker] Failed to process job data:', { 
          jobData,
          errorMessage: parseError instanceof Error ? parseError.message : String(parseError)
        });
        return;
      }

      // Update job status to processing
      await this.redis.set(`job:${job.id}`, JSON.stringify({ 
        ...job, 
        status: 'processing',
        processing_started_at: new Date().toISOString() 
      }));
      console.log('[Worker] Updated job status to processing');

      try {
        // Run sync
        console.log('[Worker] Starting sync for job:', job.id);
        const results = await this.syncService.sync();
        console.log('[Worker] Sync completed with results:', results);
        
        // Send email
        const status = results.errors === 0 ? 'success' : 
          results.processed > 0 ? 'partial_success' : 'failure';
        await this.emailService.sendSyncReport(results, status);
        
        // Update job status to completed
        await this.redis.set(`job:${job.id}`, JSON.stringify({ 
          ...job, 
          status: 'completed',
          completed_at: new Date().toISOString(),
          results 
        }));
        console.log('[Worker] Job completed successfully:', job.id);
      } catch (error) {
        console.error('[Worker] Error processing job:', { 
          jobId: job.id, 
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        
        // Update job status to failed
        await this.redis.set(`job:${job.id}`, JSON.stringify({ 
          ...job, 
          status: 'failed',
          failed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        }));
        
        // If processing fails, push the job back to the front of the queue for retry
        const jobString = JSON.stringify({ ...job, retry_count: (job.retry_count || 0) + 1 });
        if (!job.retry_count || job.retry_count < 3) {
          await this.redis.lpush(this.QUEUE_KEY, jobString);
          console.log('[Worker] Job pushed back to queue for retry');
        } else {
          console.log('[Worker] Job failed after maximum retries');
        }
      }
    } catch (error) {
      console.error('[Worker] Error in processNextJob:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const jobData = await this.redis.get(`job:${jobId}`);
      if (!jobData || typeof jobData !== 'string') {
        return { status: 'not_found' };
      }
      return JSON.parse(jobData);
    } catch (error) {
      console.error('[Queue] Error getting job status:', error);
      throw error;
    }
  }
} 