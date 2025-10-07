type Job = { eventId: string; attempt?: number };
const q: Job[] = [];

export const googleOutbox = {
  enqueue(job: Job) { q.push({ ...job, attempt: job.attempt ?? 0 }); },
  _take(): Job | undefined { return q.shift(); },
  _size(): number { return q.length; }
};
