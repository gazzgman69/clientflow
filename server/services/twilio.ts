interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

interface TwilioMessage {
  to: string;
  body: string;
  from?: string;
}

interface TwilioResponse {
  sid: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

export class TwilioService {
  private config: TwilioConfig;

  constructor() {
    this.config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    };
  }

  /**
   * Send an SMS message via Twilio
   */
  async sendSMS(message: TwilioMessage): Promise<TwilioResponse> {
    // In a real implementation, this would use the Twilio SDK
    // For development purposes, we'll simulate the Twilio API response
    
    if (!this.config.accountSid || !this.config.authToken) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      // Simulate Twilio API call
      // In production, this would be:
      // const client = twilio(this.config.accountSid, this.config.authToken);
      // const twilioMessage = await client.messages.create({
      //   body: message.body,
      //   from: message.from || this.config.phoneNumber,
      //   to: message.to
      // });

      // Mock successful response for development
      const mockResponse: TwilioResponse = {
        sid: `SM${Math.random().toString(36).substr(2, 32)}`,
        status: 'queued'
      };

      console.log(`[Twilio SMS] Sending SMS to ${message.to}: ${message.body}`);
      
      return mockResponse;
    } catch (error) {
      console.error('[Twilio SMS] Error sending SMS:', error);
      throw new Error('Failed to send SMS via Twilio');
    }
  }

  /**
   * Get SMS delivery status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<string> {
    // In production, this would query Twilio for message status
    // For development, return a mock status
    
    if (!this.config.accountSid || !this.config.authToken) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      // Mock status check
      const statuses = ['queued', 'sent', 'delivered', 'failed'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      console.log(`[Twilio SMS] Status check for ${messageSid}: ${randomStatus}`);
      
      return randomStatus;
    } catch (error) {
      console.error('[Twilio SMS] Error checking message status:', error);
      return 'failed';
    }
  }

  /**
   * Handle incoming SMS webhooks from Twilio
   */
  async handleIncomingWebhook(webhookData: any): Promise<{
    from: string;
    to: string;
    body: string;
    messageSid: string;
  }> {
    // Parse Twilio webhook data
    return {
      from: webhookData.From,
      to: webhookData.To,
      body: webhookData.Body,
      messageSid: webhookData.MessageSid
    };
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming US +1)
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return phoneNumber; // Return as-is if already formatted or invalid
  }

  /**
   * Check if Twilio is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.accountSid && this.config.authToken && this.config.phoneNumber);
  }
}

export const twilioService = new TwilioService();