import { FirecrawlExtraction } from '../types/firecrawl';

export const TEST_CAMPAIGN_URLS = [
  'https://www.gofundmeme.io/campaigns/9QqtYGAJUmgctBUgZCjxcx8yjSNBjkXdxpByuumSVsHC',
  'https://www.gofundmeme.io/campaigns/AqEvCfY4Bnpkh35ue3KxXY95DLetmV8APjkN9ivCJ453',
  'https://www.gofundmeme.io/campaigns/EwU2YqhrrSzf3dqxErqfVvpB5mJBrby3dycUNugLoR3z'
];

export const TEST_CAMPAIGN_EXTRACTIONS: FirecrawlExtraction[] = [
  {
    json: {
      title: '$Yeezy',
      supply: '1000000000',
      ticker: '$Yeezy',
      contract_address: '9QqtYGAJUmgctBUgZCjxcx8yjSNBjkXdxpByuumSVsHC',
      developer_address: 'VPtSdieQaAxe2bVVtsdojbEZsGW4T1beNCnPyS6DKKf',
      token_distribution: [
        { entity: 'liquidity pool', percentage: 50 },
        { entity: 'presalers', percentage: 50 }
      ],
      market_cap_on_launch: 6193,
      created_at: '2025-02-03T03:57:00Z',
      description: 'Yeezy token launch',
      social_links: [
        'https://x.com/AiggyAgent',
        'https://aiggy.fun/',
        'https://twitter.com/search?q=$COINY'
      ]
    },
    metadata: {
      title: '$Yeezy',
      description: 'Yeezy token launch',
      sourceURL: 'https://www.gofundmeme.io/campaigns/9QqtYGAJUmgctBUgZCjxcx8yjSNBjkXdxpByuumSVsHC',
      statusCode: 200
    }
  },
  {
    json: {
      title: '$Neural',
      supply: '1000000000',
      ticker: 'Neural',
      contract_address: 'AqEvCfY4Bnpkh35ue3KxXY95DLetmV8APjkN9ivCJ453',
      developer_address: 'Haee7H5bKDCnm6dXLkeR9DcWw9Puhnkwk71QBUSHcpUt',
      token_distribution: [
        { entity: 'liquidity pool', percentage: 94.25 },
        { entity: 'presalers', percentage: 5.75 }
      ],
      market_cap_on_launch: 1095,
      created_at: '2025-01-31T16:30:00Z',
      description: 'Neural token launch',
      social_links: [
        'https://twitter.com/search?q=$DEI',
        'https://solscan.io/token/ArECPqsodPqTfVm7k2Fe7NRTxNUf8mcS4N2X9mVYrwCA'
      ]
    },
    metadata: {
      title: '$Neural',
      description: 'Neural token launch',
      sourceURL: 'https://www.gofundmeme.io/campaigns/AqEvCfY4Bnpkh35ue3KxXY95DLetmV8APjkN9ivCJ453',
      statusCode: 200
    }
  },
  {
    json: {
      title: '$Neural',
      supply: '1000000',
      ticker: 'Neural',
      contract_address: 'EwU2YqhrrSzf3dqxErqfVvpB5mJBrby3dycUNugLoR3z',
      developer_address: 'GRL3Z4TnSQTnBedRd1nB1i5AUqaic4Tn7boSxHd9Jd2p',
      token_distribution: [
        { entity: 'liquidity pool', percentage: 75 },
        { entity: 'presalers', percentage: 25 }
      ],
      market_cap_on_launch: 6879,
      created_at: '2025-01-27T19:52:00Z',
      description: 'Neural token launch',
      social_links: []
    },
    metadata: {
      title: '$Neural',
      description: 'Neural token launch',
      sourceURL: 'https://www.gofundmeme.io/campaigns/EwU2YqhrrSzf3dqxErqfVvpB5mJBrby3dycUNugLoR3z',
      statusCode: 200
    }
  }
]; 