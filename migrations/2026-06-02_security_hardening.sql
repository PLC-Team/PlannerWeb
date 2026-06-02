-- Security Hardening Migration
-- Date: 2026-06-02

-- 1. Fix Privilege Escalation in handle_new_user (Issue #1)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role, designation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    'team_member', -- ✅ never from client metadata
    coalesce(new.raw_user_meta_data->>'designation', 'Staff')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. Restrict Notifications Insert Policy (Issue #7)
drop policy if exists "System can create notifications" on public.notifications;
create policy "Users can create notifications securely"
  on public.notifications for insert to authenticated with check (
    -- Allow admins, managers, and team leaders to create notifications for others
    public.current_user_role(auth.uid()) in ('admin', 'manager', 'team_leader')
    -- OR allow users to create notifications for themselves (if needed)
    or auth.uid() = user_id
  );

-- 3. Scope Task Comments Select Policy (Issue #8)
drop policy if exists "Users can read task comments" on public.task_comments;
create policy "Users can read relevant task comments"
  on public.task_comments for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and (
        public.current_user_role(auth.uid()) = 'admin' or
        t.assigned_team_leader_id = auth.uid() or
        t.assigned_team_member_id = auth.uid() or
        exists (
          select 1 from public.projects p
          where p.project_code = t.project_code and
          p.assigned_team_leader_id = auth.uid()
        )
      )
    )
  );

-- 4. Define delete_user_completely RPC securely (Issue #10)
create or replace function public.delete_user_completely(user_id_to_delete uuid)
returns void as $$
begin
  -- Only allow admins to execute this
  if (select role from public.users where id = auth.uid()) <> 'admin' then
    raise exception 'Unauthorized: Only admins can delete users completely.';
  end if;

  -- Delete from auth.users (cascades to public.users and other tables if foreign keys are configured properly)
  delete from auth.users where id = user_id_to_delete;
end;
$$ language plpgsql security definer set search_path = public;
