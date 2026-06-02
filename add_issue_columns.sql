-- ============================================================================
-- SQL Migration: Add Issue Logging & Lesson Learned Fields
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- ============================================================================

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by_name text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS plant text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS line text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS station text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS occurrence_date date;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responsible_person_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS occurrence_condition text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS temporary_action text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS permanent_countermeasure text;

-- Optional: Comments to describe the purpose of new fields
COMMENT ON COLUMN public.issues.reported_by_name IS 'Name of the person who reported the issue (freeform text)';
COMMENT ON COLUMN public.issues.plant IS 'Plant where the issue occurred';
COMMENT ON COLUMN public.issues.line IS 'Production/Assembly line where the issue occurred';
COMMENT ON COLUMN public.issues.station IS 'Station where the issue occurred';
COMMENT ON COLUMN public.issues.occurrence_date IS 'Date when the issue occurred';
COMMENT ON COLUMN public.issues.responsible_person_id IS 'Project team member responsible for the issue/lesson learned';
COMMENT ON COLUMN public.issues.occurrence_condition IS 'Condition details under which the issue occurred';
COMMENT ON COLUMN public.issues.temporary_action IS 'Description of temporary actions taken';
COMMENT ON COLUMN public.issues.permanent_countermeasure IS 'Description of permanent countermeasures/lessons learned';
