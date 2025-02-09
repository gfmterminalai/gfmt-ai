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

-- Create developers table
CREATE TABLE developers (
  id BIGSERIAL PRIMARY KEY,
  dev_address TEXT NOT NULL UNIQUE,
  total_campaigns INTEGER DEFAULT 0,
  successful_campaigns INTEGER DEFAULT 0,
  total_volume DECIMAL DEFAULT 0,
  highest_market_cap DECIMAL DEFAULT 0,
  total_market_cap DECIMAL DEFAULT 0,
  reputation_score DECIMAL DEFAULT 0,
  rank INTEGER,
  best_performing_token TEXT REFERENCES meme_coins(contract_address),
  first_campaign_at TIMESTAMP WITH TIME ZONE,
  last_campaign_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on dev_address
CREATE INDEX idx_developers_dev_address ON developers(dev_address);

-- Create index on rank
CREATE INDEX idx_developers_rank ON developers(rank);

-- Create index on reputation_score
CREATE INDEX idx_developers_reputation_score ON developers(reputation_score);

-- Add foreign key to meme_coins table
ALTER TABLE meme_coins
ADD CONSTRAINT fk_developer
FOREIGN KEY (dev_address) 
REFERENCES developers(dev_address);

-- Create function to update developer stats
CREATE OR REPLACE FUNCTION update_developer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert developer if not exists
  INSERT INTO developers (dev_address)
  VALUES (NEW.dev_address)
  ON CONFLICT (dev_address) DO NOTHING;

  -- Update developer stats
  WITH dev_stats AS (
    SELECT 
      dev_address,
      COUNT(*) as total_campaigns,
      COUNT(CASE WHEN mcap::DECIMAL > 0 THEN 1 END) as successful_campaigns,
      SUM(COALESCE(NULLIF(mcap, '')::DECIMAL, 0)) as total_market_cap,
      MAX(COALESCE(NULLIF(mcap, '')::DECIMAL, 0)) as highest_market_cap,
      MIN(created_at) as first_campaign_at,
      MAX(created_at) as last_campaign_at
    FROM meme_coins
    WHERE dev_address = NEW.dev_address
    GROUP BY dev_address
  )
  UPDATE developers d
  SET 
    total_campaigns = dev_stats.total_campaigns,
    successful_campaigns = dev_stats.successful_campaigns,
    total_market_cap = dev_stats.total_market_cap,
    highest_market_cap = dev_stats.highest_market_cap,
    first_campaign_at = dev_stats.first_campaign_at,
    last_campaign_at = dev_stats.last_campaign_at,
    -- Reputation score algorithm:
    -- 40% weight on success rate
    -- 30% weight on highest market cap
    -- 20% weight on total market cap
    -- 10% weight on number of campaigns
    reputation_score = (
      (dev_stats.successful_campaigns::DECIMAL / NULLIF(dev_stats.total_campaigns, 0) * 0.4) +
      (CASE 
        WHEN dev_stats.highest_market_cap > 0 
        THEN (LN(dev_stats.highest_market_cap) / 20) * 0.3 
        ELSE 0 
      END) +
      (CASE 
        WHEN dev_stats.total_market_cap > 0 
        THEN (LN(dev_stats.total_market_cap) / 25) * 0.2 
        ELSE 0 
      END) +
      (CASE 
        WHEN dev_stats.total_campaigns > 0 
        THEN (LN(dev_stats.total_campaigns) / 3) * 0.1 
        ELSE 0 
      END)
    ) * 100,
    updated_at = NOW()
  FROM dev_stats
  WHERE d.dev_address = dev_stats.dev_address;

  -- Update ranks
  WITH ranked_developers AS (
    SELECT 
      dev_address,
      ROW_NUMBER() OVER (ORDER BY highest_market_cap DESC) as new_rank
    FROM developers
  )
  UPDATE developers d
  SET rank = rd.new_rank
  FROM ranked_developers rd
  WHERE d.dev_address = rd.dev_address;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update developer stats
CREATE TRIGGER update_developer_stats_trigger
AFTER INSERT OR UPDATE ON meme_coins
FOR EACH ROW
EXECUTE FUNCTION update_developer_stats();

-- Add RLS policies for developers table
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to developers
CREATE POLICY "Allow public read access on developers"
ON developers FOR SELECT
TO public
USING (true);

-- Allow authenticated insert/update on developers
CREATE POLICY "Allow authenticated insert on developers"
ON developers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on developers"
ON developers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true); 