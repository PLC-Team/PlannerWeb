-- Drop the existing foreign key constraints that are blocking user deletion
ALTER TABLE public.team_transfers
  DROP CONSTRAINT IF EXISTS team_transfers_team_member_id_fkey,
  DROP CONSTRAINT IF EXISTS team_transfers_original_tl_id_fkey,
  DROP CONSTRAINT IF EXISTS team_transfers_destination_tl_id_fkey;

-- Re-add them with ON DELETE CASCADE
ALTER TABLE public.team_transfers
  ADD CONSTRAINT team_transfers_team_member_id_fkey
    FOREIGN KEY (team_member_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT team_transfers_original_tl_id_fkey
    FOREIGN KEY (original_tl_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT team_transfers_destination_tl_id_fkey
    FOREIGN KEY (destination_tl_id) REFERENCES public.users(id) ON DELETE CASCADE;
