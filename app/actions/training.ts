'use server';

import { createClient } from '@supabase/supabase-js';

// We use the standard supabase-js client with the service role key to bypass RLS
// because activity_logs RLS might block reads for rows without a project_id
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getTrainingAttendees(trainingId: string) {
  const supabase = getAdminSupabase();
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('user_id')
    .eq('action', 'JOINED_TRAINING')
    .contains('details', { training_id: trainingId });

  if (error) {
    console.error('Error fetching attendees logs:', error);
    return [];
  }

  if (!logs || logs.length === 0) return [];

  const userIds = logs.map(l => l.user_id).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  if (userIds.length === 0) return [];

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching attendee users:', usersError);
    return [];
  }

  return usersData.map(u => ({ user_id: u.id, name: u.name }));
}

export async function getAllTrainingAttendeeCounts() {
  const supabase = getAdminSupabase();
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('user_id, details')
    .eq('action', 'JOINED_TRAINING');

  const attendeeSets: Record<string, Set<string>> = {};
  if (error || !logs) return {};

  logs.forEach(log => {
    const tid = log.details?.training_id;
    const uid = log.user_id;
    if (tid && uid) {
      if (!attendeeSets[tid]) {
        attendeeSets[tid] = new Set();
      }
      attendeeSets[tid].add(uid);
    }
  });

  const attendeeCounts: Record<string, number> = {};
  for (const tid in attendeeSets) {
    attendeeCounts[tid] = attendeeSets[tid].size;
  }

  return attendeeCounts;
}

export async function joinTrainingAction(trainingId: string, userId: string) {
  const supabase = getAdminSupabase();
  
  // First check if already joined
  const { data: existing } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'JOINED_TRAINING')
    .contains('details', { training_id: trainingId })
    .single();
    
  if (existing) {
    // Already joined
    return { success: true };
  }

  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'JOINED_TRAINING',
    details: { training_id: trainingId }
  });

  if (error) {
    console.error('Error joining training:', error);
    throw new Error('Failed to join training');
  }
  
  return { success: true };
}
