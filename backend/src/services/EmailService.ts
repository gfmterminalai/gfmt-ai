import { Resend } from 'resend';
import { SyncResults } from './SyncService';
import { config } from '../core/config';

export class EmailService {
  private resend: Resend;
  private readonly TO_EMAIL = 'dev@gfmterminal.ai';
  private readonly FROM_EMAIL = 'no-reply@alerts.gfmterminal.ai';

  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private getSubjectLine(status: 'success' | 'failure' | 'partial_success'): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    switch (status) {
      case 'success':
        return `GFM Sync Completed Successfully - ${date} ${time}`;
      case 'partial_success':
        return `GFM Sync Completed with Warnings - ${date} ${time}`;
      case 'failure':
        return `⚠️ GFM Sync Failed - ${date} ${time}`;
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds % 60}s`;
  }

  private getSuccessRate(results: SyncResults): number {
    const total = results.processed + results.skipped;
    if (total === 0) return 0;
    return Math.round(((total - results.errors) / total) * 100);
  }

  private formatErrorDetails(results: SyncResults): string {
    if (results.error_details.length === 0) return '';

    return `
Error Details
------------
${results.error_details.map((error: { type: string; message: string; timestamp: string }) => 
  `• [${error.timestamp}] ${error.type}: ${error.message}`
).join('\n')}
`;
  }

  private getNextSteps(status: 'success' | 'failure' | 'partial_success'): string {
    switch (status) {
      case 'success':
        return '✅ No action required. Next sync scheduled in 1 hour.';
      case 'partial_success':
        return '⚠️ Some items failed to process. Manual review recommended.';
      case 'failure':
        return '🚨 Immediate attention required. System will retry in 1 hour.';
    }
  }

  async sendSyncReport(results: SyncResults, status: 'success' | 'failure' | 'partial_success', hoursSinceLastSync?: number): Promise<void> {
    const avgProcessingTime = results.processed > 0 
      ? Math.round(results.duration_ms / results.processed) 
      : 0;

    const emailBody = `
Sync Status Report
-----------------
Status: ${status}
Time: ${results.start_time} to ${results.end_time}
Duration: ${this.formatDuration(results.duration_ms)}

Summary
-------
• Campaigns Processed: ${results.processed}
• New Campaigns Added: ${results.added}
• New Distributions Added: ${results.distributions_added}
• Distributions Updated: ${results.distributions_updated}
• Errors Encountered: ${results.errors}
• Campaigns Skipped: ${results.skipped}

${results.errors > 0 ? this.formatErrorDetails(results) : ''}

Performance Metrics
-----------------
• Average Processing Time: ${avgProcessingTime}ms per campaign
• Success Rate: ${this.getSuccessRate(results)}%

${hoursSinceLastSync && hoursSinceLastSync > 1.5 
  ? `⚠️ Warning: Last sync was ${hoursSinceLastSync.toFixed(1)} hours ago (expected: 1 hour)\n` 
  : ''}

Next Steps
----------
${this.getNextSteps(status)}
`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.FROM_EMAIL,
        to: this.TO_EMAIL,
        subject: this.getSubjectLine(status),
        text: emailBody,
      });

      if (error) {
        console.error('Failed to send sync report email:', error);
      } else {
        console.log('Sync report email sent successfully:', data);
      }
    } catch (error) {
      console.error('Error sending sync report email:', error);
    }
  }
} 