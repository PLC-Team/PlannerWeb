-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the new constraint with 'hod' included
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'hod', 'manager', 'team_leader', 'team_member'));
