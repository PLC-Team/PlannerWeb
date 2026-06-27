-- 1. Drop existing status check constraint (assuming default name)
-- If it's not named training_requests_status_check, we can use a PL/pgSQL block to find and drop it
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.training_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.training_requests DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 2. Add new columns
ALTER TABLE public.training_requests
ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS training_duration text,
ADD COLUMN IF NOT EXISTS training_mode text CHECK (training_mode IN ('online', 'offline'));

-- 3. Add updated status constraint
ALTER TABLE public.training_requests
ADD CONSTRAINT training_requests_status_check
CHECK (status IN ('requested', 'under_review', 'approved', 'trainer_assigned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rejected'));

-- 4. Update RLS policies so EVERYONE can see ALL training requests
DROP POLICY IF EXISTS "Users can read own or managed requests" ON public.training_requests;
CREATE POLICY "Users can read all requests"
  ON public.training_requests FOR SELECT
  TO authenticated
  USING (true);

-- 5. Users need to be able to UPDATE training requests to take ownership
-- Previously only requester/manager could update. Now anyone can take ownership.
DROP POLICY IF EXISTS "Users can update own or managed requests" ON public.training_requests;
CREATE POLICY "Users can update requests"
  ON public.training_requests FOR UPDATE
  TO authenticated
  USING (true);

-- Update the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
