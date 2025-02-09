declare module '@mendable/firecrawl-js' {
  export default class FireCrawlApp {
    constructor(options: { apiKey: string });
    mapUrl(url: string, options?: { includeSubdomains?: boolean; search?: string }): Promise<{ links: string[] }>;
    asyncExtract(urls: string[], options?: any): Promise<any>;
    getExtractStatus(jobId: string): Promise<any>;
  }
}

declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: {
        from: string;
        to: string;
        subject: string;
        text: string;
      }): Promise<{ data: any; error: any }>;
    };
  }
}

declare module '@vercel/node' {
  import { Request, Response } from 'express';
  export type VercelRequest = Request;
  export type VercelResponse = Response;
} 