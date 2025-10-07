export const SyncPolicy = {
  isCrmOwned: (e: { external_event_id: string | null; type: string }) =>
    !e.external_event_id || e.type === 'lead',

  canDeleteLocallyFromProvider: (e: { external_event_id: string | null; type: string }) =>
    !!e.external_event_id && e.type !== 'lead', // Only Google-linked & not lead

  onProviderMissing: 'repush', // 'repush' or 'unlink'
};
