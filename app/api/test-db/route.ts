import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: delError, data: delData } = await supabaseAdmin
      .from('punch_points')
      .delete()
      .eq('project_id', projectId)
      .select('id');

    return NextResponse.json({
      success: true,
      deletedCount: delData?.length || 0,
      delError
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
