import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SmtpSendParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inlineImages?: Array<{ cid: string; contentType: string; base64: string }>;
}

export class SmtpEmailProvider {
  async sendEmail(config: SmtpConfig, params: SmtpSendParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass }
      });

      const fromAddress = config.fromName
        ? `"${config.fromName}" <${config.fromEmail || config.user}>`
        : (config.fromEmail || config.user);

      // Build attachments for inline images
      const attachments = (params.inlineImages || []).map(img => ({
        filename: img.cid,
        content: Buffer.from(img.base64, 'base64'),
        contentType: img.contentType,
        cid: img.cid
      }));

      const info = await transporter.sendMail({
        from: fromAddress,
        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
        cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined,
        bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined,
        subject: params.subject,
        text: params.text,
        html: params.html,
        replyTo: params.replyTo,
        attachments: attachments.length ? attachments : undefined
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const smtpEmailProvider = new SmtpEmailProvider();
