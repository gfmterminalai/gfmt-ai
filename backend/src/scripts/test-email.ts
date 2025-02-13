import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { EmailService } from '../services/EmailService';

async function main() {
  try {
    // Verify RESEND_API_KEY is set
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Missing required environment variable: RESEND_API_KEY');
    }
    console.log('✓ RESEND_API_KEY is set');

    const emailService = new EmailService();
    
    // Create test sync results
    const testResults = {
      processed: 5,
      added: 3,
      errors: 1,
      skipped: 1,
      distributions_added: 6,
      distributions_updated: 0,
      start_time: new Date(Date.now() - 5000).toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: 5000,
      error_details: [{
        type: 'TEST_ERROR',
        message: 'This is a test error',
        timestamp: new Date().toISOString()
      }],
      total: 5
    };

    console.log('\nSending test sync report email...');
    await emailService.sendSyncReport(testResults, 'partial_success');
    console.log('Test email sent successfully!');
  } catch (error) {
    console.error('Error in test email:', error);
    process.exit(1);
  }
}

main().catch(console.error); 