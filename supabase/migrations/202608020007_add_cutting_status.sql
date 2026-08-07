-- Bug fix: T-shirt flex jobs could never advance past Queued. WORKFLOWS.flex
-- (src/config.js) has always stepped through a 'Cutting' stage, but the
-- job_state enum only ever had 'contour_cutting' — the sticker-specific
-- step — with no plain 'cutting' value for flex. computeNextStatus()
-- couldn't find 'Cutting' in the enum's labels, so it silently returned
-- nothing and the advance button never appeared. This has been broken
-- since the original schema, not something introduced in a later sprint.

alter type public.job_state add value 'cutting' after 'queued';
