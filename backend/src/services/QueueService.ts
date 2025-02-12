import { Redis } from '@upstash/redis'
import { SyncService } from './SyncService'

export interface QueueJob {
  id: string
  type: 'sync' | 'sync-batch'
  params: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  error?: string
  attempts?: number
  [key: string]: unknown
}

export class QueueService {
  private redis: Redis
  private syncService: SyncService
  private readonly MAX_ATTEMPTS = 3
  private readonly PROCESSING_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    this.syncService = new SyncService()
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

    await this.redis.hset(`job:${job.id}`, { ...job, params: JSON.stringify(job.params) })
    await this.redis.lpush('job_queue', job.id)
    return job
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    const job = await this.redis.hgetall(`job:${jobId}`)
    if (!job) return null
    
    try {
      return {
        ...job,
        params: job.params ? JSON.parse(job.params as string) : {},
        attempts: parseInt(job.attempts as string) || 0
      } as QueueJob
    } catch (error) {
      console.error('Error parsing job params:', error)
      return job as QueueJob
    }
  }

  private async updateJob(jobId: string, updates: Partial<QueueJob>): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job) return

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString(),
      params: JSON.stringify(updates.params || job.params)
    }

    await this.redis.hset(`job:${jobId}`, updatedJob as Record<string, unknown>)
  }

  private async handleStuckJobs(): Promise<void> {
    try {
      const jobs = await this.redis.keys('job:*')
      for (const jobKey of jobs) {
        const jobId = jobKey.replace('job:', '')
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
              await this.redis.lpush('job_queue', jobId)
            } else {
              await this.updateJob(jobId, {
                status: 'failed',
                error: `Job failed after ${job.attempts} attempts`
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling stuck jobs:', error)
    }
  }

  async processNextJob(): Promise<void> {
    // First, handle any stuck jobs
    await this.handleStuckJobs()

    const jobId = await this.redis.rpop('job_queue')
    if (!jobId) return

    const job = await this.getJob(jobId)
    if (!job) return

    try {
      await this.updateJob(job.id, { 
        status: 'processing',
        attempts: (job.attempts || 0) + 1
      })

      switch (job.type) {
        case 'sync':
          await this.syncService.sync()
          break
        case 'sync-batch':
          const { batchSize = 5, offset = 0 } = job.params
          await this.syncService.syncBatch(batchSize, offset)
          break
      }

      await this.updateJob(job.id, { status: 'completed' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Job ${job.id} failed:`, errorMessage)

      if ((job.attempts || 0) < this.MAX_ATTEMPTS) {
        await this.updateJob(job.id, { 
          status: 'pending',
          error: errorMessage
        })
        await this.redis.lpush('job_queue', job.id)
      } else {
        await this.updateJob(job.id, { 
          status: 'failed',
          error: `Failed after ${job.attempts} attempts. Last error: ${errorMessage}`
        })
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