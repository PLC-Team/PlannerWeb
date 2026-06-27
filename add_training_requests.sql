-- ============================================================================
-- SQL SCRIPT: CREATE TRAINING REQUESTS TABLE
-- Run this script in the Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.training_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  description text NOT NULL,
  priority text CHECK (priority IN ('low', 'medium', 'high')),
  remarks text,
  requested_by uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text DEFAULT 'requested' CHECK (status IN ('requested', 'under_review', 'approved', 'scheduled', 'completed', 'rejected')),
  scheduled_date date,
  trainer_name text,
  manager_remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;

-- 1. Users can insert their own requests
CREATE POLICY "Users can insert their own requests"
  ON public.training_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- 2. Users can read their own requests OR Managers can read requests assigned to them
CREATE POLICY "Users can read own or managed requests"
  ON public.training_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    manager_id = auth.uid()
  );

-- 3. Users can update their own requests (e.g. before approval) OR Managers can update requests assigned to them
CREATE POLICY "Users can update own or managed requests"
  ON public.training_requests FOR UPDATE
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    manager_id = auth.uid()
  );

-- 4. Managers can delete requests if needed (Optional)
CREATE POLICY "Managers can delete managed requests"
  ON public.training_requests FOR DELETE
  TO authenticated
  USING (
    manager_id = auth.uid()
  );
