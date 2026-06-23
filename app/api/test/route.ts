import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const projectId = 'test-id';
  
  await supabaseAdmin.from('punch_points').insert([{ project_id: projectId, concern: 'test 1', line: '1', station_no: '1', status: 'Open' }]);
  await supabaseAdmin.from('punch_points').insert([{ project_id: projectId, concern: 'test 2', line: '1', station_no: '1', status: 'Open' }]);
  
  const { data: b4 } = await supabaseAdmin.from('punch_points').select('*').eq('project_id', projectId);
  
  const { error: delError, data: delData } = await supabaseAdmin.from('punch_points').delete().eq('project_id', projectId).select();
  
  const { data: af } = await supabaseAdmin.from('punch_points').select('*').eq('project_id', projectId);
  
  return NextResponse.json({
    before: b4?.length,
    deleted: delData?.length,
    after: af?.length,
    delError
  });
}
