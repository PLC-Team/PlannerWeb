'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Loader2, ShieldAlert, CheckCircle, Database, RefreshCw } from 'lucide-react';

export default function DiagnosticsPage() {
  const { user, session, loading } = useUser();
  const [profileError, setProfileError] = useState<any>(null);
  const [pmData, setPmData] = useState<any>(null);
  const [pmError, setPmError] = useState<any>(null);
  const [projectsData, setProjectsData] = useState<any>(null);
  const [projectsError, setProjectsError] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    if (!session?.user) return;
    setIsRunning(true);
    setProfileError(null);
    setPmData(null);
    setPmError(null);
    setProjectsData(null);
    setProjectsError(null);

    try {
      console.log('Running client-side database diagnostics...');

      // 1. Check project_members query
      const { data: pm, error: pmErr } = await supabase
        .from('project_members')
        .select('*')
        .eq('team_member_id', session.user.id);
      
      if (pmErr) {
        setPmError(pmErr);
      } else {
        setPmData(pm);
        
        if (pm && pm.length > 0) {
          const projectIds = pm.map((r: any) => r.project_id);
          
          // 2. Check projects query
          const { data: projs, error: projErr } = await supabase
            .from('projects')
            .select('*')
            .in('id', projectIds);
          
          if (projErr) {
            setProjectsError(projErr);
          } else {
            setProjectsData(projs);
          }
        } else {
          // Try fetching all projects to see if they can read anything
          const { data: allProjs, error: allProjErr } = await supabase
            .from('projects')
            .select('id, project_name, project_code');
          
          if (allProjErr) {
            setProjectsError(allProjErr);
          } else {
            setProjectsData({ note: 'No member records found, but read all projects returned:', data: allProjs });
          }
        }
      }
    } catch (err: any) {
      setProfileError(err.message || err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      runDiagnostics();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-red-400 p-8 text-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p>This page contains sensitive system data and is restricted to Administrators.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-300 p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            Supabase RLS Diagnostics
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Debug row-level security policies and authentication states directly from the client.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Run Diagnostics
        </button>
      </div>

      {/* 1. Session State */}
      <div className="glass p-5 rounded-xl border border-white/5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-white font-heading">1. Auth Session & Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-white/2 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase">SUPABASE AUTH USER</span>
            {session?.user ? (
              <>
                <div><span className="text-gray-400">UID:</span> <code className="text-white bg-indigo-50 px-1 py-0.5 rounded border border-white/5/50">{session.user.id}</code></div>
                <div><span className="text-gray-400">Email:</span> <strong className="text-white">{session.user.email}</strong></div>
              </>
            ) : (
              <span className="text-red-400">No active session found. Please log in first.</span>
            )}
          </div>

          <div className="bg-white/2 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 font-bold uppercase">PUBLIC PROFILE (PUBLIC.USERS)</span>
            {user ? (
              <>
                <div><span className="text-gray-400">Name:</span> <strong className="text-white">{user.name}</strong></div>
                <div><span className="text-gray-400">Role:</span> <code className="text-blue-500">{user.role}</code></div>
                <div><span className="text-gray-400">Designation:</span> <span className="text-white">{user.designation || 'None'}</span></div>
              </>
            ) : (
              <span className="text-amber-500">Profile record is null or missing in public.users.</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. project_members query result */}
      <div className="glass p-5 rounded-xl border border-white/5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-white font-heading">2. Project Members Table Query</h3>
        {pmError ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Query Failed:</strong> {pmError.message || JSON.stringify(pmError)}
            </div>
          </div>
        ) : pmData ? (
          <div className="text-xs">
            <p className="text-emerald-400 flex items-center gap-1 font-semibold mb-2">
              <CheckCircle className="w-4 h-4" />
              Fetched {pmData.length} mapping records.
            </p>
            <pre className="bg-black/40 p-3 rounded border border-white/5 overflow-x-auto text-[10px] text-white font-mono">
              {JSON.stringify(pmData, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Waiting for query to run...</p>
        )}
      </div>

      {/* 3. projects query result */}
      <div className="glass p-5 rounded-xl border border-white/5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-white font-heading">3. Projects Table Query</h3>
        {projectsError ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Query Failed (RLS Policy block?):</strong> {projectsError.message || JSON.stringify(projectsError)}
            </div>
          </div>
        ) : projectsData ? (
          <div className="text-xs">
            <p className="text-emerald-400 flex items-center gap-1 font-semibold mb-2">
              <CheckCircle className="w-4 h-4" />
              Query returned successfully.
            </p>
            <pre className="bg-black/40 p-3 rounded border border-white/5 overflow-x-auto text-[10px] text-white font-mono">
              {JSON.stringify(projectsData, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Waiting for query to run...</p>
        )}
      </div>
      
      {profileError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
          <strong>Unexpected Error:</strong> {profileError}
        </div>
      )}
    </div>
  );
}
