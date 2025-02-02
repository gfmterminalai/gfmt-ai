-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    contract_address TEXT REFERENCES meme_coins(contract_address),
    price_usd NUMERIC NOT NULL,
    volume_24h NUMERIC,
    price_change_1h NUMERIC,
    price_change_6h NUMERIC,
    price_change_24h NUMERIC,
    price_change_5m NUMERIC,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL, -- Which API/source provided this data
    UNIQUE(contract_address, timestamp)
);

-- Create market_cap_history table
CREATE TABLE IF NOT EXISTS market_cap_history (
    id SERIAL PRIMARY KEY,
    contract_address TEXT REFERENCES meme_coins(contract_address),
    market_cap_usd NUMERIC NOT NULL,
    circulating_supply NUMERIC,
    total_supply NUMERIC,
    market_cap_change_24h NUMERIC,
    market_cap_change_7d NUMERIC,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    UNIQUE(contract_address, timestamp)
);

-- Create indexes for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_price_history_contract_time 
ON price_history(contract_address, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_time 
ON price_history(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_market_cap_history_contract_time 
ON market_cap_history(contract_address, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_market_cap_history_time 
ON market_cap_history(timestamp DESC);

-- Create a view for latest prices
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (contract_address)
    contract_address,
    price_usd,
    volume_24h,
    price_change_1h,
    price_change_6h,
    price_change_24h,
    price_change_5m,
    timestamp
FROM price_history
ORDER BY contract_address, timestamp DESC;

-- Create a view for latest market caps
CREATE OR REPLACE VIEW latest_market_caps AS
SELECT DISTINCT ON (contract_address)
    contract_address,
    market_cap_usd,
    circulating_supply,
    total_supply,
    market_cap_change_24h,
    market_cap_change_7d,
    timestamp
FROM market_cap_history
ORDER BY contract_address, timestamp DESC; 