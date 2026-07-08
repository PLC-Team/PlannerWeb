'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Project, User, Task } from '@/types';
import { 
  Folder, Plus, Users, AlertTriangle, CheckCircle, 
  ArrowRight, Loader2, Sparkles, Trash2, Layers, Calendar, Edit2, Eraser
} from 'lucide-react';

import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  LineChart, Line 
} from 'recharts';

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ManagerDashboard() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const searchVal = searchParams.get('search') || '';
  
  // Lists
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [issuesCount, setIssuesCount] = useState<Record<string, number>>({});
  const [approvalsCount, setApprovalsCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<'running' | 'completed'>('running');

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Form states - Project
  const [newProjectForm, setNewProjectForm] = useState({
    project_code: '',
    project_name: '',
    customer_name: '',
    description: '',
    assigned_team_leader_id: '',
  });
  const [projectError, setProjectError] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);

  // Edit Project state
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectForm, setEditProjectForm] = useState({
    project_code: '',
    project_name: '',
    customer_name: '',
    description: '',
  });
  const [editProjectError, setEditProjectError] = useState('');
  const [editProjectLoading, setEditProjectLoading] = useState(false);
  const [navigatingToProject, setNavigatingToProject] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setNavigatingToProject(null);
  }, [pathname]);

  const handleProjectNavigation = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setNavigatingToProject(id);
    // Force a paint before initiating Next.js heavy chunk download
    setTimeout(() => {
      router.push(`/projects/${id}`);
    }, 50);
  };

  // Form states - Task
  const [newTaskForm, setNewTaskForm] = useState({
    project_id: '',
    title: '',
    description: '',
    assigned_to: '', // TL dropdown
    priority: 'medium' as any,
    start_date: '',
    target_date: '',
    remarks: '',
  });
  const [taskError, setTaskError] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);

  // Fetch team leaders
  const fetchTeamLeaders = async () => {
    const { data: tlsData, error: tlError } = await supabase
      .from('users')
      .select('id, name, email, role, designation')
      .eq('role', 'team_leader');

    if (!tlError && tlsData && tlsData.length > 0) {
      setTeamLeaders(tlsData);
      return;
    }

    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id, name, email, role, designation');

    if (!allError && allUsers) {
      const tls = allUsers.filter((u: { role: string }) => u.role === 'team_leader');
      if (tls.length > 0) {
        setTeamLeaders(tls);
        return;
      }
    }

    if (user) {
      const { data: hierarchyData, error: hError } = await supabase
        .from('hierarchy')
        .select('team_leader_id')
        .eq('manager_id', user.id);

      if (!hError && hierarchyData && hierarchyData.length > 0) {
        const tlIds = Array.from(new Set(
          hierarchyData.map((h: { team_leader_id: string }) => h.team_leader_id).filter(Boolean)
        )) as string[];
        if (tlIds.length > 0) {
          const { data: tlUsers } = await supabase
            .from('users')
            .select('id, name, email, role, designation')
            .in('id', tlIds);
          setTeamLeaders(tlUsers || []);
          return;
        }
      }
    }
    setTeamLeaders([]);
  };

  const fetchDashboardData = async () => {
    if (!user) return null;
    
    const { data: projectsData, error: projError } = await supabase
      .from('projects')
      .select('*')
      .order('project_code', { ascending: true });

    if (projError) throw projError;

    const projs = projectsData || [];
    let tasksData: any[] = [];
    let stagesData: any[] = [];
    const issMap: Record<string, number> = {};
    const appMap: Record<string, number> = {};

    if (projs.length > 0) {
      const projectIds = projs.map((p: any) => p.id);

      // Fetch tasks (Optimized payload: only what we need for counts)
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('id, project_id, status')
        .in('project_id', projectIds);
      if (taskError) throw taskError;
      tasksData = tasks || [];

      // Fetch stages
      const { data: stages, error: stagesError } = await supabase
        .from('project_stages')
        .select('project_id, stage_name, status')
        .in('project_id', projectIds);
      if (stagesError) throw stagesError;
      stagesData = stages || [];

      // Fetch open issues counts
      const { data: issuesData, error: issueError } = await supabase
        .from('issues')
        .select('project_id, status')
        .in('project_id', projectIds)
        .eq('status', 'open');
      if (issueError) throw issueError;

      (issuesData || []).forEach((iss: any) => {
        issMap[iss.project_id] = (issMap[iss.project_id] || 0) + 1;
      });

      // Fetch pending approvals
      const { data: approvalsData, error: appError } = await supabase
        .from('tasks')
        .select('project_id')
        .in('project_id', projectIds)
        .eq('status', 'approved_by_tl');
      if (appError) throw appError;

      (approvalsData || []).forEach((t: any) => {
        appMap[t.project_id] = (appMap[t.project_id] || 0) + 1;
      });
    }
    
    return { projs, tasksData, stagesData, issMap, appMap };
  };

  const { data: dashData, mutate: reloadDash, error: dashError } = useSWR(user ? `manager-dash-${user.id}` : null, fetchDashboardData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000
  });

  useEffect(() => {
    if (dashData) {
      setProjects(dashData.projs);
      setAllTasks(dashData.tasksData);
      setAllStages(dashData.stagesData);
      setIssuesCount(dashData.issMap);
      setApprovalsCount(dashData.appMap);
      setLoading(false);
    } else if (dashError) {
      console.error('Error loading manager dashboard:', dashError);
      setLoading(false);
    }
  }, [dashData, dashError]);

  useEffect(() => {
    if (user) {
      fetchTeamLeaders();
    }
  }, [user?.id]);

  useEffect(() => {
    if (isProjectModalOpen || isTaskModalOpen) {
      fetchTeamLeaders();
    }
  }, [isProjectModalOpen, isTaskModalOpen]);

  // Handle New Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectError('');
    setProjectLoading(true);

    const { project_code, project_name, customer_name, description, assigned_team_leader_id } = newProjectForm;

    if (!project_code || !project_name || !customer_name || !assigned_team_leader_id) {
      setProjectError('Please fill in project code, name, customer, and assign a Team Leader.');
      setProjectLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          project_code,
          project_name,
          customer_name,
          description,
          assigned_team_leader_id,
          created_by: user?.id,
          status: 'active'
        });

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'Project Registered',
        details: { project_code, project_name, customer_name }
      });

      setIsProjectModalOpen(false);
      setNewProjectForm({ project_code: '', project_name: '', customer_name: '', description: '', assigned_team_leader_id: '' });
      reloadDash();
    } catch (err: any) {
      setProjectError(err.message || 'Error creating project.');
    } finally {
      setProjectLoading(false);
    }
  };

  // Handle Update Project
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProjectError('');
    setEditProjectLoading(true);

    if (!editingProject) return;

    const { project_code, project_name, customer_name, description } = editProjectForm;

    if (!project_code || !project_name || !customer_name) {
      setEditProjectError('Please fill in project code, name, and customer.');
      setEditProjectLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          project_code,
          project_name,
          customer_name,
          description,
        })
        .eq('id', editingProject.id);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'Project Updated',
        details: { project_id: editingProject.id, new_code: project_code, new_name: project_name }
      });

      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      reloadDash();
    } catch (err: any) {
      setEditProjectError(err.message || 'Error updating project.');
    } finally {
      setEditProjectLoading(false);
    }
  };

  // Handle New Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    setTaskLoading(true);

    const { project_id, title, description, assigned_to, priority, start_date, target_date, remarks } = newTaskForm;

    if (!project_id || !title || !assigned_to || !priority || !start_date || !target_date) {
      setTaskError('Please fill in project, title, assigned to (TL), priority, start date, and target date.');
      setTaskLoading(false);
      return;
    }

    const selectedProj = projects.find(p => p.id === project_id);

    try {
      const { data: taskData, error } = await supabase
        .from('tasks')
        .insert({
          project_id,
          project_code: selectedProj?.project_code || '',
          project_name: selectedProj?.project_name || '',
          title,
          description,
          assigned_by: user?.id,
          assigned_to,
          assigned_by_role: 'manager',
          priority,
          start_date,
          target_date,
          remarks,
          status: 'assigned',
          progress_percent: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: assigned_to,
        title: 'New Manager-Assigned Task',
        message: `Manager assigned task "${title}" under project ${selectedProj?.project_name || ''}.`,
        related_task_id: taskData.id,
        related_project_id: project_id,
      });

      await supabase.from('activity_logs').insert({
        project_id,
        task_id: taskData.id,
        user_id: user?.id,
        action: 'Task Created',
        details: { title, priority, target_date }
      });

      setIsTaskModalOpen(false);
      setNewTaskForm({ project_id: '', title: '', description: '', assigned_to: '', priority: 'medium', start_date: '', target_date: '', remarks: '' });
      reloadDash();
    } catch (err: any) {
      setTaskError(err.message || 'Error creating task.');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to permanently delete the project "${projectName}"? This will delete all tasks, project members, achievements, and issues associated with it.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'Project Deleted',
        details: { name: projectName }
      });

      reloadDash();
    } catch (err: any) {
      alert(err.message || 'Error deleting project.');
    }
  };

  const handleClearProjectData = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to clear all data for project "${projectName}"? This will delete all check sheets, tasks, achievements, and issues, but keep the project shell and assigned team.`)) {
      return;
    }

    try {
      // Clear all project data from related tables, but keep the initial project stages shell
      await supabase.from('project_stages').update({ status: 'pending', remarks: null }).eq('project_id', projectId);
      await supabase.from('tasks').delete().eq('project_id', projectId);
      await supabase.from('issues').delete().eq('project_id', projectId);
      await supabase.from('achievements').delete().eq('project_id', projectId);
      await supabase.from('dynamic_check_sheets').delete().eq('project_id', projectId);
      
      // Clear all associated activity logs for the project
      await supabase.from('activity_logs').delete().eq('project_id', projectId);
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'Project Data Cleared',
        details: { name: projectName }
      });

      reloadDash();
      alert(`All data for "${projectName}" has been successfully cleared.`);
    } catch (err: any) {
      alert(err.message || 'Error clearing project data.');
    }
  };

  const getProjectProgress = (projId: string) => {
    const projTasks = allTasks.filter(t => t.project_id === projId);
    const projStages = allStages.filter(s => s.project_id === projId);
    
    let totalMetrics = 0;
    let sumProgress = 0;
    
    if (projTasks.length > 0) {
      const closed = projTasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length;
      sumProgress += (closed / projTasks.length) * 100;
      totalMetrics++;
    }
    
    if (projStages.length > 0) {
      const validStages = projStages.filter(s => s.stage_name !== 'Project Kickoff Meeting');
      if (validStages.length > 0) {
        const completed = validStages.filter(s => s.status === 'completed').length;
        sumProgress += (completed / validStages.length) * 100;
        totalMetrics++;
      }
    }
    
    if (totalMetrics === 0) return 0;
    return Math.round(sumProgress / totalMetrics);
  };

  const getTLName = (tlId: string | null) => {
    if (!tlId) return 'Not Assigned';
    return teamLeaders.find(t => t.id === tlId)?.name || 'Unknown Team Leader';
  };

  if (loading) {
    return (
      <div className="flex py-24 justify-center items-center">
        <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
        {/* --- FULL SCREEN NAVIGATION LOADER --- */}
        {navigatingToProject && (
          <div className="fixed inset-0 bg-[#090f1d]/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-fadeIn">
            <div className="relative">
              <div className="absolute inset-0 bg-[#06B6D4] blur-[30px] opacity-20 rounded-full animate-pulse"></div>
              <Loader2 className="w-16 h-16 text-[#06B6D4] animate-spin relative z-10" />
            </div>
            <p className="text-[#06B6D4] mt-6 font-mono text-sm tracking-[0.3em] uppercase animate-pulse">
              Establishing Secure Link...
            </p>
            <p className="text-slate-500 mt-2 font-mono text-[10px] tracking-widest uppercase">
              Decrypting Workspace Data
            </p>
          </div>
        )}
      </div>
    );
  }

  const filteredProjects = projects.filter(p => 
    p.project_name.toLowerCase().includes(searchVal.toLowerCase()) ||
    p.project_code.toLowerCase().includes(searchVal.toLowerCase())
  );

  const runningProjects = filteredProjects.filter(p => p.status !== 'completed');
  const completedProjects = filteredProjects.filter(p => p.status === 'completed');
  const visibleProjects = projectFilter === 'running' ? runningProjects : completedProjects;

  const runningCount = projects.filter(p => p.status !== 'completed').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  return (
    <>
      <div className="flex flex-col gap-6 animated-fade relative">
        
        {/* Soft background glow */}
        <div className="absolute top-[-100px] right-[-100px] w-[350px] h-[350px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none z-0" />

        {/* Intro Header Section */}
        <div className="flex justify-between items-start border-b border-white/5 pb-5 z-10 relative">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] font-heading">
              Projects Overview
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/daily-report"
              className="btn-secondary font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 bg-[#0f172a] border border-white/10 hover:bg-white/10 text-white transition"
            >
              <Calendar className="w-4 h-4 text-blue-400" /> View Work Reports
            </Link>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="btn-primary font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Register Project
            </button>
          </div>
        </div>

        {/* KPI Summary section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 z-10 relative">
          {/* Card 1: Total */}
          <div className="backdrop-blur-md bg-[#111827]/60 border border-white/5 rounded-2xl p-5 hover:border-blue-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg shadow-blue-950/20">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#3B82F6] opacity-35 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider block">Total Projects</span>
                <span className="text-2xl font-black text-[#F8FAFC] font-heading mt-1.5 block">{projects.length}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Folder className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#06B6D4]" /> System Active</span>
              <svg className="w-14 h-5 text-blue-500 overflow-visible" viewBox="0 0 50 20">
                <path d="M0,15 Q10,5 20,12 T40,4 T50,8" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 2: Active */}
          <div className="backdrop-blur-md bg-[#111827]/60 border border-white/5 rounded-2xl p-5 hover:border-cyan-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg shadow-blue-950/20">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#06B6D4] opacity-35 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider block">Active Projects</span>
                <span className="text-2xl font-black text-[#F8FAFC] font-heading mt-1.5 block">{runningCount}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" /> In Production</span>
              <svg className="w-14 h-5 text-cyan-500 overflow-visible" viewBox="0 0 50 20">
                <path d="M0,10 Q10,18 20,8 T40,16 T50,4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 3: Completed */}
          <div className="backdrop-blur-md bg-[#111827]/60 border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg shadow-blue-950/20">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#10B981] opacity-35 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider block">Completed Projects</span>
                <span className="text-2xl font-black text-[#F8FAFC] font-heading mt-1.5 block">{completedCount}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1">100% Finalized</span>
              <svg className="w-14 h-5 text-emerald-500 overflow-visible" viewBox="0 0 50 20">
                <path d="M0,18 Q15,10 30,15 T50,2" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Projects Filter Tabs */}
        <div className="flex items-center gap-4 border-b border-white/5 pb-2 z-10 relative">
          <button
            onClick={() => setProjectFilter('running')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition ${
              projectFilter === 'running'
                ? 'border-[#06B6D4] text-[#06B6D4] font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#CBD5E1]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Active Projects ({runningCount})
          </button>
          <button
            onClick={() => setProjectFilter('completed')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition ${
              projectFilter === 'completed'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#CBD5E1]'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Completed Projects ({completedCount})
          </button>
        </div>

        {/* Visible projects rendering */}
        {visibleProjects.length === 0 ? (
          <div className="backdrop-blur-md bg-[#111827]/40 border border-white/5 p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-4 z-10 relative">
            <Folder className="w-12 h-12 text-[#64748B]" />
            <div>
              <h3 className="text-[#F8FAFC] font-semibold">
                {projectFilter === 'running' ? 'No active projects' : 'No completed projects'}
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                {searchVal ? 'No projects match your search query.' : 'No projects found in this tab.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 z-10 relative">
            {visibleProjects.map((proj) => {
              const openIssues = issuesCount[proj.id] || 0;
              const pendingApprovals = approvalsCount[proj.id] || 0;
              const progress = getProjectProgress(proj.id);
              const isCompleted = proj.status === 'completed';
              const isCritical = openIssues > 0;
              
              let statusBorderClass = 'border-l-4 border-l-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]';
              if (isCompleted) {
                statusBorderClass = 'border-l-4 border-l-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]';
              } else if (isCritical) {
                statusBorderClass = 'border-l-4 border-l-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]';
              }

              return (
                <div 
                  key={proj.id}
                  className={`relative backdrop-blur-md bg-[rgba(17,24,39,0.75)] border border-[rgba(255,255,255,0.08)] p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:bg-[#111827]/90 group ${statusBorderClass}`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-extrabold tracking-wider text-[#06B6D4] uppercase bg-[#06B6D4]/5 border border-[#06B6D4]/20 px-2 py-0.5 rounded">
                          {proj.project_code}
                        </span>
                      </div>
                      <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : isCritical
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {proj.status}
                      </span>
                    </div>

                    {/* Title & Customer */}
                    <h3 className="font-bold text-xs text-[#F8FAFC] truncate font-heading leading-snug mt-2.5 group-hover:text-[#06B6D4] transition-colors duration-200" title={proj.project_name}>
                      {proj.project_name}
                    </h3>
                    <span className="text-[10px] text-[#64748B] mt-1 block">
                      Client: <strong className="text-[#CBD5E1] font-semibold">{proj.customer_name}</strong>
                    </span>
                    
                    {/* Assigned Team Leader info */}
                    <div className="flex items-center gap-2 mt-3.5 text-xs">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 text-[#CBD5E1] font-extrabold flex items-center justify-center text-[9px] uppercase border border-white/5">
                        {getInitials(getTLName(proj.assigned_team_leader_id))}
                      </div>
                      <span className="text-[#64748B] truncate text-[10px]">
                        TL: <strong className="text-[#F8FAFC] font-medium">{getTLName(proj.assigned_team_leader_id)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Progress bar module */}
                  <div className="w-full flex flex-col gap-1.5 my-1">
                    <div className="flex justify-between items-center text-[9px] text-[#64748B] font-extrabold uppercase tracking-wider">
                      <span>Progress</span>
                      <span className="text-[#F8FAFC] font-mono">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full bg-gradient-to-r ${isCompleted ? 'from-emerald-500 to-teal-400' : 'from-[#3B82F6] to-[#06B6D4]'} rounded-full transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Counters footer & Action buttons */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3.5 mt-1">
                    <div className="flex gap-2.5">
                      {/* Open Issues Count */}
                      <div className="flex items-center gap-1" title="Open Issues">
                        <AlertTriangle className={`w-3.5 h-3.5 ${openIssues > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
                        <span className={`text-[10px] font-bold ${openIssues > 0 ? 'text-red-400' : 'text-[#64748B]'}`}>
                          {openIssues}
                        </span>
                      </div>
                      {/* Pending Approvals Count */}
                      <div className="flex items-center gap-1.5" title="Pending Approvals">
                        <CheckCircle className={`w-3.5 h-3.5 ${pendingApprovals > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                        <span className={`text-[10px] font-bold ${pendingApprovals > 0 ? 'text-amber-400' : 'text-[#64748B]'}`}>
                          {pendingApprovals}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingProject(proj);
                          setEditProjectForm({
                            project_code: proj.project_code,
                            project_name: proj.project_name,
                            customer_name: proj.customer_name || '',
                            description: proj.description || '',
                          });
                          setIsEditProjectModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Edit Project"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleClearProjectData(proj.id, proj.project_name)}
                        className="p-1 rounded text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        title="Clear Project Data"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id, proj.project_name)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleProjectNavigation(e, proj.id)}
                        className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[#06B6D4]/30 text-[#06B6D4] bg-[#06B6D4]/5 hover:bg-[#06B6D4]/10 hover:border-[#06B6D4]/60 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] flex items-center gap-1 group transition-all duration-300"
                      >
                        {navigatingToProject === proj.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            Details
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- NEW PROJECT MODAL --- */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass w-full max-w-md p-6 rounded-2xl border border-blue-500/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto bg-[#090f1d]/95 scada-card-glow">
            <h3 className="font-bold text-base text-[#F8FAFC] font-heading uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#06B6D4] inline-block rounded-full" />
              Register New Project
            </h3>
            
            {projectError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg font-mono">
                ERR: {projectError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="flex flex-col gap-3.5 text-xs">
              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT CODE</label>
                <input
                  type="text"
                  placeholder="e.g. PRJ-DELTA"
                  value={newProjectForm.project_code}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, project_code: e.target.value.toUpperCase() })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Serverless Database Sync"
                  value={newProjectForm.project_name}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, project_name: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">CUSTOMER NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Omega Industries"
                  value={newProjectForm.customer_name}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, customer_name: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT DESCRIPTION</label>
                <textarea
                  placeholder="Project specifications and requirements..."
                  value={newProjectForm.description}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                  rows={3}
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">ASSIGN TEAM LEADER</label>
                {teamLeaders.length === 0 ? (
                  <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>No team leaders found. Ensure team leaders are added by Admin and assigned under your hierarchy.</span>
                  </div>
                ) : (
                  <select
                    value={newProjectForm.assigned_team_leader_id}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, assigned_team_leader_id: e.target.value })}
                    required
                    className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                  >
                    <option value="">Select Team Leader ({teamLeaders.length} available)</option>
                    {teamLeaders.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-3.5 mt-2">
                <button
                  type="submit"
                  disabled={projectLoading}
                  className="btn-primary flex-1 font-semibold py-3 rounded-xl uppercase tracking-wider text-xs"
                >
                  {projectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="btn-secondary flex-1 py-3 rounded-xl text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT PROJECT MODAL --- */}
      {isEditProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass w-full max-w-md p-6 rounded-2xl border border-blue-500/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto bg-[#090f1d]/95 scada-card-glow">
            <h3 className="font-bold text-base text-[#F8FAFC] font-heading uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#06B6D4] inline-block rounded-full" />
              Edit Project
            </h3>
            
            {editProjectError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg font-mono">
                ERR: {editProjectError}
              </div>
            )}

            <form onSubmit={handleUpdateProject} className="flex flex-col gap-3.5 text-xs">
              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT CODE</label>
                <input
                  type="text"
                  placeholder="e.g. PRJ-DELTA"
                  value={editProjectForm.project_code}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, project_code: e.target.value.toUpperCase() })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Serverless Database Sync"
                  value={editProjectForm.project_name}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, project_name: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">CUSTOMER NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Omega Industries"
                  value={editProjectForm.customer_name}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, customer_name: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PROJECT DESCRIPTION</label>
                <textarea
                  placeholder="Project specifications and requirements..."
                  value={editProjectForm.description}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, description: e.target.value })}
                  rows={3}
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="flex gap-3.5 mt-2">
                <button
                  type="submit"
                  disabled={editProjectLoading}
                  className="btn-primary flex-1 font-semibold py-3 rounded-xl uppercase tracking-wider text-xs"
                >
                  {editProjectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditProjectModalOpen(false)}
                  className="btn-secondary flex-1 py-3 rounded-xl text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NEW TASK MODAL --- */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass w-full max-w-md p-6 rounded-2xl border border-blue-500/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto bg-[#090f1d]/95 scada-card-glow">
            <h3 className="font-bold text-base text-[#F8FAFC] font-heading uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#06B6D4] inline-block rounded-full" />
              Create Manager-Assigned Task
            </h3>
            
            {taskError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg font-mono">
                ERR: {taskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="flex flex-col gap-3.5 text-xs">
              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">SELECT PROJECT</label>
                <select
                  value={newTaskForm.project_id}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, project_id: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                >
                  <option value="">Select Target Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">TASK TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Design API Routes"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">DESCRIPTION</label>
                <textarea
                  placeholder="Task details and deliverables..."
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  rows={3}
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">ASSIGN TO TEAM LEADER</label>
                {teamLeaders.length === 0 ? (
                  <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>No team leaders found. Please check hierarchy setup in Admin panel.</span>
                  </div>
                ) : (
                  <select
                    value={newTaskForm.assigned_to}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, assigned_to: e.target.value })}
                    required
                    className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                  >
                    <option value="">Select Team Leader ({teamLeaders.length} available)</option>
                    {teamLeaders.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">PRIORITY</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, priority: e.target.value as any })}
                    required
                    className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">START DATE</label>
                  <input
                    type="date"
                    value={newTaskForm.start_date}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, start_date: e.target.value })}
                    required
                    className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">TARGET DATE</label>
                <input
                  type="date"
                  value={newTaskForm.target_date}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, target_date: e.target.value })}
                  required
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] focus:border-[#06B6D4] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="form-group">
                <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5">REMARKS</label>
                <input
                  type="text"
                  placeholder="Any guidelines..."
                  value={newTaskForm.remarks}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, remarks: e.target.value })}
                  className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition"
                />
              </div>

              <div className="flex gap-3.5 mt-2">
                <button
                  type="submit"
                  disabled={taskLoading}
                  className="btn-primary flex-1 font-semibold py-3 rounded-xl uppercase tracking-wider text-xs"
                >
                  {taskLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Task'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="btn-secondary flex-1 py-3 rounded-xl text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FULL SCREEN NAVIGATION LOADER --- */}
      {navigatingToProject && (
        <div className="fixed inset-0 bg-[#090f1d]/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-fadeIn">
          <div className="relative">
            <div className="absolute inset-0 bg-[#06B6D4] blur-[30px] opacity-20 rounded-full animate-pulse"></div>
            <Loader2 className="w-16 h-16 text-[#06B6D4] animate-spin relative z-10" />
          </div>
          <p className="text-[#06B6D4] mt-6 font-mono text-sm tracking-[0.3em] uppercase animate-pulse">
            Establishing Secure Link...
          </p>
          <p className="text-slate-500 mt-2 font-mono text-[10px] tracking-widest uppercase">
            Decrypting Workspace Data
          </p>
        </div>
      )}
    </>
  );
}
