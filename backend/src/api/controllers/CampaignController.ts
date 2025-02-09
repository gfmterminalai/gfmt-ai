import { Request, Response } from 'express';
import { CampaignService } from '../../services/CampaignService';
import { CampaignFilters } from '../types/campaign';

export class CampaignController {
  private campaignService: CampaignService;

  constructor() {
    this.campaignService = new CampaignService();
  }

  async mapCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const campaignUrls = await this.campaignService.mapCampaignUrls();
      res.json({
        success: true,
        total: campaignUrls.length,
        urls: campaignUrls
      });
    } catch (error) {
      console.error('Failed to map campaign URLs:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to map campaign URLs'
      });
    }
  }

  async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { contractAddress } = req.params;
      const campaign = await this.campaignService.getCampaign(contractAddress);
      
      if (!campaign) {
        res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
        return;
      }

      res.json({
        success: true,
        campaign
      });
    } catch (error) {
      console.error('Failed to get campaign:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get campaign'
      });
    }
  }

  async getCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const filters: CampaignFilters = {};
      
      // Parse query parameters
      if (req.query.developerAddress) {
        filters.developerAddress = req.query.developerAddress as string;
      }
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.minMarketCap) {
        filters.minMarketCap = Number(req.query.minMarketCap);
      }
      if (req.query.maxMarketCap) {
        filters.maxMarketCap = Number(req.query.maxMarketCap);
      }

      const campaigns = await this.campaignService.getCampaigns(filters);
      res.json({
        success: true,
        total: campaigns.length,
        campaigns
      });
    } catch (error) {
      console.error('Failed to get campaigns:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get campaigns'
      });
    }
  }

  async reconcileCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.campaignService.reconcileCampaigns();
      res.json({
        success: true,
        message: 'Reconciliation completed',
        stats: result
      });
    } catch (error) {
      console.error('Reconciliation failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reconcile campaigns'
      });
    }
  }
} 