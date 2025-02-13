import { Redis } from '@upstash/redis'
import { SyncService } from './SyncService'
import { EmailService } from './EmailService'
import { SyncResults } from './SyncService'

export interface QueueJob {
  id: string
  type: 'sync' | 'url_sync'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  results?: SyncResults
  retry_count?: number
  url?: string
  parent_job_id?: string
  urls_total?: number
  urls_processed?: number
  queued_at?: string
}

export class QueueService {
  private redis: Redis
  private syncService: SyncService
  private emailService: EmailService
  private readonly QUEUE_KEY = 'gfm:jobs'
  private readonly BATCH_SIZE = 5

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    this.syncService = new SyncService()
    this.emailService = new EmailService()
  }

  async queueSync(): Promise<QueueJob> {
    // Create parent job
    const parentJob: QueueJob = {
      id: `sync-${Date.now()}`,
      type: 'sync',
      status: 'pending',
      urls_processed: 0,
      queued_at: new Date().toISOString()
    }

    try {
      // Get all URLs first
      const urls = await this.syncService.getUrlsToProcess();
      parentJob.urls_total = urls.length;

      console.log(`[Queue] Found ${urls.length} URLs to process`);
      
      // Store parent job
      const parentJobString = JSON.stringify(parentJob);
      await this.redis.set(`job:${parentJob.id}`, parentJobString);
      console.log('[Queue] Parent job created:', parentJobString);

      // Create child jobs for each URL in batches
      for (let i = 0; i < urls.length; i += this.BATCH_SIZE) {
        const batchUrls = urls.slice(i, i + this.BATCH_SIZE);
        
        // Create jobs for this batch
        for (const url of batchUrls) {
          const urlJob: QueueJob = {
            id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'url_sync',
            status: 'pending',
            url,
            parent_job_id: parentJob.id
          };
          
          const jobString = JSON.stringify(urlJob);
          await this.redis.lpush(this.QUEUE_KEY, jobString);
          await this.redis.set(`job:${urlJob.id}`, jobString);
        }
      }

      const queueLength = await this.redis.llen(this.QUEUE_KEY);
      console.log('[Queue] All URL jobs queued, queue length:', queueLength);

      return parentJob;
    } catch (error) {
      console.error('[Queue] Error queuing sync jobs:', error);
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

      // Parse job data
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

      try {
        if (job.type === 'url_sync' && job.url) {
          // Process single URL
          console.log(`[Worker] Processing URL: ${job.url}`);
          const results = await this.syncService.syncUrl(job.url);
          
          // Update URL job status
          await this.redis.set(`job:${job.id}`, JSON.stringify({ 
            ...job, 
            status: 'completed',
            completed_at: new Date().toISOString(),
            results 
          }));

          // Update parent job progress
          if (job.parent_job_id) {
            const parentJobData = await this.redis.get(`job:${job.parent_job_id}`);
            if (parentJobData && typeof parentJobData === 'string') {
              const parentJob = JSON.parse(parentJobData);
              parentJob.urls_processed = (parentJob.urls_processed || 0) + 1;
              
              // Check if all URLs are processed
              if (parentJob.urls_processed === parentJob.urls_total) {
                parentJob.status = 'completed';
                parentJob.completed_at = new Date().toISOString();
                
                // Aggregate results from all URL jobs
                const allResults = {
                  processed: 0,
                  added: 0,
                  errors: 0,
                  skipped: 0,
                  distributions_added: 0,
                  distributions_updated: 0,
                  start_time: parentJob.queued_at,
                  end_time: parentJob.completed_at,
                  duration_ms: new Date(parentJob.completed_at).getTime() - new Date(parentJob.queued_at).getTime(),
                  error_details: [] as Array<{ type: string; message: string; timestamp: string }>,
                  total: parentJob.urls_total
                };

                // Add this job's results
                allResults.processed += results.processed;
                allResults.added += results.added;
                allResults.errors += results.errors;
                allResults.skipped += results.skipped;
                allResults.distributions_added += results.distributions_added;
                allResults.distributions_updated += results.distributions_updated;
                allResults.error_details.push(...results.error_details);

                // Send email with aggregated results
                const status = allResults.errors === 0 ? 'success' : 
                  allResults.processed > 0 ? 'partial_success' : 'failure';
                await this.emailService.sendSyncReport(allResults, status);
              }
              
              await this.redis.set(`job:${job.parent_job_id}`, JSON.stringify(parentJob));
            }
          }
        }
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
        
        // Retry logic for URL jobs
        if (job.type === 'url_sync') {
          const jobString = JSON.stringify({ ...job, retry_count: (job.retry_count || 0) + 1 });
          if (!job.retry_count || job.retry_count < 3) {
            await this.redis.lpush(this.QUEUE_KEY, jobString);
            console.log('[Worker] URL job pushed back to queue for retry');
          } else {
            console.log('[Worker] URL job failed after maximum retries');
          }
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
      const job = JSON.parse(jobData);
      
      // If it's a parent job, include progress
      if (job.type === 'sync') {
        return {
          ...job,
          progress: job.urls_processed && job.urls_total 
            ? Math.round((job.urls_processed / job.urls_total) * 100) 
            : 0
        };
      }
      
      return job;
    } catch (error) {
      console.error('[Queue] Error getting job status:', error);
      throw error;
    }
  }

  async getQueueLength(): Promise<number> {
    try {
      return await this.redis.llen(this.QUEUE_KEY);
    } catch (error) {
      console.error('[Queue] Error getting queue length:', error);
      throw error;
    }
  }
} 