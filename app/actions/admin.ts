'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Admin client using service role key (bypasses RLS and auth restrictions)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function registerUserAction(formData: {
  employee_id: string
  name: string
  email: string
  password?: string
  role: string
  designation: string
}) {
  console.log("=== registerUserAction CALLED ===", formData);
  try {
    // 1. Security Check: Verify caller is an Admin
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only administrators can register users.' }
    }

    // 2. Perform the User Creation
    const { employee_id, email, password, name, role, designation } = formData

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { employee_id, name, role, designation },
    })

    if (authError) {
      throw new Error(authError.message)
    }

    if (!authData.user) {
      throw new Error('Failed to retrieve created user.')
    }

    // 3. Update public.users
    // The database trigger public.handle_new_user defaults everyone to 'team_member' for security.
    // We must forcefully override it now.
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        employee_id,
        role,
        designation,
      })
      .eq('id', authData.user.id)

    if (updateError) {
      throw new Error(`User auth created, but failed to apply role: ${updateError.message}`)
    }

    return { success: true }
  } catch (err: any) {
    console.error("=== registerUserAction ERROR ===", err);
    return { success: false, error: err.message || 'Unknown error occurred' }
  }
}

export async function deleteUserAction(targetUserId: string) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Access Denied: Only administrators can delete users.' }
    }

    // Delete user from auth.users (this automatically cascades to public.users)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

    if (error) {
      throw new Error(`Failed to delete auth user: ${error.message}`)
    }

    return { success: true }
  } catch (err: any) {
    console.error("=== deleteUserAction ERROR ===", err);
    return { success: false, error: err.message || 'Unknown error occurred' }
  }
}
