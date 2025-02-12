import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QueueService } from '../src/services/QueueService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
    const queueService = new QueueService();
    await queueService.processNextJob();

    // Schedule next worker invocation if there might be more jobs
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const nextWorkerUrl = `${baseUrl}/api/worker?token=${token}`;
    
    await fetch(nextWorkerUrl, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Worker processed next job'
    });
  } catch (error) {
    console.error('Worker error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 