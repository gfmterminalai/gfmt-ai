import { EmailService } from '../services/EmailService';

async function main() {
  const emailService = new EmailService();

  const testResults = {
    processed: 10,
    added: 5,
    errors: 2,
    skipped: 3,
    distributions_added: 15,
    distributions_updated: 0,
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    duration_ms: 5000,
    total: 15,
    error_details: []
  };

  try {
    await emailService.sendSyncReport(testResults, 'partial_success', 1.0);
    console.log('Test email sent successfully');
  } catch (error) {
    console.error('Failed to send test email:', error);
  }
}

main().catch(console.error); 