import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QueueService } from '../src/services/QueueService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    res.status(400).json({ error: 'jobId is required' });
    return;
  }

  // Get token from Authorization header or query parameter
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.split(' ')[1];
  const queryToken = req.query.token as string;
  const token = headerToken || queryToken;
  
  if (!token || token !== process.env.VERCEL_AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    console.log('Checking status for job:', jobId);
    const queueService = new QueueService();
    
    // Get the actual Redis key that will be used
    const jobKey = `gfm:job:${jobId}`;
    console.log('Full Redis key:', jobKey);
    
    const job = await queueService.getJob(jobId);
    console.log('Job data from Redis:', job);

    if (!job) {
      console.log('No job found with key:', jobKey);
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.status(200).json({
      success: true,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error
      }
    });
  } catch (error) {
    console.error('Job status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 