export interface Campaign {
  id?: string;
  contract_address: string;
  gofundmeme_url: string;
  ticker: string;
  created_at: Date;
  status: 'active' | 'completed' | 'failed';
  metadata?: {
    title?: string;
    description?: string;
    social_links?: {
      twitter?: string;
      telegram?: string;
      discord?: string;
    };
  };
} 