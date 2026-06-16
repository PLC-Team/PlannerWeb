'use server';

import { createClient } from '@supabase/supabase-js';

export async function getEmailFromEmployeeId(employeeId: string) {
  if (!employeeId) return { error: 'Employee ID is required' };

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('employee_id', employeeId)
      .single();

    if (error || !data) {
      return { error: 'Employee ID not found' };
    }

    return { email: data.email };
  } catch (err: any) {
    return { error: 'An unexpected error occurred.' };
  }
}
