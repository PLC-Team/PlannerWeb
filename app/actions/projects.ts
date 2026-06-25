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

export async function replacePunchPoints(projectId: string, inserts: any[]) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Delete existing
    const { error: delError, data: deletedData } = await supabaseAdmin
      .from('punch_points')
      .delete()
      .eq('project_id', projectId)
      .select('id');

    if (delError) throw delError;

    // 2. Insert new
    if (inserts.length > 0) {
      const { error: insError } = await supabaseAdmin
        .from('punch_points')
        .insert(inserts);
      
      if (insError) throw insError;
    }

    return { success: true, deletedCount: deletedData?.length || 0 };
  } catch (err: any) {
    console.error('Error replacing punch points:', err);
    return { success: false, error: err.message };
  }
}

export async function renameProjectLine(projectId: string, oldLineName: string, newLineName: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: stages, error: fetchError } = await supabaseAdmin
      .from('project_stages')
      .select('id, stage_name')
      .eq('project_id', projectId);

    if (fetchError) throw fetchError;

    const oldStages = (stages || []).filter(s => {
      if (s.stage_name === 'Project Kickoff Meeting') return false;
      let currentLineName = 'Main Line';
      if (s.stage_name.includes(' - ')) {
        currentLineName = s.stage_name.split(' - ')[0];
      }
      return currentLineName === oldLineName;
    });

    const updatePromises = oldStages.map(stage => {
      let stageType = stage.stage_name;
      if (stage.stage_name.includes(' - ')) {
        stageType = stage.stage_name.split(' - ').slice(1).join(' - ');
      }
      
      let newStageName = stageType;
      if (newLineName !== 'Main Line') {
        newStageName = `${newLineName} - ${stageType}`;
      }

      return supabaseAdmin
        .from('project_stages')
        .update({ stage_name: newStageName })
        .eq('id', stage.id);
    });

    const results = await Promise.all(updatePromises);
    const failedUpdate = results.find(r => r.error);
    if (failedUpdate) throw failedUpdate.error;

    return { success: true };
  } catch (err: any) {
    console.error('Error renaming line:', err);
    return { success: false, error: err.message };
  }
}

export async function addProjectLine(projectId: string, stagesToInsert: any[]) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('project_stages')
      .insert(stagesToInsert)
      .select();

    if (error) throw error;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error adding line:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteProjectLine(projectId: string, lineToDelete: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: stages, error: fetchError } = await supabaseAdmin
      .from('project_stages')
      .select('id, stage_name')
      .eq('project_id', projectId);

    if (fetchError) throw fetchError;

    const stagesToDelete = (stages || []).filter(s => {
      if (s.stage_name === 'Project Kickoff Meeting') return false;
      let currentLineName = 'Main Line';
      if (s.stage_name.includes(' - ')) {
        currentLineName = s.stage_name.split(' - ')[0];
      }
      return currentLineName === lineToDelete;
    });

    const stageIds = stagesToDelete.map(s => s.id);

    if (stageIds.length > 0) {
      const { error } = await supabaseAdmin
        .from('project_stages')
        .delete()
        .in('id', stageIds);
      if (error) throw error;
    }

    return { success: true, deletedIds: stageIds };
  } catch (err: any) {
    console.error('Error deleting line:', err);
    return { success: false, error: err.message };
  }
}
