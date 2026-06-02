'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { User, Hierarchy } from '@/types';
import { GitMerge, Loader2, ChevronDown, ChevronRight, User as UserIcon, Users, Crown } from 'lucide-react';

export default function ReportingHierarchyPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<Hierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTLs, setExpandedTLs] = useState<Record<string, boolean>>({});

  // Fetch Data Functions
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });
      if (usersError) throw usersError;

      // 2. Fetch Hierarchy Mappings
      const { data: hierarchyData, error: hierarchyError } = await supabase
        .from('hierarchy')
        .select('*');
      if (hierarchyError) throw hierarchyError;

      setUsers(usersData || []);
      setHierarchy(hierarchyData || []);
    } catch (err) {
      console.error('Error fetching hierarchy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const toggleTL = (tlId: string) => {
    setExpandedTLs(prev => ({
      ...prev,
      [tlId]: prev[tlId] === false ? true : false
    }));
  };

  // Helper to compile hierarchical tree
  const getHierarchyTree = () => {
    const managers = users.filter(u => u.role === 'manager');
    const tls = users.filter(u => u.role === 'team_leader');
    const tms = users.filter(u => u.role === 'team_member');

    return managers.map(mgr => {
      const managerLinks = hierarchy.filter(h => h.manager_id === mgr.id);
      const uniqueTLIds = Array.from(new Set(managerLinks.map(l => l.team_leader_id)));
      
      const tlNodes = uniqueTLIds.map(tlId => {
        const tlUser = tls.find(u => u.id === tlId);
        const tmLinks = managerLinks.filter(l => l.team_leader_id === tlId && l.team_member_id);
        const tmUsers = tmLinks
          .map(l => tms.find(u => u.id === l.team_member_id))
          .filter((u): u is User => !!u);
        
        return {
          id: tlId,
          name: tlUser?.name || 'Unknown Team Leader',
          members: tmUsers.map(tm => ({
            id: tm.id,
            name: tm.name
          }))
        };
      });

      return {
        id: mgr.id,
        name: mgr.name,
        teamLeaders: tlNodes
      };
    });
  };

  return (
    <div className="flex flex-col gap-6 animated-fade bg-[#dbeafe] p-8 rounded-3xl min-h-screen text-[#0f172a]">
      {/* Intro header */}
      <div className="flex justify-between items-center border-b border-[#93c5fd]/50 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0f172a] font-heading">
            Organizational Reporting Structure
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            View the company reporting lines, managers, team leaders, and members.
          </p>
        </div>
      </div>

      {/* Main tree flow container */}
      <div className="bg-[#eff6ff] border-2 border-[#93c5fd] p-6 rounded-2xl flex flex-col gap-4 w-full shadow-lg">
        <h2 className="text-lg font-bold font-heading text-[#0f172a] flex items-center gap-2 border-b border-[#93c5fd]/50 pb-4 mb-2">
          <GitMerge className="w-5 h-5 text-[#2563eb]" />
          Reporting Hierarchy Flow Chart
        </h2>

        {loading ? (
          <div className="flex py-12 justify-center">
            <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-h-[700px] overflow-y-auto scroll-container p-2">
            {getHierarchyTree().map(mgr => (
              <div key={mgr.id} className="bg-[#ffffff] border-2 border-[#93c5fd] w-full flex flex-col gap-4 p-6 rounded-2xl relative shadow-md overflow-x-auto scroll-container">
                
                {/* Header for this manager block */}
                <div className="flex items-center justify-between border-b border-[#93c5fd]/30 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
                    <span className="text-[10px] font-bold text-[#4b5563] uppercase tracking-wider">
                      Reporting Structure under {mgr.name}
                    </span>
                  </div>
                </div>

                {/* Vertical Tree Flow Diagram */}
                <div className="flex flex-col gap-6 py-4 pl-4 relative">
                  
                  {/* Level 1: Manager Node */}
                  <div className="relative flex items-center z-10">
                    <div className="flex items-center gap-3 bg-[#ffffff] border-2 border-[#93c5fd] px-4 py-2.5 rounded-2xl shadow-lg hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(37,99,235,0.15)] transition-all duration-300 min-w-[200px] max-w-[280px]">
                      <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-md">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-[#0f172a] leading-tight">{mgr.name}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Level 2: Team Leaders Column */}
                  {mgr.teamLeaders.length > 0 ? (
                    <div className="flex flex-col gap-6 pl-10 relative">
                      
                      {/* Vertical line from Manager to TLs */}
                      <div className="absolute left-4 top-0 bottom-[30px] w-[3px] bg-gradient-to-b from-[#2563eb] to-[#7c3aed]" />

                      {mgr.teamLeaders.map((tl) => {
                        const isExpanded = expandedTLs[tl.id] !== false;
                        return (
                          <div key={tl.id} className="relative flex flex-col gap-4">

                            {/* TL Node */}
                            <div className="relative flex items-center z-10">
                              {/* Horizontal connector line from the main vertical line to this TL card */}
                              <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-[3px] bg-[#6366f1]" />

                              <div className="flex items-center justify-between bg-[#ffffff] border-2 border-[#93c5fd] px-4 py-2.5 rounded-2xl shadow-lg hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition-all duration-300 min-w-[220px] max-w-[320px]">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#7c3aed] text-white flex items-center justify-center shadow-md">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-xs text-[#0f172a] leading-tight">{tl.name}</h5>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => toggleTL(tl.id)} 
                                  className="p-1 rounded-lg hover:bg-purple-100 text-[#7c3aed] transition-colors ml-4"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Level 3: Team Members List under this TL */}
                            {isExpanded && tl.members.length > 0 ? (
                              <div className="flex flex-col gap-3 pl-12 relative animate-fadeIn transition-all duration-300">
                                
                                {/* Vertical line from TL to TMs */}
                                <div className="absolute left-6 top-0 bottom-[18px] w-[3px] bg-gradient-to-b from-[#7c3aed] to-[#10b981]" />

                                {tl.members.map((tm) => {
                                  return (
                                    <div key={tm.id} className="relative flex items-center z-10 py-0.5">
                                      
                                      {/* Horizontal connector line from TL's vertical line to this TM card */}
                                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-[3px] bg-[#6366f1]" />

                                      {/* TM Tag Card */}
                                      <div className="flex items-center justify-between bg-[#f0f9ff] border-2 border-[#93c5fd] px-3.5 py-2 rounded-2xl shadow-md hover:scale-[1.02] hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-300 min-w-[190px] max-w-[280px]">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-md">
                                            <UserIcon className="w-3.5 h-3.5" />
                                          </div>
                                          <div>
                                            <h6 className="font-semibold text-xs text-[#0f172a] leading-none">{tm.name}</h6>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  );
                                })}
                              </div>
                            ) : isExpanded ? (
                              <div className="relative pl-12 flex items-center h-6">
                                {/* Dashed connector to empty state */}
                                <div className="absolute left-6 top-1/2 w-6 h-[3px] border-t border-dashed border-[#6366f1] -translate-y-1/2 z-0" />
                                <span className="text-[9px] text-[#64748B] italic pl-1">No members mapped</span>
                              </div>
                            ) : null}

                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="relative pl-10 flex items-center h-8">
                      {/* Dashed connector to empty state */}
                      <div className="absolute left-4 top-1/2 w-6 h-[3px] border-t border-dashed border-[#6366f1] -translate-y-1/2 z-0" />
                      <span className="text-[10px] text-gray-500 italic pl-1">No Team Leaders mapped</span>
                    </div>
                  )}

                </div>

              </div>
            ))}
            {hierarchy.length === 0 && (
              <p className="py-8 text-center text-gray-500 text-xs italic">No organizational mappings defined yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
