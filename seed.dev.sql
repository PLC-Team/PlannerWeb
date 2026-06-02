-- ============================================================================
-- DEV ONLY: SEED DATA FOR TESTING
-- DO NOT RUN THIS IN PRODUCTION
-- ============================================================================

-- SEED DATA CONFIGURATION (Default Organization Hierarchy)
-- ============================================================================

-- 1. Clear existing seed users if they exist in auth.users
delete from auth.users where email in (
  'admin@company.com',
  'manager@company.com',
  'tl@company.com',
  'member1@company.com',
  'member2@company.com'
);

-- 2. Insert users into auth.users (triggers will automatically insert into public.users)
insert into auth.users (
  id, 
  instance_id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at, 
  role, 
  aud,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  email_change_token_current,
  phone_change_token,
  reauthentication_token,
  phone,
  phone_change,
  is_anonymous,
  is_sso_user,
  email_change_confirm_status
)
values
  (
    'a1111111-1111-1111-1111-111111111111', 
    '00000000-0000-0000-0000-000000000000', 
    'admin@company.com', 
    crypt('admin123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"name":"Sarah Jenkins","role":"admin","designation":"System Administrator"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    false,
    false,
    0
  ),
  (
    'a2222222-2222-2222-2222-222222222222', 
    '00000000-0000-0000-0000-000000000000', 
    'manager@company.com', 
    crypt('manager123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"name":"David Carter","role":"manager","designation":"Operations Director"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    false,
    false,
    0
  ),
  (
    'a3333333-3333-3333-3333-333333333333', 
    '00000000-0000-0000-0000-000000000000', 
    'tl@company.com', 
    crypt('tl123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"name":"Robert Stark","role":"team_leader","designation":"Senior Technical Lead"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    false,
    false,
    0
  ),
  (
    'a4444444-4444-4444-4444-444444444444', 
    '00000000-0000-0000-0000-000000000000', 
    'member1@company.com', 
    crypt('member123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"name":"John Doe","role":"team_member","designation":"Backend Developer"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    false,
    false,
    0
  ),
  (
    'a5555555-5555-5555-5555-555555555555', 
    '00000000-0000-0000-0000-000000000000', 
    'member2@company.com', 
    crypt('member123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"name":"Alice Smith","role":"team_member","designation":"UI/UX Designer"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    false,
    false,
    0
  );

-- 2.5. Link email identities so users can log in successfully via Supabase Auth
insert into auth.identities (
  id, 
  user_id, 
  identity_data, 
  provider, 
  last_sign_in_at, 
  created_at, 
  updated_at, 
  provider_id
)
values
  (
    gen_random_uuid(), 
    'a1111111-1111-1111-1111-111111111111', 
    '{"sub":"a1111111-1111-1111-1111-111111111111","email":"admin@company.com"}'::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    'a1111111-1111-1111-1111-111111111111'
  ),
  (
    gen_random_uuid(), 
    'a2222222-2222-2222-2222-222222222222', 
    '{"sub":"a2222222-2222-2222-2222-222222222222","email":"manager@company.com"}'::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    'a2222222-2222-2222-2222-222222222222'
  ),
  (
    gen_random_uuid(), 
    'a3333333-3333-3333-3333-333333333333', 
    '{"sub":"a3333333-3333-3333-3333-333333333333","email":"tl@company.com"}'::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    'a3333333-3333-3333-3333-333333333333'
  ),
  (
    gen_random_uuid(), 
    'a4444444-4444-4444-4444-444444444444', 
    '{"sub":"a4444444-4444-4444-4444-444444444444","email":"member1@company.com"}'::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    'a4444444-4444-4444-4444-444444444444'
  ),
  (
    gen_random_uuid(), 
    'a5555555-5555-5555-5555-555555555555', 
    '{"sub":"a5555555-5555-5555-5555-555555555555","email":"member2@company.com"}'::jsonb, 
    'email', 
    now(), 
    now(), 
    now(), 
    'a5555555-5555-5555-5555-555555555555'
  );

-- 2.6. Setup Hierarchy (Managers to TLs, TLs to Members)
insert into public.hierarchy (manager_id, team_leader_id, team_member_id)
values
  ('a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', null),
  ('a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444'),
  ('a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'a5555555-5555-5555-5555-555555555555');

-- 3. Seed Projects
insert into public.projects (id, project_code, project_name, customer_name, description, assigned_team_leader_id, created_by, status)
values
  ('91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Core System Redesign', 'Alpha Corp', 'Upgrading the legacy enterprise ERP platform to a modern web architecture.', 'a3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 'active'),
  ('92222222-2222-2222-2222-222222222222', 'PRJ-BETA', 'Cloud Data Pipeline', 'Beta Analytics', 'Building a high-throughput stream processing pipeline in AWS.', 'a3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 'active');

-- 4. Seed Project Members
insert into public.project_members (project_id, team_member_id, assigned_by)
values
  ('91111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 'a3333333-3333-3333-3333-333333333333'),
  ('91111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555', 'a3333333-3333-3333-3333-333333333333'),
  ('92222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', 'a3333333-3333-3333-3333-333333333333');

-- 5. Seed Tasks
insert into public.tasks (id, project_id, project_code, project_name, title, description, assigned_by, assigned_to, assigned_by_role, priority, start_date, target_date, status, progress_percent, remarks, attachment_url)
values
  ('b1111111-1111-1111-1111-111111111111', '91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Core System Redesign', 'Database Schema Design', 'Design the relational database structure and export DDL schemas.', 'a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'manager', 'critical', '2026-05-10', '2026-05-20', 'in_progress', 60, null, null),
  ('b2222222-2222-2222-2222-222222222222', '91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Core System Redesign', 'Setup API Gateway', 'Configure routing and authentication middleware on the gatekeeper service.', 'a3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'team_leader', 'high', '2026-05-12', '2026-05-22', 'completed_by_member', 100, 'api_specs.json', null),
  ('b3333333-3333-3333-3333-333333333333', '91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Core System Redesign', 'UI Redesign Screen Drafts', 'Develop the pixel-perfect Figma screens for the user settings view.', 'a3333333-3333-3333-3333-333333333333', 'a5555555-5555-5555-5555-555555555555', 'team_leader', 'medium', '2026-05-15', '2026-05-24', 'pending', 0, null, null),
  ('b4444444-4444-4444-4444-444444444444', '92222222-2222-2222-2222-222222222222', 'PRJ-BETA', 'Cloud Data Pipeline', 'Terraform Infrastructure Configuration', 'Script AWS resources including S3 buckets, Lambdas, and Kinesis streams.', 'a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'manager', 'critical', '2026-05-11', '2026-05-26', 'assigned', 20, null, null),
  ('b5555555-5555-5555-5555-555555555555', '92222222-2222-2222-2222-222222222222', 'PRJ-BETA', 'Cloud Data Pipeline', 'Write Log Parser Functions', 'Implement lambda functions to deserialize and audit incoming stream formats.', 'a3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'team_leader', 'high', '2026-05-14', '2026-05-19', 'rework_required', 40, null, null);

-- 6. Seed Task Comments
insert into public.task_comments (id, task_id, author_id, comment, created_at)
values
  ('c1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', 'Completed code implementation and ran local testing suites.', '2026-05-20T10:00:00Z'),
  ('c2222222-2222-2222-2222-222222222222', 'b5555555-5555-5555-5555-555555555555', 'a3333333-3333-3333-3333-333333333333', 'The parser fails on negative numerical fields. Please add boundary tests.', '2026-05-20T15:30:00Z');

-- 7. Seed Achievements
insert into public.achievements (id, project_id, project_code, title, details, submitted_by, submitted_at, approval_status, manager_remarks)
values
  ('d1111111-1111-1111-1111-111111111111', '91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Successful Schema Migration', 'Migrated 10M rows of legacy production schema to Postgres in 15 minutes.', 'a4444444-4444-4444-4444-444444444444', '2026-05-20 08:30:00+00', 'pending', null),
  ('d2222222-2222-2222-2222-222222222222', '92222222-2222-2222-2222-222222222222', 'PRJ-BETA', 'Alpha Analytics Delivery', 'Completed stream metrics ingestion dashboard 3 days ahead of schedule.', 'a3333333-3333-3333-3333-333333333333', '2026-05-18 12:00:00+00', 'approved', 'Outstanding effort. Excellent work!');

-- 8. Seed Issues
insert into public.issues (id, project_id, project_code, title, description, category, priority, raised_by, raised_at, status, resolution_remarks)
values
  ('e1111111-1111-1111-1111-111111111111', '91111111-1111-1111-1111-111111111111', 'PRJ-ALPHA', 'Staging Server Resource Limits', 'Staging pods are throwing OutOfMemory exception during heavy batch uploads.', 'technical', 'high', 'a4444444-4444-4444-4444-444444444444', '2026-05-20 14:00:00+00', 'open', null),
  ('e2222222-2222-2222-2222-222222222222', '92222222-2222-2222-2222-222222222222', 'PRJ-BETA', 'Delay in API specifications', 'Wait time for Beta Corp endpoint definitions is affecting development cycles.', 'delay', 'critical', 'a3333333-3333-3333-3333-333333333333', '2026-05-19 16:30:00+00', 'in_progress', 'We have escalated this to Beta management.');

-- 9. Seed Activity Logs
insert into public.activity_logs (id, project_id, user_id, action, details, created_at)
values
  ('f1111111-1111-1111-1111-111111111111', null, 'a1111111-1111-1111-1111-111111111111', 'Database Initialized', '{"message": "Loaded default seeding organization users and settings."}'::jsonb, '2026-05-10T08:00:00Z'),
  ('f2222222-2222-2222-2222-222222222222', '91111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'Project Registered', '{"message": "Registered Core System Redesign project and assigned Robert Stark as TL."}'::jsonb, '2026-05-10T09:30:00Z');


-- ============================================================================
-- Backfill Existing Seed Projects
insert into public.project_stages (project_id, stage_name, status)
select id, stage, 'pending'
from public.projects,
(values
  ('Project Kickoff Meeting'),
  ('Project Data Collection'),
  ('Offline Development'),
  ('DAPs'),
  ('Virtual Commissioning'),
  ('Onsite Commissioning'),
  ('Data Handover'),
  ('Production Support')
) as stages(stage)
on conflict (project_id, stage_name) do nothing;

