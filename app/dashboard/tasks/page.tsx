'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Task, User, Project } from '@/types';
import { CheckSquare, AlertTriangle, Clock, Loader2, ArrowRight, Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManagerTasksDashboard() {
  const { user } = useUser();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [delayedActivities, setDelayedActivities] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      if (user.role !== 'manager' && user.role !== 'admin') {
        router.push('/dashboard/home');
      } else {
        fetchData();
      }
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users for mapping IDs to names
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) setUsers(usersData);

      // Fetch pending tasks assigned by Managers or TLs
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*, projects(project_name)')
        .in('status', ['pending', 'assigned', 'in_progress'])
        .in('assigned_by_role', ['manager', 'team_leader'])
        .order('created_at', { ascending: false });

      if (tasksData) {
        setTasks(tasksData);
      }

      // Fetch all project stages to extract delayed activities
      const { data: stagesData, error: stagesError } = await supabase
        .from('project_stages')
        .select('*, projects(project_name, project_code)');

      if (stagesData) {
        const delayed: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        stagesData.forEach((stage: any) => {
          if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
            try {
              const parsed = JSON.parse(stage.remarks);
              if (parsed && parsed.subTasks) {
                parsed.subTasks.forEach((st: any, idx: number) => {
                  if (st.status === 'pending' || st.status === 'in_progress') {
                    if (st.targetDate) {
                      const tDate = new Date(st.targetDate);
                      if (tDate < today) {
                        delayed.push({
                          projectId: stage.project_id,
                          projectName: stage.projects?.project_name || 'Unknown Project',
                          projectCode: stage.projects?.project_code || '',
                          stageName: stage.stage_name,
                          activityName: st.title,
                          targetDate: st.targetDate,
                          status: st.status,
                          type: 'Main Point'
                        });
                      }
                    }
                  }

                  if (st.subPoints && st.subPoints.length > 0) {
                    st.subPoints.forEach((sp: any) => {
                      if (sp.status === 'pending' || sp.status === 'in_progress') {
                        if (sp.targetDate) {
                          const tDate = new Date(sp.targetDate);
                          if (tDate < today) {
                            delayed.push({
                              projectId: stage.project_id,
                              projectName: stage.projects?.project_name || 'Unknown Project',
                              projectCode: stage.projects?.project_code || '',
                              stageName: stage.stage_name,
                              activityName: sp.title,
                              targetDate: sp.targetDate,
                              status: sp.status,
                              type: 'Sub Point'
                            });
                          }
                        }
                      }
                    });
                  }
                });
              }
            } catch (e) {
              console.error('Error parsing JSON for stage:', stage.id, e);
            }
          }
        });

        // Group delayed activities by project
        const groupedDelayed = delayed.reduce((acc, curr) => {
          if (!acc[curr.projectName]) acc[curr.projectName] = [];
          acc[curr.projectName].push(curr);
          return acc;
        }, {} as Record<string, any[]>);

        // Convert to array format for easier rendering
        const groupedArray = Object.keys(groupedDelayed).map(projName => ({
          projectName: projName,
          projectId: groupedDelayed[projName][0].projectId,
          activities: groupedDelayed[projName].sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
        }));

        setDelayedActivities(groupedArray);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? u.name : 'Unknown';
  };

  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '-';
      return `${String(d.getDate()).padStart(2, '0')}:${String(d.getMonth() + 1).padStart(2, '0')}:${d.getFullYear()}`;
    } catch (e) {
      return '-';
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[#0f172a] flex items-center gap-3">
          <CheckSquare className="w-7 h-7 text-blue-600" />
          Tasks Dashboard
        </h1>
        <p className="text-slate-500">
          Overview of pending tasks assigned by leadership and delayed project activities.
        </p>
      </div>

      {/* Pending Assigned Tasks */}
      <div className="bg-white border border-[#93c5fd] p-6 rounded-xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Pending Tasks (Assigned by Managers & TLs)
        </h2>
        
        {tasks.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No pending tasks found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm text-[#0f172a]">
              <thead className="bg-[#f8fafc] text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Task Title & Details</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Assigned By</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/projects/${task.project_id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f172a] group-hover:text-blue-600 transition-colors flex items-center">
                        {task.title}
                        {task.priority === 'critical' && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200">Critical</span>}
                      </div>
                      {task.description && (
                        <div className="text-sm text-slate-500 font-normal mt-1 whitespace-pre-wrap">{task.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{task.projects?.project_name || 'N/A'}</td>
                    <td className="px-4 py-3">{getUserName(task.assigned_to)}</td>
                    <td className="px-4 py-3">{getUserName(task.assigned_by)}</td>
                    <td className="px-4 py-3">{formatDateDDMMYYYY(task.target_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold
                        ${task.status === 'in_progress' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                          'bg-slate-100 text-slate-600 border border-slate-200'}
                      `}>
                        {task.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delayed Project Activities */}
      <div className="bg-white border border-[#93c5fd] p-6 rounded-xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Delayed Project Flow Activities
        </h2>

        {delayedActivities.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckSquare className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
            <p className="text-slate-500">Great job! There are no delayed project flow activities.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {delayedActivities.map((group, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-sm">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex justify-between items-center cursor-pointer hover:bg-red-100 transition-colors" onClick={() => router.push(`/projects/${group.projectId}`)}>
                  <h3 className="font-bold text-red-600 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    {group.projectName}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded font-semibold">
                      {group.activities.length} Delayed
                    </span>
                    <ArrowRight className="w-4 h-4 text-red-400" />
                  </div>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-[#0f172a]">
                    <thead className="bg-[#f8fafc] text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Line / Stage</th>
                        <th className="px-4 py-3">Activity</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Target Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.activities.map((act: any, actIdx: number) => (
                        <tr key={actIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 font-medium text-slate-700">{act.stageName}</td>
                          <td className="px-4 py-2 text-[#0f172a]">{act.activityName}</td>
                          <td className="px-4 py-2">
                            <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              {act.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-red-600 font-medium">
                            {formatDateDDMMYYYY(act.targetDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
