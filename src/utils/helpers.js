// Workflow logic shared between the board, job details, and job store.
// Kept framework-free and pure so it is easy to unit test later.

import { WORKFLOWS } from '../config.js';
import { STATUS_LABELS } from './constants.js';

export function isProduction(profile) {
  return profile?.role === 'production';
}

// Given a job, work out which status it should move to next according to
// its type's workflow (WORKFLOWS.stickers / WORKFLOWS.flex in config.js).
// Returns null when the job is already Collected (nothing further to do).
export function computeNextStatus(job) {
  if (job.status === 'incoming') return 'queued';

  const steps = WORKFLOWS[job.job_type];
  const currentIndex = steps.indexOf(STATUS_LABELS[job.status]);

  if (currentIndex < steps.length - 1) {
    const nextLabel = steps[currentIndex + 1];
    return Object.keys(STATUS_LABELS).find((key) => STATUS_LABELS[key] === nextLabel);
  }

  return job.status === 'ready' ? 'collected' : null;
}
