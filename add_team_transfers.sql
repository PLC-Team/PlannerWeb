-- CREATE TABLE AND POLICIES FOR TEAM TRANSFERS (IF NOT ALREADY RUN)
CREATE TABLE IF NOT EXISTS public.team_transfers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_member_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  original_tl_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  destination_tl_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  transfer_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  return_date timestamp with time zone,
  status text CHECK (status IN ('active', 'returned')) DEFAULT 'active' NOT NULL,
  remarks text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.team_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transfers they are involved in or manage" ON public.team_transfers;
CREATE POLICY "Users can view transfers they are involved in or manage"
  ON public.team_transfers FOR SELECT
  USING (
    auth.uid() = team_member_id OR
    auth.uid() = original_tl_id OR
    auth.uid() = destination_tl_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Team Leaders can insert transfers" ON public.team_transfers;
CREATE POLICY "Team Leaders can insert transfers"
  ON public.team_transfers FOR INSERT
  WITH CHECK (
    auth.uid() = original_tl_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'team_leader')
  );

DROP POLICY IF EXISTS "Destination TL can update to returned" ON public.team_transfers;
CREATE POLICY "Destination TL can update to returned"
  ON public.team_transfers FOR UPDATE
  USING (auth.uid() = destination_tl_id)
  WITH CHECK (auth.uid() = destination_tl_id);

-- =========================================================================
-- FIX ROW LEVEL SECURITY FOR HIERARCHY TABLE (REQUIRED FOR TRANSFERS)
-- =========================================================================

-- Allow Team Leaders to insert temporary assignments into the hierarchy
DROP POLICY IF EXISTS "Team Leaders can insert hierarchy" ON public.hierarchy;
CREATE POLICY "Team Leaders can insert hierarchy"
  ON public.hierarchy FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role(auth.uid()) = 'team_leader'
  );

-- Allow Team Leaders to delete temporary assignments from the hierarchy (when returning)
DROP POLICY IF EXISTS "Team Leaders can delete hierarchy" ON public.hierarchy;
CREATE POLICY "Team Leaders can delete hierarchy"
  ON public.hierarchy FOR DELETE TO authenticated
  USING (
    public.current_user_role(auth.uid()) = 'team_leader'
  );
