import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DatabaseAdapter } from '../src/core/database';
import { QueueService } from '../src/services/QueueService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
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
    console.log('[1] Starting sync process...');
    console.log('[2] Environment check:', {
      FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      VERCEL_URL: process.env.VERCEL_URL,
      NODE_ENV: process.env.NODE_ENV,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      VERCEL_AUTH_TOKEN: !!process.env.VERCEL_AUTH_TOKEN,
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN
    });

    // Validate required environment variables
    if (!process.env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY is not set');
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
    if (!process.env.SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is not set');
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    if (!process.env.UPSTASH_REDIS_REST_URL) throw new Error('UPSTASH_REDIS_REST_URL is not set');
    if (!process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('UPSTASH_REDIS_REST_TOKEN is not set');
    
    // Initialize services
    const db = new DatabaseAdapter(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const queueService = new QueueService();
    
    // Check for recent syncs
    console.log('[4] Checking for recent syncs...');
    const { data: recentSync, error: historyError } = await db.supabase
      .from('sync_history')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
      
    if (historyError) {
      console.error('[4a] Error checking recent syncs:', historyError);
      if (historyError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw historyError;
      }
    }

    // If there's an active sync less than 5 minutes old, don't start a new one
    if (recentSync && 
        (new Date().getTime() - new Date(recentSync.start_time).getTime()) < 5 * 60 * 1000) {
      return res.status(409).json({
        success: false,
        message: 'A sync was recently started',
        syncId: recentSync.id
      });
    }

    // Queue the sync job
    console.log('[5] Queueing sync job...');
    const job = await queueService.queueSync();

    // Trigger the worker asynchronously without waiting
    console.log('[6] Triggering worker process...');
    queueService.processNextJob().catch(error => {
      console.error('[6a] Error triggering worker:', error);
    });

    // Return immediately with job ID
    res.status(202).json({
      success: true,
      message: 'Sync job queued and processing started',
      jobId: job.id,
      statusEndpoint: `/api/job-status?jobId=${job.id}`
    });
  } catch (error) {
    console.error('[7] Sync endpoint error:', error);
    console.error('[7a] Full error object:', JSON.stringify(error, null, 2));
    
    const errorDetails = {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorDetails
    });
  }
} 