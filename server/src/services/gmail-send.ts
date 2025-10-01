import { google } from 'googleapis';

function b64url(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function qp(s: string): string {
  return (s || '')
    .replace(/[\t ]+$/gm, (m) => m.split('').map(c => '=' + c.charCodeAt(0).toString(16).toUpperCase()).join(''))
    .replace(/[\u0080-\uFFFF]/g, ch => '=' + Buffer.from(ch, 'utf8').toString('hex').toUpperCase())
    .replace(/\r?\n/g, '\r\n');
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
}) {
  const CRLF = '\r\n';
  const alt = `alt_${Date.now().toString(36)}`;
  const mix = `mix_${(Date.now()+1).toString(36)}`;

  const headers = [
    'MIME-Version: 1.0',
    opts.from ? `From: ${opts.from}` : null,
    `To: ${opts.to.join(', ')}`,
    opts.cc?.length ? `Cc: ${opts.cc.join(', ')}` : null,
    opts.bcc?.length ? `Bcc: ${opts.bcc.join(', ')}` : null,
    `Subject: ${encodeSubject(opts.subject)}`,
    `Date: ${new Date().toUTCString()}`
  ].filter(Boolean).join(CRLF);

  const altParts: string[] = [];
  if ((opts.text || '').trim()) {
    altParts.push(
      [
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: quoted-printable`,
        ``,
        qp(opts.text!.trim()),
        ``
      ].join(CRLF)
    );
  }
  if ((opts.html || '').trim()) {
    altParts.push(
      [
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: quoted-printable`,
        ``,
        qp(opts.html!.trim()),
        ``
      ].join(CRLF)
    );
  }

  const altBody = [
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    ``,
    ...altParts.map(p => `--${alt}${CRLF}${p}`),
    `--${alt}--`,
    ``
  ].join(CRLF);

  const atts = opts.attachments || [];
  let body = altBody;
  if (atts.length) {
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
    body = [`Content-Type: multipart/mixed; boundary="${mix}"`, ``, ...parts].join(CRLF);
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
}) {
  const gmail = google.gmail({ version: 'v1', auth: opts.oauth });
  const raw = buildMimeRaw({
    from: opts.from, to: opts.to, cc: opts.cc, bcc: opts.bcc,
    subject: opts.subject, html: opts.html, text: opts.text, attachments: opts.attachments
  });
  return gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}
