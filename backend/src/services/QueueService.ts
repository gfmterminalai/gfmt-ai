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

  async queueSync(): Promise<QueueJob> {
    const job: QueueJob = {
      id: `sync-${Date.now()}`,
      type: 'sync',
      status: 'pending'
    }

    try {
      // Explicitly stringify the job before storing
      const jobString = JSON.stringify(job);
      console.log('Queueing job:', { job, jobString });
      
      // Store job in Redis list
      const result = await this.redis.lpush(this.QUEUE_KEY, jobString);
      console.log('Job queued with result:', result);
      return job;
    } catch (error) {
      console.error('Error queuing job:', error);
      throw error;
    }
  }

  async processNextJob(): Promise<void> {
    try {
      // Get next job from queue
      const jobString = await this.redis.rpop(this.QUEUE_KEY);
      if (!jobString) {
        console.log('No jobs in queue');
        return;
      }

      console.log('Retrieved job string from queue:', jobString);

      // Parse job data
      let job: QueueJob;
      try {
        job = JSON.parse(jobString);
        console.log('Parsed job data:', job);
      } catch (parseError) {
        console.error('Failed to parse job data:', { jobString, error: parseError });
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
        console.error('Error processing job:', { jobId: job.id, error });
        // Even if job fails, we don't requeue - the next cron run will create a new job
      }
    } catch (error) {
      console.error('Error in processNextJob:', error);
    }
  }

  async getJobStatus(jobId: string): Promise<string> {
    // For simplicity, we don't track individual job status
    // Just return 'completed' since the job is processed immediately
    return 'completed';
  }
} 