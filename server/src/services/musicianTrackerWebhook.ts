import { format } from 'date-fns';

interface MusicianTrackerPayload {
  event: 'booking.confirmed';
  crm_booking_id: string;
  client_name: string;
  event_date: string;
  venue: string | null;
  lineup_summary: string | null;
  arrival_time: string | null;
  finish_time: string | null;
  fee: number | null;
  tenant_id: string;
}

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return format(new Date(date), 'HH:mm');
  } catch {
    return null;
  }
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export async function sendToMusicianTracker(
  event: {
    id: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    location?: string | null;
    lineupSummary?: string | null;
    fee?: string | null;
  },
  clientName: string
): Promise<void> {
  const secret = process.env.MUSICIAN_TRACKER_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[MusicianTracker] MUSICIAN_TRACKER_WEBHOOK_SECRET not set — skipping webhook');
    return;
  }

  const payload: MusicianTrackerPayload = {
    event: 'booking.confirmed',
    crm_booking_id: event.id,
    client_name: clientName,
    event_date: formatDate(event.startDate),
    venue: event.location ?? null,
    lineup_summary: event.lineupSummary ?? null,
    arrival_time: formatTime(event.startDate),
    finish_time: formatTime(event.endDate),
    fee: event.fee != null ? parseFloat(event.fee) : null,
    tenant_id: event.tenantId,
  };

  try {
    const response = await fetch('https://musician-tracker.replit.app/api/webhook/booking-confirmed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': secret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        `[MusicianTracker] Webhook responded ${response.status}: ${body}`
      );
    } else {
      console.log(`[MusicianTracker] Webhook sent for booking ${event.id} — ${response.status}`);
    }
  } catch (err: any) {
    console.error('[MusicianTracker] Webhook call failed (non-blocking):', err?.message ?? err);
  }
}
