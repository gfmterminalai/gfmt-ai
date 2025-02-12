import { EmailService } from '../services/EmailService';

async function main() {
  console.log('Starting email test...');
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
    error_details: [{
      type: 'TEST_ERROR',
      message: 'This is a test error message',
      timestamp: new Date().toISOString()
    }]
  };

  try {
    console.log('Attempting to send test email...');
    await emailService.sendSyncReport(testResults, 'partial_success', 1.0);
    console.log('Test email sent successfully');
  } catch (error) {
    console.error('Failed to send test email:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
}

main().catch(console.error); 