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
  private config: TwilioConfig | null = null;

  constructor() {
    // No validation at construction time - use lazy initialization
  }

  /**
   * Validate and initialize Twilio credentials (lazy initialization)
   */
  private validateCredentials(): void {
    if (this.config) return; // Already initialized

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid) {
      throw new Error('TWILIO_ACCOUNT_SID environment variable is required for Twilio SMS. Please configure your Twilio credentials.');
    }
    
    if (!authToken) {
      throw new Error('TWILIO_AUTH_TOKEN environment variable is required for Twilio SMS. Please configure your Twilio credentials.');
    }
    
    if (!phoneNumber) {
      throw new Error('TWILIO_PHONE_NUMBER environment variable is required for Twilio SMS. Please configure your Twilio credentials.');
    }
    
    this.config = {
      accountSid,
      authToken,
      phoneNumber,
    };
  }

  /**
   * Validate Twilio webhook signature for security
   * Implements Twilio's exact signature validation algorithm
   */
  async validateWebhookSignature(signature: string, url: string, params: Record<string, string>): Promise<boolean> {
    try {
      this.validateCredentials();
      
      if (!this.config) {
        throw new Error('Twilio credentials not configured');
      }
      
      const crypto = require('crypto');
      const authToken = this.config.authToken;
      
      // SECURITY: Implement Twilio's exact signature validation algorithm
      // 1. Start with the full URL (including query string if any)
      let baseString = url;
      
      // 2. Sort parameters alphabetically by key and append to URL
      const sortedKeys = Object.keys(params).sort();
      for (const key of sortedKeys) {
        baseString += key + params[key];
      }
      
      // 3. Create HMAC-SHA1 with auth token and base64 encode
      const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(baseString)
        .digest('base64');
      
      // 4. Compare signatures using timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );
    } catch (error) {
      console.error('Error validating Twilio webhook signature:', error);
      return false;
    }
  }

  /**
   * Send an SMS message via Twilio
   */
  async sendSMS(message: TwilioMessage): Promise<TwilioResponse> {
    // Validate credentials on first use
    this.validateCredentials();
    
    // PRODUCTION IMPLEMENTATION REQUIRED
    // This service requires the Twilio SDK to be installed for production use
    
    throw new Error(
      'Twilio SMS service requires production implementation. ' +
      'Install the Twilio SDK and implement the actual API calls. ' +
      'Remove this placeholder when implementing real Twilio integration.'
    );
    
    // TODO: Implement real Twilio API calls when SDK is available
    /*
    try {
      const twilio = require('twilio');
      const client = twilio(this.config!.accountSid, this.config!.authToken);
      
      const twilioMessage = await client.messages.create({
        body: message.body,
        from: message.from || this.config!.phoneNumber,
        to: message.to
      });

      console.log(`[Twilio SMS] SMS sent to ${message.to} with SID: ${twilioMessage.sid}`);
      
      return {
        sid: twilioMessage.sid,
        status: twilioMessage.status
      };
    } catch (error) {
      console.error('[Twilio SMS] Error sending SMS:', error);
      throw new Error(`Failed to send SMS via Twilio: ${error.message}`);
    }
    */
  }

  /**
   * Get SMS delivery status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<string> {
    // Validate credentials on first use
    this.validateCredentials();
    
    // PRODUCTION IMPLEMENTATION REQUIRED
    throw new Error(
      'Twilio status check requires production implementation. ' +
      'Install the Twilio SDK and implement the actual API calls.'
    );
    
    // TODO: Implement real Twilio status check when SDK is available
    /*
    try {
      const twilio = require('twilio');
      const client = twilio(this.config!.accountSid, this.config!.authToken);
      
      const message = await client.messages(messageSid).fetch();
      
      console.log(`[Twilio SMS] Status check for ${messageSid}: ${message.status}`);
      
      return message.status;
    } catch (error) {
      console.error('[Twilio SMS] Error checking message status:', error);
      throw new Error(`Failed to check SMS status: ${error.message}`);
    }
    */
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
    try {
      this.validateCredentials();
      return true;
    } catch {
      return false;
    }
  }
}

export const twilioService = new TwilioService();