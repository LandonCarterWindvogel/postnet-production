// Maps the current page id to the HTML for that page. This is the only
// file that needs to change when a new nav destination is added.

import { renderProductionBoard, jobCard } from '../components/board/ProductionBoard.js';
import { renderNewJobForm } from '../components/jobs/NewJobForm.js';
import { renderJobDetails } from '../components/jobs/JobDetails.js';
import { renderComingSoon } from '../components/layout/ComingSoon.js';

export function renderPage(page, { jobs, profile, error, selectedId }) {
  switch (page) {
    case 'new-job':
      return renderNewJobForm(profile);

    case 'job-details': {
      const job = jobs.find((item) => item.id === selectedId);
      return job ? renderJobDetails(job, profile) : renderProductionBoard({ jobs, profile, error });
    }

    case 'my-jobs':
      return `<section class="page-heading"><div><p class="eyebrow">Job history</p><h1>My Jobs</h1></div></section>
        <section class="job-table">${jobs.map(jobCard).join('') || '<p>No jobs yet.</p>'}</section>`;

    case 'stock':
      return renderComingSoon('Stock');

    case 'settings':
      return renderComingSoon('Settings');

    case 'board':
    default:
      return renderProductionBoard({ jobs, profile, error });
  }
}
