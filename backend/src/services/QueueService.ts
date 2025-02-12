import { Redis } from '@upstash/redis'
import { SyncService } from './SyncService'
import { EmailService } from './EmailService'
import { SyncResults } from './SyncService'

export interface QueueJob {
  id: string
  type: 'sync' | 'sync-batch'
  params: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  error?: string
  attempts?: number
  results?: SyncResults
}

export class QueueService {
  private redis: Redis
  private syncService: SyncService
  private emailService: EmailService
  private readonly MAX_ATTEMPTS = 3
  private readonly PROCESSING_TIMEOUT = 5 * 60 * 1000 // 5 minutes
  private readonly JOB_EXPIRY = 24 * 60 * 60 // 24 hours in seconds
  private readonly JOB_PREFIX = 'gfm:job:'
  private readonly QUEUE_KEY = 'gfm:queue'

  constructor() {
    console.log('Initializing QueueService with Redis URL:', process.env.UPSTASH_REDIS_REST_URL);
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    this.syncService = new SyncService()
    this.emailService = new EmailService()
  }

  private getJobKey(jobId: string): string {
    return `${this.JOB_PREFIX}${jobId}`;
  }

  private async createJob(type: QueueJob['type'], params: Record<string, any>): Promise<QueueJob> {
    const job: QueueJob = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      params,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0
    }

    const jobKey = this.getJobKey(job.id)
    console.log('Creating job:', { jobKey, job });
    
    try {
      // First, store the job data
      const hashData: Record<string, string> = {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        attempts: (job.attempts || 0).toString(),
        params: JSON.stringify(job.params)
      };

      // Store the hash data
      console.log('Storing job data in Redis:', { jobKey, hashData });
      const hsetResult = await this.redis.hset(jobKey, hashData);
      console.log('HSET result:', hsetResult);

      // Set expiry
      console.log('Setting job expiry:', { jobKey, expiry: this.JOB_EXPIRY });
      const expireResult = await this.redis.expire(jobKey, this.JOB_EXPIRY);
      console.log('EXPIRE result:', expireResult);

      // Add to queue
      console.log('Adding job to queue:', { queueKey: this.QUEUE_KEY, jobId: job.id });
      const pushResult = await this.redis.lpush(this.QUEUE_KEY, job.id);
      console.log('LPUSH result:', pushResult);

      // Return the job without verification
      return job;
    } catch (error) {
      console.error('Error creating job:', { error, jobKey, job });
      throw error;
    }
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    console.log('Getting job:', jobId);
    const jobKey = this.getJobKey(jobId);
    
