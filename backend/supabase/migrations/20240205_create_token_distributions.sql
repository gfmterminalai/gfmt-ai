-- Create token_distributions table
CREATE TABLE IF NOT EXISTS token_distributions (
  id SERIAL PRIMARY KEY,
  contract_address TEXT NOT NULL REFERENCES meme_coins(contract_address),
  entity TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_address, entity)
); 