'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Project, User, Task } from '@/types';
import { 
  Folder, Users, AlertTriangle, CheckCircle, 
  ArrowRight, Loader2, Sparkles, Layers, Activity,
  Clock, Calendar, UserCheck
} from 'lucide-react';

export default function HodDashboard() {
  const { user } = useUser();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  
  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    projects: { total: 0, active: 0, completed: 0, delayed: 0 },
    resources: { total: 0, available: 0, assigned: 0, borrowed: 0 },
    performance: { completionPercent: 0, onTimePercent: 0, delayedActivities: 0, pendingChecksheets: 0 }
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersErr } = await supabase.from('users').select('*');
      if (usersErr) throw usersErr;
      const allSystemUsers = usersData || [];
      setUsers(allSystemUsers);

      // 2. Fetch Projects
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').order('project_code', { ascending: true });
      if (projErr) throw projErr;
      const allProjects = projData || [];
      setProjects(allProjects);

      // 3. Fetch Tasks
      const { data: taskData, error: taskErr } = await supabase.from('tasks').select('*');
      if (taskErr) throw taskErr;
      const allSystemTasks = taskData || [];
      setAllTasks(allSystemTasks);

      // Calculate Metrics
      
      // -- Project Metrics
      const totalProjects = allProjects.length;
      const activeProjects = allProjects.filter((p: Project) => p.status === 'active' || p.status === 'on_hold').length;
      const completedProjects = allProjects.filter((p: Project) => p.status === 'completed').length;
      
      // Delay heuristic for projects: if any task is delayed
      const today = new Date().toISOString().split('T')[0];
      const delayedTasks = allSystemTasks.filter((t: Task) => t.target_date && t.target_date < today && t.status !== 'closed' && t.status !== 'completed_by_member' && t.status !== 'approved_by_tl');
      const delayedProjectIds = new Set(delayedTasks.map((t: Task) => t.project_id));
      const delayedProjectsCount = delayedProjectIds.size;

      // -- Resource Metrics
      const totalEmployees = allSystemUsers.filter((u: User) => u.role !== 'admin' && u.role !== 'hod').length;
      // Heuristic for assigned: users who have at least one open task
      const openTasks = allSystemTasks.filter((t: Task) => t.status !== 'closed');
      const assignedUserIds = new Set(openTasks.map((t: Task) => t.assigned_to).filter(Boolean));
      const assignedResources = assignedUserIds.size;
      const availableResources = totalEmployees - assignedResources;
      const borrowedResources = 0; // Requires deeper logic if tracking cross-team borrowing

      // -- Performance Metrics
      const completedTasks = allSystemTasks.filter((t: Task) => t.status === 'closed' || t.status === 'approved_by_manager');
      const completionPercent = allSystemTasks.length > 0 ? Math.round((completedTasks.length / allSystemTasks.length) * 100) : 0;
      
      const onTimeTasks = completedTasks.filter((t: Task) => !t.target_date || (t.updated_at && t.updated_at <= t.target_date));
      const onTimePercent = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 100;
      
      const pendingChecksheets = allSystemTasks.filter((t: Task) => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress').length;

      setMetrics({
        projects: { total: totalProjects, active: activeProjects, completed: completedProjects, delayed: delayedProjectsCount },
        resources: { total: totalEmployees, available: availableResources, assigned: assignedResources, borrowed: borrowedResources },
        performance: { completionPercent, onTimePercent, delayedActivities: delayedTasks.length, pendingChecksheets }
      });

    } catch (err: any) {
      console.error("Error fetching HOD data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'hod') {
      fetchData();
    } else if (user && user.role !== 'admin') {
       // redirect if not hod/admin
       router.replace('/dashboard/home');
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#06B6D4] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animated-fade w-full max-w-[1400px] mx-auto pb-12">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-heading flex items-center gap-3">
            <Layers className="w-8 h-8 text-[#06B6D4]" />
            Department Overview
          </h1>
          <p className="text-sm text-gray-400 mt-2 font-medium">
            Global visibility across all managers, teams, and projects.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Project Summary */}
        <div className="bg-[#111827] border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Folder className="w-4 h-4" /> Project Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total</p>
              <p className="text-3xl font-black text-white font-mono">{metrics.projects.total}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Active</p>
              <p className="text-3xl font-black text-blue-400 font-mono">{metrics.projects.active}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Completed</p>
              <p className="text-3xl font-black text-emerald-400 font-mono">{metrics.projects.completed}</p>
            </div>
            <div>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Delayed</p>
              <p className="text-3xl font-black text-red-400 font-mono">{metrics.projects.delayed}</p>
            </div>
          </div>
        </div>

        {/* Resource Summary */}
        <div className="bg-[#111827] border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
          <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Resource Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Staff</p>
              <p className="text-3xl font-black text-white font-mono">{metrics.resources.total}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Available</p>
              <p className="text-3xl font-black text-emerald-400 font-mono">{metrics.resources.available}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Assigned</p>
              <p className="text-3xl font-black text-purple-400 font-mono">{metrics.resources.assigned}</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Borrowed</p>
              <p className="text-3xl font-black text-amber-400 font-mono">{metrics.resources.borrowed}</p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-[#111827] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Performance Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Completion</p>
              <p className="text-3xl font-black text-emerald-400 font-mono">{metrics.performance.completionPercent}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">On-Time</p>
              <p className="text-3xl font-black text-blue-400 font-mono">{metrics.performance.onTimePercent}%</p>
            </div>
            <div>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Delayed Acts.</p>
              <p className="text-3xl font-black text-red-400 font-mono">{metrics.performance.delayedActivities}</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pending Checks</p>
              <p className="text-3xl font-black text-amber-400 font-mono">{metrics.performance.pendingChecksheets}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold font-heading text-white mb-6 flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-500" />
          Global Project Directory
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project: Project) => {
            const projectTasks = allTasks.filter((t: Task) => t.project_id === project.id);
            const completed = projectTasks.filter((t: Task) => t.status === 'closed' || t.status === 'approved_by_manager').length;
            const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
            
            return (
              <Link href={`/projects/${project.id}`} key={project.id}>
                <div className="bg-[#111827] border border-white/5 rounded-2xl p-5 hover:border-blue-500/30 hover:bg-[#151f32] transition-all group cursor-pointer h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-bold text-white text-base truncate group-hover:text-blue-400 transition-colors">
                        {project.project_name}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-1">{project.project_code}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      project.status === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      project.status === 'on_hold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                      <span>Progress</span>
                      <span className="text-blue-400">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
