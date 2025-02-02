import { Router } from 'express';
import { DatabaseAdapter } from '../../core/database';
import { FirecrawlClient } from '../../clients/firecrawl';
import { FirecrawlExtraction } from '../../types/firecrawl';

export function createFirecrawlRoutes(db: DatabaseAdapter) {
  const router = Router();
  const firecrawl = new FirecrawlClient(process.env.FIRECRAWL_API_KEY!);

  // Extract and process from URL
  router.post('/extract', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      // Extract data from URL
      const extractedData = await firecrawl.extractFromUrl(url);
      
      // Process the extracted data
      const result = await db.processFirecrawlData(extractedData);
      
      res.status(201).json({ 
        success: true, 
        data: result,
        metadata: {
          extracted: extractedData
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Extract and process batch of URLs
  router.post('/extract-batch', async (req, res) => {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ success: false, error: 'URLs array is required' });
      }

      // Extract data from URLs
      const extractedData = await firecrawl.extractBatch(urls);
      
      // Process all extracted data
      const results = await db.processFirecrawlBatch(extractedData);
      
      res.status(201).json({ 
        success: true, 
        data: results,
        metadata: {
          processed: results.length,
          successful: results.filter(r => r.success).length
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Process raw extraction data
  router.post('/process', async (req, res) => {
    try {
      const data = req.body as FirecrawlExtraction;
      const result = await db.processFirecrawlData(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
} 