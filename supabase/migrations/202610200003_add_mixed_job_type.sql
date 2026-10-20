-- Add the mixed type before the next migration references it.
-- Keep this in its own migration so PostgreSQL can commit the enum value first.
ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'mixed';
