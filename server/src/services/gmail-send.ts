import { google } from 'googleapis';

function b64url(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function qp(s: string): string {
  if (!s) return '';
  
  // Encode per RFC 2045 quoted-printable rules
  let encoded = '';
  const lines = s.split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let encodedLine = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const code = char.charCodeAt(0);
      
      // RFC 2045: printable ASCII (33-126) except '=' can be literal
      // Space (32) and Tab (9) are allowed in middle of line
      if (char === '=') {
        encodedLine += '=3D';
      } else if ((code >= 33 && code <= 126) || char === ' ' || char === '\t') {
        encodedLine += char;
      } else {
        // Encode control chars and non-ASCII
        const hex = code.toString(16).toUpperCase().padStart(2, '0');
        encodedLine += '=' + hex;
      }
    }
    
    // Encode trailing spaces/tabs (RFC requirement)
    encodedLine = encodedLine.replace(/[\t ]+$/, (m) => 
      m.split('').map(c => '=' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('')
    );
    
    // Add CRLF between lines
    encoded += encodedLine;
    if (i < lines.length - 1) {
      encoded += '\r\n';
    }
  }
  
  return encoded;
}

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trim();
}

function encodeSubject(s: string): string {
  return /[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s;
}

export function buildMimeRaw(opts: {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string; isBase64?: boolean }>;
  inlineImages?: Array<{ cid: string; contentType: string; base64: string }>;
}) {
  const CRLF = '\r\n';
  const alt = `alt_${Date.now().toString(36)}`;
  const rel = `rel_${(Date.now()+1).toString(36)}`;
  const mix = `mix_${(Date.now()+2).toString(36)}`;

  const inlines = opts.inlineImages || [];
  const atts = opts.attachments || [];

  // Build plain text part
  const textPart = (opts.text || '').trim() ? [
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    qp(opts.text!.trim()),
    ``
  ].join(CRLF) : null;

  // Build HTML part
  const htmlRaw = (opts.html || '').trim();
  const htmlPart = htmlRaw ? [
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    qp(htmlRaw),
    ``
  ].join(CRLF) : null;

  // If inline images, wrap HTML in multipart/related so CID references resolve
  let htmlOrRelatedPart: string | null = htmlPart;
  if (inlines.length > 0 && htmlPart) {
    const inlineParts = inlines.map(img => [
      `Content-Type: ${img.contentType}`,
      `Content-Transfer-Encoding: base64`,
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline`,
      ``,
      wrap76(img.base64),
      ``
    ].join(CRLF));

    htmlOrRelatedPart = [
      `Content-Type: multipart/related; boundary="${rel}"`,
      ``,
      `--${rel}`,
      htmlPart,
      ...inlineParts.map(p => `--${rel}${CRLF}${p}`),
      `--${rel}--`,
      ``
    ].join(CRLF);
  }

  // Build the multipart/alternative parts list
  const altParts: string[] = [];
  if (textPart) altParts.push(textPart);
  if (htmlOrRelatedPart) altParts.push(htmlOrRelatedPart);

  let headers: string;
  let body: string;

  if (atts.length) {
    // With file attachments: multipart/mixed at top level
    headers = [
      'MIME-Version: 1.0',
      opts.from ? `From: ${opts.from}` : null,
      `To: ${opts.to.join(', ')}`,
      opts.cc?.length ? `Cc: ${opts.cc.join(', ')}` : null,
      opts.bcc?.length ? `Bcc: ${opts.bcc.join(', ')}` : null,
      `Subject: ${encodeSubject(opts.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Content-Type: multipart/mixed; boundary="${mix}"`
    ].filter(Boolean).join(CRLF);

    const altBody = [
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      ``,
      ...altParts.map(p => `--${alt}${CRLF}${p}`),
      `--${alt}--`,
      ``
    ].join(CRLF);

    const parts = [ `--${mix}`, altBody ];
    for (const a of atts) {
      const ct = a.contentType || 'application/octet-stream';
      const contentB64 = a.isBase64 ? a.content : Buffer.from(a.content, 'utf8').toString('base64');
      parts.push(
        `--${mix}`,
        `Content-Type: ${ct}; name="${a.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${a.filename}"`,
        ``,
        wrap76(contentB64),
        ``
      );
    }
    parts.push(`--${mix}--`, ``);
    body = parts.join(CRLF);
  } else {
    // No file attachments: multipart/alternative at top level
    headers = [
      'MIME-Version: 1.0',
      opts.from ? `From: ${opts.from}` : null,
      `To: ${opts.to.join(', ')}`,
      opts.cc?.length ? `Cc: ${opts.cc.join(', ')}` : null,
      opts.bcc?.length ? `Bcc: ${opts.bcc.join(', ')}` : null,
      `Subject: ${encodeSubject(opts.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`
    ].filter(Boolean).join(CRLF);

    body = [
      ...altParts.map(p => `--${alt}${CRLF}${p}`),
      `--${alt}--`,
      ``
    ].join(CRLF);
  }

  // CRITICAL: blank line between headers and body
  const raw = headers + CRLF + CRLF + body;
  return b64url(raw);
}

export async function sendViaGmail(opts: {
  oauth: any; // google.auth.OAuth2
  from?: string;
  to: string[]; cc?: string[]; bcc?: string[];
  subject: string;
  html?: string; text?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string; isBase64?: boolean }>;
  inlineImages?: Array<{ cid: string; contentType: string; base64: string }>;
}) {
  const gmail = google.gmail({ version: 'v1', auth: opts.oauth });
  const raw = buildMimeRaw({
    from: opts.from, to: opts.to, cc: opts.cc, bcc: opts.bcc,
    subject: opts.subject, html: opts.html, text: opts.text,
    attachments: opts.attachments, inlineImages: opts.inlineImages
  });
  return gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}
