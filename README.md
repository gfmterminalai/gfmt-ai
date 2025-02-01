# GFM Terminal

A command-line tool for crawling and analyzing GoFundMeme campaigns.

## Features

- Extracts campaign data from GoFundMeme
- Validates tokens on Solscan
- Stores data in Supabase database
- Extracts social links, images, and campaign details
- Tracks contract and developer addresses

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd gfm-terminal
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file with your Supabase credentials:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

4. Build the project:
```bash
pnpm build
```

## Usage

### Test Crawl
To test the crawler with a single token:
```bash
pnpm start test-crawl
```

### Full Crawl
To crawl all campaigns:
```bash
pnpm start crawl
```

## Database Schema

The project uses a Supabase database with the following schema:

```sql
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
```

## License

MIT 