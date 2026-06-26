'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Task, User, Project } from '@/types';
import { CheckSquare, AlertTriangle, Clock, Loader2, ArrowRight, Folder, ArrowLeft, TrendingUp, CheckCircle, ChevronDown, ChevronUp, ChevronRight, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManagerTasksDashboard() {
  const { user } = useUser();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [delayedActivities, setDelayedActivities] = useState<any[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<any[]>([]);

  // Modal states
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'task' | 'delayed'>('task');
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // New KPI states
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [completedThisWeekCount, setCompletedThisWeekCount] = useState(0);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedUpcomingProjects, setExpandedUpcomingProjects] = useState<Set<string>>(new Set());

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

      // Fetch Active Projects Count
      const { count: activeCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'in_progress']);
      if (activeCount !== null) setActiveProjectsCount(activeCount);

      // Fetch Completed Tasks This Week Count
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { count: completedCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['completed_by_member', 'approved_by_tl', 'closed'])
        .gte('updated_at', oneWeekAgo.toISOString());
      if (completedCount !== null) setCompletedThisWeekCount(completedCount);

      // Fetch all project stages to extract delayed activities
      const { data: stagesData, error: stagesError } = await supabase
        .from('project_stages')
        .select('*, projects(project_name, project_code)');

      if (stagesData) {
        const delayed: any[] = [];
        const upcoming: any[] = [];
        const projectProgressMap: Record<string, { total: number; completed: number }> = {};

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        stagesData.forEach((stage: any) => {
          // Initialize project progress tracking
          if (!projectProgressMap[stage.project_id]) {
            projectProgressMap[stage.project_id] = { total: 0, completed: 0 };
          }
          projectProgressMap[stage.project_id].total++;
          if (stage.status === 'completed') {
            projectProgressMap[stage.project_id].completed++;
          }
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
                          stageId: stage.id,
                          stageName: stage.stage_name,
                          activityName: st.title,
                          targetDate: st.targetDate,
                          startDate: st.startDate,
                          status: st.status,
                          type: 'Main Point',
                          subTaskIdx: idx
                        });
                      }
                    }
                    if (st.startDate) {
                      const sDate = new Date(st.startDate);
                      sDate.setHours(0, 0, 0, 0);
                      if (sDate >= today && sDate <= tomorrow) {
                        upcoming.push({
                          projectId: stage.project_id,
                          projectName: stage.projects?.project_name || 'Unknown Project',
                          projectCode: stage.projects?.project_code || '',
                          stageId: stage.id,
                          stageName: stage.stage_name,
                          activityName: st.title,
                          targetDate: st.targetDate,
                          startDate: st.startDate,
                          status: st.status,
                          type: 'Main Point',
                          subTaskIdx: idx
                        });
                      }
                    }
                  }

                  if (st.subPoints && st.subPoints.length > 0) {
                    st.subPoints.forEach((sp: any, spIdx: number) => {
                      if (sp.status === 'pending' || sp.status === 'in_progress') {
                        if (sp.targetDate) {
                          const tDate = new Date(sp.targetDate);
                          if (tDate < today) {
                            delayed.push({
                              projectId: stage.project_id,
                              projectName: stage.projects?.project_name || 'Unknown Project',
                              projectCode: stage.projects?.project_code || '',
                              stageId: stage.id,
                              stageName: stage.stage_name,
                              activityName: sp.title,
                              targetDate: sp.targetDate,
                              startDate: sp.startDate,
                              status: sp.status,
                              type: 'Sub Point',
                              subTaskIdx: idx,
                              subPointIdx: spIdx
                            });
                          }
                        }
                        if (sp.startDate) {
                          const sDate = new Date(sp.startDate);
                          sDate.setHours(0, 0, 0, 0);
                          if (sDate >= today && sDate <= tomorrow) {
                            upcoming.push({
                              projectId: stage.project_id,
                              projectName: stage.projects?.project_name || 'Unknown Project',
                              projectCode: stage.projects?.project_code || '',
                              stageId: stage.id,
                              stageName: stage.stage_name,
                              activityName: sp.title,
                              targetDate: sp.targetDate,
                              startDate: sp.startDate,
                              status: sp.status,
                              type: 'Sub Point',
                              subTaskIdx: idx,
                              subPointIdx: spIdx
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

        const groupedDelayed = delayed.reduce((acc, curr) => {
          if (!acc[curr.projectName]) acc[curr.projectName] = [];
          acc[curr.projectName].push(curr);
          return acc;
        }, {} as Record<string, any[]>);

        const groupedDelayedArray = Object.keys(groupedDelayed).map(projName => {
          const acts = groupedDelayed[projName].sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
          const projId = acts[0].projectId;
          const progData = projectProgressMap[projId] || { total: 1, completed: 0 };
          const progressPct = progData.total > 0 ? Math.round((progData.completed / progData.total) * 100) : 0;
          
          return {
            projectName: projName,
            projectId: projId,
            progressPct,
            activities: acts
          };
        });

        setDelayedActivities(groupedDelayedArray);

        // Group upcoming activities by project
        const groupedUpcoming = upcoming.reduce((acc, curr) => {
          if (!acc[curr.projectName]) acc[curr.projectName] = [];
          acc[curr.projectName].push(curr);
          return acc;
        }, {} as Record<string, any[]>);

        const groupedUpcomingArray = Object.keys(groupedUpcoming).map(projName => {
          const acts = groupedUpcoming[projName].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          const projId = acts[0].projectId;
          const progData = projectProgressMap[projId] || { total: 1, completed: 0 };
          const progressPct = progData.total > 0 ? Math.round((progData.completed / progData.total) * 100) : 0;
          
          return {
            projectName: projName,
            projectId: projId,
            progressPct,
            activities: acts
          };
        });

        setUpcomingActivities(groupedUpcomingArray);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTaskDetails = (task: any) => {
    setSelectedType('task');
    setSelectedTask(task);
    setEditTargetDate(task.target_date ? task.target_date.split('T')[0] : '');
    setEditRemarks(task.remarks || '');
    setEditReason('');
    setIsTaskDetailsOpen(true);
  };

  const openDelayedActivityDetails = (act: any) => {
    setSelectedType('delayed');
    setSelectedTask(act);
    setEditTargetDate(act.targetDate ? act.targetDate.split('T')[0] : '');
    // JSON tasks don't currently expose remarks natively in the card, but we can set it empty or fetch it
    setEditRemarks('');
    setEditReason('');
    setIsTaskDetailsOpen(true);
  };
  
  const handleSaveTaskDetails = async () => {
    if (!selectedTask) return;
    
    let oldDateStr = '';
    if (selectedType === 'task') {
      oldDateStr = selectedTask.target_date ? selectedTask.target_date.split('T')[0] : '';
    } else {
      oldDateStr = selectedTask.targetDate ? selectedTask.targetDate.split('T')[0] : '';
    }

    const targetDateChanged = editTargetDate !== oldDateStr;
    
    if (targetDateChanged && !editReason.trim()) {
      alert("Reason is mandatory when modifying the target date.");
      return;
    }

    setSaving(true);
    try {
      if (selectedType === 'task') {
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
      } else {
        // Delayed Activity Update
        const { data: stageInfo, error: fetchErr } = await supabase
          .from('project_stages')
          .select('remarks')
          .eq('id', selectedTask.stageId)
          .single();

        if (fetchErr) throw fetchErr;

        let parsed = JSON.parse(stageInfo.remarks);
        
        if (selectedTask.type === 'Main Point') {
          parsed.subTasks[selectedTask.subTaskIdx].targetDate = editTargetDate || null;
          // Note: The UI doesn't show these remarks, but we save them in the JSON
          parsed.subTasks[selectedTask.subTaskIdx].remarks = editRemarks;
        } else {
          parsed.subTasks[selectedTask.subTaskIdx].subPoints[selectedTask.subPointIdx].targetDate = editTargetDate || null;
          parsed.subTasks[selectedTask.subTaskIdx].subPoints[selectedTask.subPointIdx].remarks = editRemarks;
        }

        const { error: updateErr } = await supabase
          .from('project_stages')
          .update({
            remarks: JSON.stringify(parsed)
          })
          .eq('id', selectedTask.stageId);

        if (updateErr) throw updateErr;

        if (targetDateChanged) {
          await supabase.from('activity_logs').insert({
            project_id: selectedTask.projectId,
            user_id: user?.id,
            action: 'Stage Activity Target Date Changed',
            details: `Target date for ${selectedTask.activityName} changed from ${oldDateStr || 'None'} to ${editTargetDate}. Reason: ${editReason}`
          });
        }

        // Re-fetch data to update delayed activities array
        fetchData();
      }
      
      setIsTaskDetailsOpen(false);
      setSelectedTask(null);
    } catch (error: any) {
      alert('Error updating: ' + error.message);
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

  const formatDateMMM = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '-';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return '-';
    }
  };

  const getDaysOverdue = (date: string | Date): number => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - d.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

        {/* KPI Cards */}
        <div className="w-full mx-auto px-1 md:px-2 pt-2 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all cursor-default">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pending Tasks</p>
                <p className="text-2xl font-bold text-slate-800">{tasks.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all cursor-default">
              <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Delayed Activities</p>
                <p className="text-2xl font-bold text-slate-800">{delayedActivities.reduce((acc, curr) => acc + curr.activities.length, 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all cursor-default">
              <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Projects</p>
                <p className="text-2xl font-bold text-slate-800">{activeProjectsCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all cursor-default">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Completed This Week</p>
                <p className="text-2xl font-bold text-slate-800">{completedThisWeekCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full mx-auto px-1 md:px-2 py-2 space-y-6">

      {/* Pending Assigned Tasks */}
      <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
            <CheckSquare className="w-5 h-5" />
          </span>
          Pending Tasks
          <span className="ml-2 text-xs font-semibold bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full">{tasks.length} Pending</span>
        </h2>
        
        {tasks.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No pending tasks found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm text-[#0f172a]">
              <thead className="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 font-semibold">Task</th>
                  <th className="px-4 py-4 font-semibold">Project</th>
                  <th className="px-4 py-4 font-semibold">Assigned To</th>
                  <th className="px-4 py-4 font-semibold">Due Date</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => openTaskDetails(task)}>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center">
                        {task.title}
                        {task.priority === 'critical' && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200">Critical</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">{task.projects?.project_name || 'N/A'}</td>
                    <td className="px-4 py-4 font-medium">{getUserName(task.assigned_to)}</td>
                    <td className="px-4 py-4 font-medium text-slate-600">{formatDateMMM(task.target_date)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider flex w-max items-center gap-1.5
                        ${task.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : 
                          task.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                          task.status === 'delayed' ? 'bg-red-100 text-red-700' :
                          task.status === 'hold' || task.status === 'rework_required' ? 'bg-slate-100 text-slate-700' :
                          'bg-green-100 text-green-700'}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          task.status === 'in_progress' ? 'bg-orange-500' : 
                          task.status === 'assigned' ? 'bg-blue-500' :
                          task.status === 'delayed' ? 'bg-red-500' :
                          task.status === 'hold' || task.status === 'rework_required' ? 'bg-slate-500' :
                          'bg-green-500'
                        }`}></span>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delayed Project Activities Accordion */}
      <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100">
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <span className="bg-red-100 text-red-600 p-1.5 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </span>
          Delayed Project Flow Activities
        </h2>

        {delayedActivities.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckSquare className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
            <p className="text-slate-500">Great job! There are no delayed project flow activities.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {delayedActivities.map((group, idx) => {
              const maxOverdue = Math.max(...group.activities.map((a: any) => getDaysOverdue(a.targetDate)));
              const isExpanded = expandedProjects.has(group.projectId);
              
              const toggleExpand = () => {
                setExpandedProjects(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(group.projectId)) newSet.delete(group.projectId);
                  else newSet.add(group.projectId);
                  return newSet;
                });
              };

              return (
                <div key={idx} className={`bg-white rounded-xl border ${isExpanded ? 'border-red-300 shadow-md' : 'border-slate-200'} overflow-hidden transition-all duration-300`}>
                  
                  {/* Accordion Header */}
                  <div 
                    className={`px-5 py-4 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={toggleExpand}
                  >
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                        <h3 className="font-bold text-slate-800 text-base">{group.projectName}</h3>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Progress: {group.progressPct}%</span>
                        <div className="flex-1 max-w-[200px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              group.progressPct > 80 ? 'bg-emerald-500' : 
                              group.progressPct > 40 ? 'bg-blue-500' : 'bg-amber-500'
                            }`} 
                            style={{ width: `${group.progressPct}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <span className="text-sm bg-red-50 border border-red-100 text-red-600 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {group.activities.length} Delayed Activities
                        </span>
                        <span className="text-xs text-red-500 font-semibold uppercase tracking-wider">Target Date Overdue: {maxOverdue} Days</span>
                      </div>
                      <div className="text-slate-400 bg-white border border-slate-200 p-1.5 rounded-lg">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-white p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-[#0f172a]">
                          <thead className="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-100 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-5 py-3 font-semibold">Activity</th>
                              <th className="px-5 py-3 font-semibold">Overdue By</th>
                              <th className="px-5 py-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {group.activities.map((act: any, actIdx: number) => {
                              const daysOverdue = getDaysOverdue(act.targetDate);
                              return (
                                <tr key={actIdx} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-5 py-4">
                                    <div className="font-semibold text-slate-800">{act.activityName}</div>
                                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{act.stageName} • {act.type}</div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">{daysOverdue} Days</span>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        className="text-xs bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 font-semibold px-3 py-1.5 rounded transition-all"
                                        onClick={(e) => { e.stopPropagation(); openDelayedActivityDetails(act); }}
                                      >
                                        Update Date
                                      </button>
                                      <button 
                                        className="text-xs bg-white border border-slate-200 hover:border-slate-400 font-semibold px-3 py-1.5 rounded transition-all"
                                        onClick={(e) => { e.stopPropagation(); openDelayedActivityDetails(act); }}
                                      >
                                        Add Remark
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                        <button 
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
                          onClick={() => router.push(`/projects/${group.projectId}`)}
                        >
                          View Full Project Flow
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Project Activities Accordion */}
      <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 mt-6">
        <h2 className="text-lg font-bold text-[#0f172a] mb-6 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
            <Clock className="w-5 h-5" />
          </span>
          Upcoming Project Flow Activities (Next 24h)
        </h2>

        {upcomingActivities.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500">There are no upcoming project flow activities in the next 24 hours.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingActivities.map((group, idx) => {
              const isExpanded = expandedUpcomingProjects.has(group.projectId);
              
              const toggleExpand = () => {
                setExpandedUpcomingProjects(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(group.projectId)) newSet.delete(group.projectId);
                  else newSet.add(group.projectId);
                  return newSet;
                });
              };

              return (
                <div key={idx} className={`bg-white rounded-xl border ${isExpanded ? 'border-blue-300 shadow-md' : 'border-slate-200'} overflow-hidden transition-all duration-300`}>
                  
                  {/* Accordion Header */}
                  <div 
                    className={`px-5 py-4 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={toggleExpand}
                  >
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500 animate-pulse" />
                        <h3 className="font-bold text-slate-800 text-base">{group.projectName}</h3>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Progress: {group.progressPct}%</span>
                        <div className="flex-1 max-w-[200px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              group.progressPct > 80 ? 'bg-emerald-500' : 
                              group.progressPct > 40 ? 'bg-blue-500' : 'bg-amber-500'
                            }`} 
                            style={{ width: `${group.progressPct}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <span className="text-sm bg-blue-50 border border-blue-100 text-blue-600 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {group.activities.length} Upcoming Activities
                        </span>
                      </div>
                      <div className="text-slate-400 bg-white border border-slate-200 p-1.5 rounded-lg">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-white p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-[#0f172a]">
                          <thead className="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-100 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-5 py-3 font-semibold">Activity</th>
                              <th className="px-5 py-3 font-semibold">Start Date</th>
                              <th className="px-5 py-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {group.activities.map((act: any, actIdx: number) => {
                              return (
                                <tr key={actIdx} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-5 py-4">
                                    <div className="font-semibold text-slate-800">{act.activityName}</div>
                                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{act.stageName} • {act.type}</div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs">{new Date(act.startDate).toLocaleDateString()}</span>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        className="text-xs bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 font-semibold px-3 py-1.5 rounded transition-all"
                                        onClick={(e) => { e.stopPropagation(); openDelayedActivityDetails(act); }}
                                      >
                                        Update Date
                                      </button>
                                      <button 
                                        className="text-xs bg-white border border-slate-200 hover:border-slate-400 font-semibold px-3 py-1.5 rounded transition-all"
                                        onClick={(e) => { e.stopPropagation(); openDelayedActivityDetails(act); }}
                                      >
                                        Add Remark
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                        <button 
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
                          onClick={() => router.push(`/projects/${group.projectId}`)}
                        >
                          View Full Project Flow
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
      {/* Task Details Modal */}
      {isTaskDetailsOpen && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-white border border-slate-200 w-full max-w-2xl p-6 rounded-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                  <span className={`px-2.5 py-0.5 rounded-full uppercase border ${
                    selectedTask.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                    selectedTask.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    {selectedTask.priority} Priority
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full uppercase border ${
                    selectedTask.status === 'in_progress' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                    selectedTask.status === 'assigned' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    selectedTask.status === 'delayed' ? 'bg-red-50 text-red-700 border-red-200' :
                    selectedTask.status === 'hold' || selectedTask.status === 'rework_required' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                    'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    Status: {selectedTask.status === 'closed' ? 'Approved' : selectedTask.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 mt-3 flex items-center gap-2">
                  <span className="w-2 h-4 bg-blue-500 inline-block rounded-full" />
                  {selectedTask.title || selectedTask.activityName}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsTaskDetailsOpen(false);
                  setSelectedTask(null);
                }}
                className="text-slate-400 hover:text-slate-700 transition font-semibold text-xs bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Details Fields Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
              {selectedType === 'task' ? (
                <>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">ASSIGNED TO</span>
                    <span className="text-blue-600 font-bold block">{getUserName(selectedTask.assigned_to)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">ASSIGNED BY</span>
                    <span className="text-slate-800 font-bold block">
                      {getUserName(selectedTask.assigned_by)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">START DATE</span>
                    <span className="text-slate-800 font-bold block">{selectedTask.start_date ? selectedTask.start_date.split('T')[0] : '-'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">PROJECT</span>
                    <span className="text-blue-600 font-bold block">{selectedTask.projectName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">STAGE</span>
                    <span className="text-slate-800 font-bold block">{selectedTask.stageName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">TYPE</span>
                    <span className="text-slate-800 font-bold block">{selectedTask.type}</span>
                  </div>
                </>
              )}
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">TARGET DATE</label>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 block w-full p-2.5 transition-shadow"
                />
              </div>

              {((selectedType === 'task' && selectedTask.target_date ? selectedTask.target_date.split('T')[0] : '') !== editTargetDate) || ((selectedType === 'delayed' && selectedTask.targetDate ? selectedTask.targetDate.split('T')[0] : '') !== editTargetDate) ? (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[11px] text-red-600 font-bold uppercase tracking-wider">REASON FOR CHANGE <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Mandatory reason for changing date"
                    className="bg-red-50/50 border border-red-200 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-red-100 focus:border-red-500 block w-full p-2.5 transition-shadow"
                  />
                </div>
              ) : null}

              <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">REMARKS / COMMENTS</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 block w-full p-3 min-h-[100px] transition-shadow resize-y"
                  placeholder="Enter remarks or guidelines..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-slate-100 pt-5">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-2">
                <Folder className="w-3.5 h-3.5" />
                TASK DESCRIPTION
              </h4>
              <div className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                {selectedTask.description || 'No description provided.'}
              </div>
            </div>

            {/* Actions Section */}
            <div className="border-t border-slate-100 pt-5 flex justify-end">
              <button
                onClick={handleSaveTaskDetails}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2.5 px-6 rounded-lg tracking-wide shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
