import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';

const router = Router();
const campaignController = new CampaignController();

// Map all campaign URLs
router.get('/map', (req, res) => campaignController.mapCampaigns(req, res));

// Get a specific campaign by contract address
router.get('/:contractAddress', (req, res) => campaignController.getCampaign(req, res));

// Get all campaigns with optional filters
router.get('/', (req, res) => campaignController.getCampaigns(req, res));

// Reconcile campaigns with website
router.post('/reconcile', (req, res) => campaignController.reconcileCampaigns(req, res));

export default router; 