    try {
      console.log('Fetching job data from Redis key:', jobKey);
      const hashData = await this.redis.hgetall(jobKey) as Record<string, string>;
      console.log('Raw Redis data:', hashData);
      
      if (!hashData || Object.keys(hashData).length === 0) {
        console.log('No job found for key:', jobKey);
        return null;
      }

      // Parse the job data, handling each field appropriately
      const job: QueueJob = {
        id: hashData.id || '',
        type: (hashData.type || 'sync') as 'sync' | 'sync-batch',
        status: (hashData.status || 'pending') as QueueJob['status'],
        createdAt: hashData.createdAt || new Date().toISOString(),
        updatedAt: hashData.updatedAt || new Date().toISOString(),
        attempts: parseInt(hashData.attempts || '0', 10),
        params: hashData.params ? JSON.parse(hashData.params) : {},
        error: hashData.error,
        results: hashData.results ? JSON.parse(hashData.results) : undefined
      };

      console.log('Parsed job data:', job);
      return job;
    } catch (error) {
      console.error('Error getting job:', { error, jobId, jobKey });
      return null;
    }
  }

  private async updateJob(jobId: string, updates: Partial<QueueJob>): Promise<void> {
    console.log('Updating job:', { jobId, updates });
    const jobKey = this.getJobKey(jobId);
    
    try {
      // Get current job data
      const currentJob = await this.getJob(jobId);
      if (!currentJob) {
        console.log('No job found to update');
        return;
      }

      // Prepare the update data
      const updatedJob = {
        ...currentJob,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Convert job data to hash format with proper serialization
      const hashData: Record<string, string> = {
        id: updatedJob.id,
        type: updatedJob.type,
        status: updatedJob.status,
        createdAt: updatedJob.createdAt,
        updatedAt: updatedJob.updatedAt,
        attempts: (updatedJob.attempts || 0).toString(),
        params: JSON.stringify(updatedJob.params)
      };

      if (updatedJob.error) {
        hashData.error = updatedJob.error;
      }

      if (updatedJob.results) {
        hashData.results = JSON.stringify(updatedJob.results);
      }

      // Update the hash
      console.log('Updating job data:', hashData);
      const hsetResult = await this.redis.hset(jobKey, hashData);
      console.log('HSET result:', hsetResult);

      // Reset expiry
      const expireResult = await this.redis.expire(jobKey, this.JOB_EXPIRY);
      console.log('EXPIRE result:', expireResult);

      // Verify the update
      const verifiedJob = await this.getJob(jobId);
      console.log('Update verification:', verifiedJob);
    } catch (error) {
      console.error('Error updating job:', { error, jobId, jobKey });
      throw error;
    }
  }

  private async handleStuckJobs(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.JOB_PREFIX}*`)
      console.log('Found job keys:', keys);
      
      for (const key of keys) {
        const jobId = key.replace(this.JOB_PREFIX, '')
        const job = await this.getJob(jobId)
        
        if (job?.status === 'processing') {
          const lastUpdateTime = new Date(job.updatedAt).getTime()
          const now = Date.now()
          
          if (now - lastUpdateTime > this.PROCESSING_TIMEOUT) {
            console.log(`Found stuck job: ${jobId}, last updated: ${job.updatedAt}`)
            
            if ((job.attempts || 0) < this.MAX_ATTEMPTS) {
              await this.updateJob(jobId, {
                status: 'pending',
                attempts: (job.attempts || 0) + 1,
                error: `Job timed out after ${this.PROCESSING_TIMEOUT / 1000} seconds`
              })
              await this.redis.lpush(this.QUEUE_KEY, jobId)
            } else {
              await this.updateJob(jobId, {
                status: 'failed',
                error: `Job failed after ${job.attempts} attempts`
              })

              if (job.type === 'sync' && job.results) {
                await this.emailService.sendSyncReport(job.results, 'failure')
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling stuck jobs:', error)
    }
  }

  async processNextJob(): Promise<void> {
    await this.handleStuckJobs()

    let currentJobId: string | null = null;
    
    try {
      currentJobId = await this.redis.rpop(this.QUEUE_KEY)
      if (!currentJobId) {
        console.log('No jobs in queue');
        return;
      }

      console.log('Processing job:', currentJobId);
      const job = await this.getJob(currentJobId)
      if (!job) {
        console.log('Job not found:', currentJobId);
        return;
      }

      await this.updateJob(job.id, { 
        status: 'processing',
        attempts: (job.attempts || 0) + 1
      })

      let results: SyncResults | undefined

      switch (job.type) {
        case 'sync':
          results = await this.syncService.sync()
          break
        case 'sync-batch':
          const { batchSize = 5, offset = 0 } = job.params
          results = await this.syncService.syncBatch(batchSize, offset)
          break
      }

      await this.updateJob(job.id, { 
        status: 'completed',
        results
      })

      if (job.type === 'sync' && results) {
        const status = results.errors === 0 ? 'success' : 
          results.processed > 0 ? 'partial_success' : 'failure'
        await this.emailService.sendSyncReport(results, status)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Job processing error:', error)

      if (currentJobId) {
        const job = await this.getJob(currentJobId)
        if (job) {
          if ((job.attempts || 0) < this.MAX_ATTEMPTS) {
            await this.updateJob(currentJobId, { 
              status: 'pending',
              error: errorMessage
            })
            await this.redis.lpush(this.QUEUE_KEY, currentJobId)
          } else {
            await this.updateJob(currentJobId, { 
              status: 'failed',
              error: `Failed after ${job.attempts} attempts. Last error: ${errorMessage}`
            })

            if (job.type === 'sync' && job.results) {
              await this.emailService.sendSyncReport(job.results, 'failure')
            }
          }
        }
      }
      throw error
    }
  }

  async queueSync(): Promise<QueueJob> {
    return this.createJob('sync', {})
  }

  async queueSyncBatch(batchSize: number, offset: number): Promise<QueueJob> {
    return this.createJob('sync-batch', { batchSize, offset })
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.getJob(jobId)
    return job?.status || null
  }
} 