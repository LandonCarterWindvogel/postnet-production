// Maps the current page id to the HTML for that page. This is the only
// file that needs to change when a new nav destination is added.

import { renderProductionBoard, jobCard } from '../components/board/ProductionBoard.js';
import { renderNewJobForm } from '../components/jobs/NewJobForm.js';
import { renderJobDetails } from '../components/jobs/JobDetails.js';
import { renderStock } from '../components/stock/StockList.js';
import { renderComingSoon } from '../components/layout/ComingSoon.js';
import { isProduction } from '../utils/helpers.js';
import { escapeHtml } from '../utils/formatters.js';

export function renderPage(page, { jobs, profile, error, selectedId, userId, stock, stockError }) {
  switch (page) {
    case 'new-job':
      return renderNewJobForm(profile);

    case 'job-details': {
      const job = jobs.find((item) => item.id === selectedId);
      return job ? renderJobDetails(job, profile) : renderProductionBoard({ jobs, profile, error });
    }

    case 'my-jobs': {
      // Production's "My Jobs" is their personal work log (jobs they accepted),
      // not a second copy of the whole board. Branch users see their branch's
      // full history, including Ready/Collected/Rejected — the board hides those.
      const myJobs = isProduction(profile)
        ? jobs.filter((job) => job.accepted_by === userId)
        : jobs.filter((job) => job.branch === profile.branch);
      const subtitle = isProduction(profile)
        ? 'Jobs you have personally accepted into production.'
        : `Every job submitted by ${escapeHtml(profile.branch)}.`;

      return `<section class="page-heading"><div><p class="eyebrow">Job history</p><h1>My Jobs</h1><p>${subtitle}</p></div></section>
        <section class="job-table">${myJobs.map(jobCard).join('') || '<p>No jobs yet.</p>'}</section>`;
    }

    case 'stock':
      return renderStock({ items: stock, profile, error: stockError });

    case 'settings':
      return renderComingSoon('Settings');

    case 'board':
    default:
      return renderProductionBoard({ jobs, profile, error });
  }
}
