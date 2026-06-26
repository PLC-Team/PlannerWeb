'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Task, User, Project } from '@/types';
import { CheckSquare, AlertTriangle, Clock, Loader2, ArrowRight, Folder, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManagerTasksDashboard() {
  const { user } = useUser();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [delayedActivities, setDelayedActivities] = useState<any[]>([]);

  // Modal states
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openTaskDetails = (task: any) => {
    setSelectedTask(task);
    setEditTargetDate(task.target_date ? task.target_date.split('T')[0] : '');
    setEditRemarks(task.remarks || '');
    setEditReason('');
    setIsTaskDetailsOpen(true);
  };
  
  const handleSaveTaskDetails = async () => {
    if (!selectedTask) return;
    
    const oldDateStr = selectedTask.target_date ? selectedTask.target_date.split('T')[0] : '';
    const targetDateChanged = editTargetDate !== oldDateStr;
    
    if (targetDateChanged && !editReason.trim()) {
      alert("Reason is mandatory when modifying the target date.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          target_date: editTargetDate || null,
          remarks: editRemarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      if (targetDateChanged) {
        await supabase.from('activity_logs').insert({
          project_id: selectedTask.project_id,
          task_id: selectedTask.id,
          user_id: user?.id,
          action: 'Target Date Changed',
          details: `Target date changed from ${oldDateStr || 'None'} to ${editTargetDate}. Reason: ${editReason}`
        });
      }

      setTasks(prev => prev.map(t => 
        t.id === selectedTask.id ? { ...t, target_date: editTargetDate || null, remarks: editRemarks } : t
      ));
      
      setIsTaskDetailsOpen(false);
      setSelectedTask(null);
    } catch (error: any) {
      alert('Error updating task: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColorClass = (priority: string) => {
    switch(priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getStatusColorClass = (status: string) => {
    switch(status) {
      case 'completed_by_member': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'approved_by_tl': return 'bg-teal-500/20 text-teal-400 border-teal-500/50';
      case 'closed': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'rework_required': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      case 'in_progress': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
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
    <div className="relative min-h-screen bg-[#dbeafe] text-[#0f172a] p-1 md:p-2 -mt-4 md:-mt-8 -mx-4 md:-mx-8">
      <div className="relative z-10 flex flex-col gap-3 animated-fade">
      
        {/* HEADER MATCHING PROJECT DETAIL PAGE */}
        <div className="relative bg-[#090f1d]/90 border border-white/10 p-4 md:p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
            <button 
              onClick={() => router.push(`/dashboard/${user?.role?.replace('_', '-')}`)}
              className="p-2 rounded-lg bg-[#0d1527] border border-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#1e293b] hover:border-[#00f0ff]/50 transition-all shadow-sm"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase font-heading leading-tight flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#00f0ff]" />
                TASKS DASHBOARD
              </h1>
              <p className="text-sm text-gray-400 mt-1 font-mono tracking-wider">
                OVERVIEW OF PENDING TASKS & DELAYED ACTIVITIES
              </p>
            </div>
          </div>
        </div>

        <div className="w-full mx-auto px-1 md:px-2 py-4 space-y-8">

      {/* Pending Assigned Tasks */}
      <div className="bg-white border border-[#93c5fd] p-6 rounded-xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Pending Tasks
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
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => openTaskDetails(task)}>
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
      {/* Task Details Modal */}
      {isTaskDetailsOpen && selectedTask && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-2xl p-6 rounded-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#00f0ff]/40 rounded-br" />

            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap text-[9px] font-bold">
                  <span className={`px-2 py-0.5 rounded uppercase border ${getPriorityColorClass(selectedTask.priority)}`}>
                    {selectedTask.priority} Priority
                  </span>
                  <span className={`px-2 py-0.5 rounded uppercase border ${getStatusColorClass(selectedTask.status)}`}>
                    Status: {selectedTask.status === 'closed' ? 'Approved' : selectedTask.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white uppercase mt-2 tracking-wide flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
                  {selectedTask.title}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsTaskDetailsOpen(false);
                  setSelectedTask(null);
                }}
                className="text-gray-400 hover:text-white transition font-mono font-bold text-xs bg-[#0d1527] border border-slate-700 hover:bg-white/10 px-2 py-1 rounded border border-white/10"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Details Fields Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px] bg-black/45 p-3.5 rounded-lg border border-white/5">
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">ASSIGNED TO</span>
                <span className="text-[#00f0ff] font-bold block mt-0.5 uppercase">{getUserName(selectedTask.assigned_to)}</span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">ASSIGNED BY</span>
                <span className="text-white font-bold block mt-0.5 uppercase">
                  {getUserName(selectedTask.assigned_by)}
                </span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">START DATE</span>
                <span className="text-white font-bold block mt-0.5">{selectedTask.start_date ? selectedTask.start_date.split('T')[0] : '-'}</span>
              </div>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">TARGET DATE</label>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="bg-[#090f1d] border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                />
              </div>

              {(selectedTask.target_date ? selectedTask.target_date.split('T')[0] : '') !== editTargetDate && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-red-400 font-bold uppercase tracking-widest">REASON FOR CHANGE <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Mandatory reason for changing date"
                    className="bg-[#090f1d] border border-red-500/50 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2"
                  />
                </div>
              )}

              <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">REMARKS / COMMENTS</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="bg-[#090f1d] border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 min-h-[80px]"
                  placeholder="Enter remarks or guidelines..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="text-xs border-t border-white/10 pt-4">
              <h4 className="font-bold text-gray-500 uppercase tracking-widest text-[8px] mb-1">// TASK DESCRIPTION //</h4>
              <p className="text-gray-300 leading-relaxed bg-[#0d1527]/50 p-3 rounded border border-white/5">
                {selectedTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Actions Section */}
            <div className="border-t border-white/10 pt-4 flex justify-end">
              <button
                onClick={handleSaveTaskDetails}
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-6 rounded-lg tracking-widest uppercase transition-all duration-300 disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
