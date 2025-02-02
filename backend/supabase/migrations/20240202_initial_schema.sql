-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create meme_coins table
CREATE TABLE IF NOT EXISTS meme_coins (
  contract_address TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  supply NUMERIC,
  developer_address TEXT,
  market_cap_on_launch NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meme_coins_developer_address ON meme_coins(developer_address);
CREATE INDEX IF NOT EXISTS idx_token_distributions_contract_address ON token_distributions(contract_address);
CREATE INDEX IF NOT EXISTS idx_campaigns_contract_address ON campaigns(contract_address);
CREATE INDEX IF NOT EXISTS idx_developers_reputation ON developers(reputation_score DESC); 