import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DatabaseAdapter } from '../src/core/database';
import { SyncService } from '../src/services/SyncService';

const BATCH_SIZE = 5; // Process 5 campaigns at a time
const MAX_EXECUTION_TIME = 45000; // 45 seconds

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
      VERCEL_AUTH_TOKEN: !!process.env.VERCEL_AUTH_TOKEN
    });

    // Validate required environment variables
    if (!process.env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY is not set');
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
    if (!process.env.SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is not set');
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    
    // Initialize services
    const db = new DatabaseAdapter(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const syncService = new SyncService();
    
    // Check for recent syncs
    console.log('[4] Checking for recent syncs...');
    const { data: recentSync, error: historyError } = await db.supabase
      .from('sync_history')
      .select('*')
      .eq('status', 'processing')
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
        message: 'A sync is already in progress',
        syncId: recentSync.id
      });
    }

    // Create a new sync history record
    console.log('[5] Creating new sync history record...');
    const { data: newSync, error: createError } = await db.supabase
      .from('sync_history')
      .insert({
        start_time: new Date().toISOString(),
        status: 'processing',
        campaigns_processed: 0,
        campaigns_added: 0,
        distributions_added: 0,
        distributions_updated: 0,
        errors: 0,
        skipped: 0,
        duration_ms: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('[5a] Error creating sync history:', createError);
      throw createError;
    }

    // Start processing the first batch
    console.log('[6] Starting first batch...');
    
    try {
      const results = await syncService.syncBatch(BATCH_SIZE);
      console.log('[7] First batch completed:', results);

      // Update sync history
      console.log('[8] Updating sync history...');
      const { error: updateError } = await db.supabase
        .from('sync_history')
        .update({
          campaigns_processed: results.processed,
          campaigns_added: results.added,
          distributions_added: results.distributions_added,
          distributions_updated: results.distributions_updated,
          errors: results.errors,
          skipped: results.skipped,
          duration_ms: results.duration_ms,
          end_time: results.end_time,
          status: results.processed >= results.total ? 'completed' : 'processing',
          error_details: results.error_details
        })
        .eq('id', newSync.id);

      if (updateError) {
        console.error('[8a] Error updating sync history:', updateError);
        throw updateError;
      }

      // If there's more to process, schedule the next batch
      if (results.processed < results.total) {
        console.log('[9] Scheduling next batch...');
        // Schedule next batch via webhook
        const nextBatchUrl = `${process.env.VERCEL_URL}/api/sync-batch?token=${token}&syncId=${newSync.id}`;
        await fetch(nextBatchUrl, { method: 'POST' });
      }

      res.status(200).json({
        success: true,
        message: 'Sync batch processed',
        results,
        syncId: newSync.id
      });
    } catch (error) {
      console.error('[10] Sync batch error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Update sync history with error
      await db.supabase
        .from('sync_history')
        .update({
          status: 'error',
          error_details: [{
            type: 'BATCH_ERROR',
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }],
          end_time: new Date().toISOString()
        })
        .eq('id', newSync.id);

      throw error;
    }
  } catch (error) {
    console.error('[11] Sync endpoint error:', error);
    const errorDetails = {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      constructor: error?.constructor?.name
    };
    console.error('Error details:', errorDetails);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorDetails
    });
  }
} 