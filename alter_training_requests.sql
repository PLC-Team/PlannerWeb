-- Add new columns for Planned Training sessions

ALTER TABLE public.training_requests
ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'request' CHECK (request_type IN ('request', 'planned')),
ADD COLUMN IF NOT EXISTS start_time time,
ADD COLUMN IF NOT EXISTS end_time time,
ADD COLUMN IF NOT EXISTS location text;

-- Update the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
