import { EmailService } from '../services/EmailService';

async function main() {
  try {
    console.log('Testing email service...');
    
    const emailService = new EmailService();
    const testResults = {
      processed: 3,
      added: 0,
      errors: 0,
      skipped: 1,
      distributions_added: 0,
      distributions_updated: 9,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: 5000,
      error_details: []
    };

    await emailService.sendSyncReport(testResults, 'partial_success', 1.0);
    console.log('Test email sent successfully');
    
  } catch (error) {
    console.error('Failed to send test email:', error);
    process.exit(1);
  }
}

main(); 