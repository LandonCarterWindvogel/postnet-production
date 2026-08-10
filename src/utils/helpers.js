// Workflow logic shared between the board, job details, and job store.
// Kept framework-free and pure so it is easy to unit test later.

import { WORKFLOWS } from '../config.js';
import { STATUS_LABELS, CLOSED_STATUSES } from './constants.js';

export function isProduction(profile) {
  return profile?.role === 'production';
}

export function isClosed(job) {
  return CLOSED_STATUSES.includes(job.status);
}

// Given a job, work out which status it should move to next according to
// its type's workflow (WORKFLOWS.stickers / WORKFLOWS.flex in config.js).
// Returns null once a job is closed (Collected or Rejected) — nothing
// further to do until the branch resubmits.
export function computeNextStatus(job) {
  if (isClosed(job)) return null;
  if (job.status === 'incoming') return 'queued';

  const steps = WORKFLOWS[job.job_type];
  const currentIndex = steps.indexOf(STATUS_LABELS[job.status]);

  if (currentIndex < steps.length - 1) {
    const nextLabel = steps[currentIndex + 1];
    return Object.keys(STATUS_LABELS).find((key) => STATUS_LABELS[key] === nextLabel);
  }

  return job.status === 'ready' ? 'collected' : null;
}

export function isOverdue(job) {
  if (!job.expected_ready_by) return false;
  return new Date() > new Date(job.expected_ready_by) && !isClosed(job);
}