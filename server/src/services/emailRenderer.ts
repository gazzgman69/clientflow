import juice from 'juice';
import { convert as htmlToText } from 'html-to-text';

export type RenderInput = { 
  subject: string; 
  html: string; 
  text?: string; 
  preheader?: string; 
};

export type RenderOutput = { 
  subject: string; 
  htmlInlined: string; 
  text: string; 
  headers?: Record<string, string> 
};

interface EmailConfig {
  businessName?: string;
}

/**
 * Email renderer service for creating email-safe HTML with CSS inlining and plaintext fallback
 */
export class EmailRenderer {
  private config: EmailConfig;

  constructor(config: EmailConfig = {}) {
    this.config = {
      businessName: '',
      ...config
    };
  }

  /**
   * Render email with proper HTML structure, CSS inlining, and plaintext fallback
   */
  render(input: RenderInput): RenderOutput {
    const { subject, html, text, preheader } = input;

    // Generate plaintext if not provided
    let plainText = text;
    if (!plainText) {
      plainText = this.generatePlaintext(html);
    }

    // Wrap content in email-safe base template
    const wrappedHtml = this.wrapInBaseTemplate(html, preheader);

    // Inline CSS for email client compatibility
    const htmlInlined = this.inlineCSS(wrappedHtml);

    // Log rendering stats (no PII)
    const beforeLength = html.length;
    const afterLength = htmlInlined.length;
    const plaintextGenerated = !text;
    
    console.log(`📧 Email rendered: ${beforeLength} chars -> ${afterLength} chars inlined, plaintext ${plaintextGenerated ? 'generated' : 'provided'}`);

    return {
      subject,
      htmlInlined,
      text: plainText,
      headers: {
        'Content-Type': 'multipart/alternative'
      }
    };
  }

  /**
   * Wrap content in email-safe base template
   */
  private wrapInBaseTemplate(content: string, preheader?: string): string {
    const preheaderSpan = preheader ? 
      `<span style="display:none;opacity:0;color:transparent;height:0;width:0;line-height:0;overflow:hidden;mso-hide:all;">${this.sanitizeText(preheader)}</span>` : 
      '';

    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <style>
    /* Email-safe reset and base styles */
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f8f9fa;
    }
    table { 
      border-collapse: collapse; 
      mso-table-lspace: 0pt; 
      mso-table-rspace: 0pt; 
    }
    img { 
      border: 0; 
      outline: none; 
      text-decoration: none; 
      -ms-interpolation-mode: bicubic; 
    }
    a { 
      color: #007bff; 
      text-decoration: none; 
    }
    a:hover { 
      text-decoration: underline; 
    }
    .email-container {
      max-width: 600px;
      background-color: #ffffff;
      margin: 0 auto;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-content {
      padding: 32px;
    }
    .email-footer {
      font-size: 12px;
      color: #6c757d;
      text-align: center;
      padding: 24px;
      background-color: #f8f9fa;
    }
    /* Rich text editor content styles */
    .email-content h1 { font-size: 28px; margin: 0 0 24px; color: #212529; }
    .email-content h2 { font-size: 24px; margin: 0 0 20px; color: #212529; }
    .email-content h3 { font-size: 20px; margin: 0 0 16px; color: #212529; }
    .email-content p { margin: 0 0 16px; }
    .email-content ul, .email-content ol { margin: 0 0 16px; padding-left: 24px; }
    .email-content li { margin: 0 0 8px; }
    .email-content strong { font-weight: bold; }
    .email-content em { font-style: italic; }
    .email-content code { 
      font-family: 'Monaco', 'Consolas', monospace; 
      background-color: #f1f3f4; 
      padding: 2px 4px; 
      border-radius: 3px; 
      font-size: 90%; 
    }
    .email-content blockquote {
      margin: 0 0 16px;
      padding: 12px 16px;
      border-left: 4px solid #007bff;
      background-color: #f8f9fa;
      color: #495057;
    }
    /* Button styles */
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #007bff;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      margin: 16px 0;
    }
    .btn:hover {
      background-color: #0056b3;
      text-decoration: none;
    }
  </style>
</head>
<body>
  ${preheaderSpan}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="email-content">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Inline CSS using juice for email client compatibility
   */
  private inlineCSS(html: string): string {
    try {
      return juice(html, {
        preserveMediaQueries: false,
        preserveFontFaces: false,
        preserveKeyFrames: false,
        removeStyleTags: true,
        webResources: {
          relativeTo: process.cwd(),
          strict: false
        }
      });
    } catch (error) {
      console.error('Failed to inline CSS, using original HTML:', error);
      return html;
    }
  }

  /**
   * Generate plaintext version from HTML
   */
  private generatePlaintext(html: string): string {
    // Use simple regex-based HTML stripping for reliability
    console.log('📧 Converting HTML to plaintext using fallback method');
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<h[1-6][^>]*>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '')
      .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
      .replace(/<blockquote[^>]*>/gi, '\n> ')
      .replace(/<\/blockquote>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  /**
   * Sanitize text content for email safety
   */
  private sanitizeText(text: string): string {
    // Remove potential script injection and clean up text
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * Validate and process image sources for email compatibility
   */
  validateImageSources(html: string): string {
    return html.replace(/<img[^>]+src=['"](.*?)['"][^>]*>/gi, (match, src) => {
      // Ensure images are either CID attachments or absolute HTTPS URLs
      if (src.startsWith('cid:') || src.startsWith('https://')) {
        return match;
      } else if (src.startsWith('http://')) {
        // Convert HTTP to HTTPS for security
        return match.replace(/src=['"]http:\/\//, 'src="https://');
      } else if (src.startsWith('/') || src.startsWith('./')) {
        // Convert relative URLs to absolute (you'd need to provide your domain)
        console.warn(`Relative image URL found: ${src}. Consider using absolute URLs for email compatibility.`);
        return match;
      }
      return match;
    });
  }
}

// Export singleton instance
export const emailRenderer = new EmailRenderer();