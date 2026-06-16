DROP POLICY IF EXISTS "Destination TL can update to returned" ON public.team_transfers;
CREATE POLICY "Destination TL can update to returned"
  ON public.team_transfers FOR UPDATE
  USING (auth.uid() = destination_tl_id)
  WITH CHECK (auth.uid() = destination_tl_id);
