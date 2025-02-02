-- Add avatar_url column to meme_coins table
ALTER TABLE meme_coins
ADD COLUMN IF NOT EXISTS avatar_url TEXT; 