-- Create meme_coins table
CREATE TABLE meme_coins (
  id BIGSERIAL PRIMARY KEY,
  contract_address TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  image_url TEXT,
  chain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  supply TEXT,
  mcap TEXT,
  target TEXT,
  dev_address TEXT,
  token_created_at TIMESTAMP WITH TIME ZONE
);

-- Create index on contract_address
CREATE INDEX idx_meme_coins_contract_address ON meme_coins(contract_address);

-- Create index on created_at
CREATE INDEX idx_meme_coins_created_at ON meme_coins(created_at);

-- Add RLS policies
ALTER TABLE meme_coins ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
ON meme_coins FOR SELECT
TO public
USING (true);

-- Allow authenticated insert/update
CREATE POLICY "Allow authenticated insert"
ON meme_coins FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
ON meme_coins FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true); 