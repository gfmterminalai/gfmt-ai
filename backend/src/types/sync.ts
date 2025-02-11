export interface SyncResults {
  processed: number;
  added: number;
  errors: number;
  skipped: number;
  distributions_added: number;
  distributions_updated: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  total: number;
  error_details: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface SyncState {
  id: string;
  status: 'in_progress' | 'completed' | 'error';
  processed: number;
  total: number;
  errors: number;
  error_message?: string;
  start_time: string;
  last_processed_at?: string;
  created_at: string;
  updated_at: string;
} 