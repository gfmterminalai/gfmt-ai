-- Create meme_coins table
CREATE TABLE IF NOT EXISTS meme_coins (
  contract_address TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  supply NUMERIC,
  developer_address TEXT,
  market_cap_on_launch NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create token_distributions table
CREATE TABLE IF NOT EXISTS token_distributions (
  id SERIAL PRIMARY KEY,
  contract_address TEXT REFERENCES meme_coins(contract_address),
  entity TEXT NOT NULL,
  percentage NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_address, entity)
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  contract_address TEXT REFERENCES meme_coins(contract_address),
  status TEXT NOT NULL,
  budget NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create developers table
CREATE TABLE IF NOT EXISTS developers (
  address TEXT PRIMARY KEY,
  reputation_score NUMERIC DEFAULT 0,
  total_projects INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 