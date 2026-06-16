'use server';

import { createClient } from '@supabase/supabase-js';

export async function getAllProjectCodes() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('project_code')
      .eq('status', 'active')
      .order('project_code', { ascending: true });

    if (error) {
      console.error('Error fetching all project codes:', error);
      return { success: false, codes: [] };
    }

    const codes = data.map((p: any) => p.project_code).filter(Boolean);
    const uniqueCodes = Array.from(new Set(codes)) as string[];

    return { success: true, codes: uniqueCodes };
  } catch (err: any) {
    console.error('Unexpected error fetching all project codes:', err);
    return { success: false, codes: [] };
  }
}
