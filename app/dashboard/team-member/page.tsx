'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Project, Task } from '@/types';
import { 
  Folder, ArrowRight, Loader2, Sparkles, 
  CheckCircle, AlertTriangle, FileText, Layers
} from 'lucide-react';

export default function TeamMemberDashboard() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const searchVal = searchParams.get('search') || '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [issuesCount, setIssuesCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<'running' | 'completed'>('running');

  const fetchTMDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch project members relations for current member
      const { data: pmData, error: pmErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('team_member_id', user.id);
      if (pmErr) throw pmErr;

      const projectIds = (pmData || []).map((pm: any) => pm.project_id);

      if (projectIds.length > 0) {
        // 2. Fetch Projects details sorted by project_code ascending
        const { data: projs, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('project_code', { ascending: true });
        if (projErr) throw projErr;
        setProjects(projs || []);

        // 3. Fetch Tasks assigned to this member under these projects
        const { data: tasksData, error: tasksErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', user.id);
        if (tasksErr) throw tasksErr;
        setTasks(tasksData || []);

        // Fetch stages for milestone progress
        const { data: stagesData, error: stagesError } = await supabase
          .from('project_stages')
          .select('project_id, status')
          .in('project_id', projectIds);
        if (stagesError) throw stagesError;
        setAllStages(stagesData || []);

        // 4. Fetch open issues counts
        const { data: issuesData, error: issueErr } = await supabase
          .from('issues')
          .select('project_id')
          .in('project_id', projectIds)
          .eq('status', 'open');
        if (issueErr) throw issueErr;

        const issMap: Record<string, number> = {};
        (issuesData || []).forEach((iss: any) => {
          issMap[iss.project_id] = (issMap[iss.project_id] || 0) + 1;
        });
        setIssuesCount(issMap);
      }
    } catch (err: any) {
      console.error('Error fetching TM dashboard data:', err);
      setError(err.message || 'Error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTMDashboardData();
  }, [user]);

  const getProjectProgress = (projId: string) => {
    const projTasks = tasks.filter(t => t.project_id === projId);
    const projStages = allStages.filter(s => s.project_id === projId);
    
    let totalMetrics = 0;
    let sumProgress = 0;
    
    if (projTasks.length > 0) {
      const closed = projTasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length;
      sumProgress += (closed / projTasks.length) * 100;
      totalMetrics++;
    }
    
    if (projStages.length > 0) {
      const completed = projStages.filter(s => s.status === 'completed').length;
      sumProgress += (completed / projStages.length) * 100;
      totalMetrics++;
    }
    
    if (totalMetrics === 0) return 0;
    return Math.round(sumProgress / totalMetrics);
  };

  if (loading) {
    return (
      <div className="flex py-24 justify-center items-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
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
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg font-mono z-10 relative">
            <strong>Database Sync Error:</strong> {error}
          </div>
        )}

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
                    {/* Top row project status tags */}
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[9px] font-extrabold tracking-wider text-[#06B6D4] uppercase bg-[#06B6D4]/5 border border-[#06B6D4]/20 px-2 py-0.5 rounded">
                        {proj.project_code}
                      </span>
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
                  </div>

                  {/* Progress bar module */}
                  <div className="w-full flex flex-col gap-1.5 my-1">
                    <div className="flex justify-between items-center text-[9px] text-[#64748B] font-extrabold uppercase tracking-wider">
                      <span>My Progress</span>
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
                    </div>

                    <Link
                      href={`/projects/${proj.id}`}
                      className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[#06B6D4]/30 text-[#06B6D4] bg-[#06B6D4]/5 hover:bg-[#06B6D4]/10 hover:border-[#06B6D4]/60 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] flex items-center gap-1 group transition-all duration-300"
                    >
                      Details
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </Link>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

