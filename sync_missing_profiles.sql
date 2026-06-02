-- Sync any missing users from auth.users into public.users table
INSERT INTO public.users (id, email, name, role, designation)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', 'New User'),
  COALESCE(raw_user_meta_data->>'role', 'team_member'),
  COALESCE(raw_user_meta_data->>'designation', 'Staff')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
