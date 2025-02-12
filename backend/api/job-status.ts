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
    const status = await queueService.getJobStatus(jobId);

    res.status(200).json({
      success: true,
      job: {
        id: jobId,
        status
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