-- Create enum for sync status
CREATE TYPE sync_status AS ENUM ('success', 'failure', 'partial_success');

-- Create table for sync history
CREATE TABLE sync_history (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER NOT NULL,
    status sync_status NOT NULL,
    campaigns_processed INTEGER NOT NULL DEFAULT 0,
    campaigns_added INTEGER NOT NULL DEFAULT 0,
    distributions_added INTEGER NOT NULL DEFAULT 0,
    distributions_updated INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on start_time for efficient querying
CREATE INDEX idx_sync_history_start_time ON sync_history(start_time);

-- Create function to check for missed syncs
CREATE OR REPLACE FUNCTION check_missed_syncs()
RETURNS TABLE (
    last_sync_time TIMESTAMP WITH TIME ZONE,
    hours_since_last_sync DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.start_time as last_sync_time,
        EXTRACT(EPOCH FROM (NOW() - sh.start_time))/3600 as hours_since_last_sync
    FROM sync_history sh
    ORDER BY sh.start_time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 