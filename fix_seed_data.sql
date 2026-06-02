-- ============================================================
-- DIAGNOSTIC QUERY - Run this and share the results
-- ============================================================

-- 1. Check all users and their roles
SELECT '=== USERS ===' as section, id, name, email, role FROM public.users ORDER BY role;

-- 2. Check all projects that exist
SELECT '=== PROJECTS ===' as section, id, project_code, project_name, created_by, assigned_team_leader_id, status FROM public.projects;

-- 3. Check if the manager's user ID matches projects created_by
SELECT 
  '=== PROJECT OWNERSHIP CHECK ===' as section,
  p.project_name,
  p.created_by,
  u.name as creator_name,
  u.email as creator_email,
  u.role as creator_role
FROM public.projects p
LEFT JOIN public.users u ON u.id = p.created_by;

-- 4. Check if TL assignment matches TL user IDs  
SELECT 
  '=== TL ASSIGNMENT CHECK ===' as section,
  p.project_name,
  p.assigned_team_leader_id,
  u.name as tl_name,
  u.email as tl_email
FROM public.projects p
LEFT JOIN public.users u ON u.id = p.assigned_team_leader_id;
