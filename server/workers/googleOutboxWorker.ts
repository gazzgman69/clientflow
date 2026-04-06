import { googleOutbox } from '../services/googleOutbox';
import { storage } from '../storage';
import { googleOAuthService } from '../src/services/google-oauth';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function handleJob(job: { eventId: string; attempt: number }) {
  const ev = await storage.getEvent(job.eventId, job.tenantId ?? 'default-tenant');
  if (!ev) return;

  try {
    // Get calendar integration for the event creator
    const integrations = await storage.getCalendarIntegrationsByUser(ev.createdBy, ev.tenantId);
    const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);

    if (!googleIntegration) {
      console.warn('WARN google.outbox.no_integration', { eventId: ev.id });
      return;
    }

    if (!ev.external_event_id) {
      // Create new event in Google Calendar
      const result = await googleOAuthService.syncToGoogle(googleIntegration, ev.id);
      console.info('INFO google.outbox.create', { eventId: ev.id, gEventId: result?.googleEventId });
    } else {
      // Update existing event in Google Calendar
      const result = await googleOAuthService.syncToGoogle(googleIntegration, ev.id);
      console.info('INFO google.outbox.update', { eventId: ev.id, gEventId: ev.external_event_id });
    }
  } catch (err: any) {
    const next = job.attempt + 1;
    if (next <= 5) {
      console.warn('WARN google.outbox.retry', { eventId: ev.id, attempt: next, reason: err?.message });
      await sleep(2 ** next * 250);
      googleOutbox.enqueue({ eventId: ev.id, tenantId: job.tenantId, attempt: next });
    } else {
      console.warn('WARN google.outbox.gave_up', { eventId: ev.id, reason: err?.message });
    }
  }
}

export async function runGoogleOutboxWorker(loop = false) {
  do {
    const job = googleOutbox._take();
    if (!job) { await sleep(500); continue; }
    await handleJob(job);
  } while (loop);
}
