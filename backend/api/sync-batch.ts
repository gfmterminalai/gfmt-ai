import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DatabaseAdapter } from '../src/core/database';
import { SyncService } from '../src/services/SyncService';

const BATCH_SIZE = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, syncId } = req.query;
  
  if (!token || token !== process.env.VERCEL_AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!syncId) {
    res.status(400).json({ error: 'syncId is required' });
    return;
  }

  try {
    // Initialize services
    const db = new DatabaseAdapter(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const syncService = new SyncService();

    // Get current sync history
    const { data: syncHistory, error: historyError } = await db.supabase
      .from('sync_history')
      .select('*')
      .eq('id', syncId)
      .single();

    if (historyError) throw historyError;
    if (!syncHistory) {
      return res.status(404).json({ error: 'Sync history not found' });
    }

    // Don't process if sync is not in progress
    if (syncHistory.status !== 'processing') {
      return res.status(409).json({
        error: 'Sync is not in progress',
        status: syncHistory.status
      });
    }

    const results = await syncService.syncBatch(BATCH_SIZE, syncHistory.campaigns_processed);

    // Update sync history
    await db.supabase
      .from('sync_history')
      .update({
        campaigns_processed: syncHistory.campaigns_processed + results.processed,
        campaigns_added: syncHistory.campaigns_added + results.added,
        distributions_added: syncHistory.distributions_added + results.distributions_added,
        distributions_updated: syncHistory.distributions_updated + results.distributions_updated,
        errors: syncHistory.errors + results.errors,
        skipped: syncHistory.skipped + results.skipped,
        duration_ms: syncHistory.duration_ms + results.duration_ms,
        end_time: results.end_time,
        status: results.processed >= results.total ? 'completed' : 'processing',
        error_details: [
          ...(syncHistory.error_details || []),
          ...results.error_details
        ]
      })
      .eq('id', syncId);

    // If there's more to process, schedule next batch
    if (results.processed < results.total) {
      // Schedule next batch
      const nextBatchUrl = `${process.env.VERCEL_URL}/api/sync-batch?token=${token}&syncId=${syncId}`;
      await fetch(nextBatchUrl, { method: 'POST' });
    }

    res.status(200).json({
      success: true,
      message: 'Batch processed',
      results,
      isComplete: results.processed >= results.total
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update sync history with error
    if (syncId) {
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
        .eq('id', syncId);
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
} 