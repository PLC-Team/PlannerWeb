'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { User, Hierarchy } from '@/types';
import { GitMerge, Loader2, Users } from 'lucide-react';

export default function ReportingHierarchyPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<Hierarchy[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Data Functions
  const fetchData = async () => {
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

    // 3. Fetch Transfer History
    const { data: historyData } = await supabase
      .from('team_transfers')
      .select('*, member:users!team_transfers_team_member_id_fkey(name), original:users!team_transfers_original_tl_id_fkey(name), dest:users!team_transfers_destination_tl_id_fkey(name)')
      .order('transfer_date', { ascending: false });

    return { 
      users: usersData || [], 
      hierarchy: hierarchyData || [], 
      history: historyData || [] 
    };
  };

  const { data: hierarchyCache, error: hierarchyError } = useSWR(currentUser ? `hierarchy-${currentUser.id}` : null, fetchData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000
  });

  useEffect(() => {
    if (hierarchyCache) {
      setUsers(hierarchyCache.users);
      setHierarchy(hierarchyCache.hierarchy);
      setTransferHistory(hierarchyCache.history);
      setLoading(false);
    } else if (hierarchyError) {
      console.error('Error fetching hierarchy data:', hierarchyError);
      setLoading(false);
    }
  }, [hierarchyCache, hierarchyError]);

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
          designation: tlUser?.designation || 'Team Leader',
          members: tmUsers.map(tm => ({
            id: tm.id,
            name: tm.name,
            designation: tm.designation || 'Team Member',
            linkId: tmLinks.find(l => l.team_member_id === tm.id)?.id
          })),
          linkId: managerLinks.find(l => l.team_leader_id === tlId && !l.team_member_id)?.id
        };
      });

      return {
        id: mgr.id,
        name: mgr.name,
        designation: mgr.designation || 'Operations Manager',
        teamLeaders: tlNodes
      };
    });
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6 animated-fade">
      {/* Hierarchy listings tree */}
      <div className="glass p-6 rounded-xl flex flex-col gap-4 w-full">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-2">
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-blue-500" />
            Organizational Tree Flow
          </h2>
        </div>

        {loading ? (
          <div className="flex py-12 justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : (
          <div className="flex flex-col gap-6 max-h-[700px] overflow-y-auto scroll-container p-2">
            {getHierarchyTree().map(mgr => (
              <div key={mgr.id} className="glass-inner w-full flex flex-col gap-4 p-6 rounded-xl relative border border-white/5 bg-white/2 overflow-x-auto scroll-container">
                
                {/* Header for this manager block */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Reporting Structure under {mgr.name}
                    </span>
                  </div>
                </div>

                {/* Top-Down Org Chart Flow */}
                <div className="flex flex-col items-center pt-6 pb-12 w-full min-w-max">
                  
                  {/* Level 1: Manager Node */}
                  <div className="relative flex flex-col items-center z-10">
                    <div className="flex flex-col items-center bg-[#1a2333] border border-blue-500/30 w-56 shadow-lg shadow-blue-900/20 group relative overflow-hidden transition-all duration-300 hover:border-blue-400/60 hover:shadow-blue-500/20">
                      <div className="w-full h-28 bg-[#111827] flex items-center justify-center border-b border-blue-500/20 relative">
                         {/* Decorative glow */}
                         <div className="absolute inset-0 bg-blue-500/5" />
                         <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 border-2 border-blue-400/50 flex items-center justify-center text-white text-xl font-bold shadow-md relative z-10">
                            {getInitials(mgr.name)}
                         </div>
                      </div>
                      <div className="p-3 text-center flex flex-col items-center bg-[#1a2333] w-full relative z-10">
                        <span className="text-[11px] font-bold text-[#F8FAFC] uppercase tracking-wider leading-tight">{mgr.name}</span>
                        <span className="text-[9px] text-blue-300/80 font-semibold block mt-1 tracking-widest uppercase">{mgr.designation}</span>
                        <span className="text-[10px] text-slate-400 block mt-1.5 font-medium">
                          Reportees: {mgr.teamLeaders.reduce((acc, tl) => acc + 1 + tl.members.length, 0)}
                        </span>
                      </div>
                    </div>

                    {mgr.teamLeaders.length > 0 && (
                      <div className="w-px h-8 bg-blue-500/40" />
                    )}
                  </div>

                  {/* Level 2: Team Leaders Row */}
                  {mgr.teamLeaders.length > 0 && (
                    <div className="flex justify-center relative w-full">
                      {mgr.teamLeaders.map((tl, tlIdx, tlArr) => (
                        <div key={tl.id} className="relative flex flex-col items-center px-4">
                          
                          <div className={`absolute top-0 right-1/2 w-1/2 h-px bg-blue-500/40 ${tlIdx === 0 ? 'hidden' : ''}`} />
                          <div className={`absolute top-0 left-1/2 w-1/2 h-px bg-blue-500/40 ${tlIdx === tlArr.length - 1 ? 'hidden' : ''}`} />
                          
                          <div className="w-px h-8 bg-blue-500/40" />
                          
                          <div className="relative flex flex-col items-center bg-[#1a2333] border border-purple-500/30 w-48 shadow-lg shadow-purple-900/10 group transition-all duration-300 hover:border-purple-400/60 hover:shadow-purple-500/20">
                            <div className="w-full h-24 bg-[#111827] flex items-center justify-center border-b border-purple-500/20 relative">
                               <div className="absolute inset-0 bg-purple-500/5" />
                               <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-700 border-2 border-purple-400/50 flex items-center justify-center text-white text-lg font-bold shadow-md relative z-10">
                                  {getInitials(tl.name)}
                               </div>
                            </div>
                            <div className="p-2.5 text-center flex flex-col items-center bg-[#1a2333] w-full relative z-10">
                              <span className="text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider leading-tight">{tl.name}</span>
                              <span className="text-[8px] text-purple-300/80 font-semibold block mt-1 tracking-widest uppercase">{tl.designation}</span>
                              <span className="text-[9px] text-slate-400 block mt-1.5 font-medium">
                                Reportees: {tl.members.length}
                              </span>
                            </div>
                          </div>

                          {tl.members.length > 0 && (
                            <div className="w-px h-8 bg-purple-500/40" />
                          )}

                          {/* Level 3: Team Members List-Style Box */}
                          {tl.members.length > 0 && (
                            <div className="flex flex-col items-center relative w-full mt-0">
                              <div className="w-px h-6 bg-purple-500/40" />
                              <div className="w-full max-w-[220px] bg-[#111827] border border-emerald-500/30 shadow-lg shadow-emerald-900/10 overflow-hidden group transition-all hover:border-emerald-500/50">
                                <div className="bg-[#1a2333] border-b border-emerald-500/20 p-2.5 flex items-center justify-center gap-2 relative">
                                  <div className="absolute inset-0 bg-emerald-500/5" />
                                  <Users className="w-3.5 h-3.5 text-emerald-400 relative z-10" />
                                  <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider relative z-10">Team Members</span>
                                  <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-bold relative z-10">{tl.members.length}</span>
                                </div>
                                <div className="flex flex-col divide-y divide-emerald-500/10 max-h-[250px] overflow-y-auto">
                                  {tl.members.map((tm) => (
                                    <div key={tm.id} className="p-2.5 flex items-center justify-between hover:bg-emerald-500/5 transition-colors relative group/item">
                                      <div className="flex items-center gap-2.5 min-w-0 pr-4">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 shadow-sm border border-emerald-400/20">
                                          {getInitials(tm.name)}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[10px] font-bold text-gray-200 truncate leading-tight block">{tm.name}</span>
                                          <span className="text-[8px] text-emerald-400/80 uppercase truncate block mt-0.5 tracking-wide">{tm.designation || 'Member'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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

      {/* Global Transfer History Section */}
      <div className="glass p-6 rounded-xl flex flex-col gap-4 w-full z-10 relative">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-2">
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-500" />
            Global Transfer History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-[10px] uppercase text-gray-500 bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">From TL</th>
                <th className="px-4 py-3">To TL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transfer Date</th>
                <th className="px-4 py-3">Return Date</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {transferHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No transfers recorded in the system.</td>
                </tr>
              ) : (
                transferHistory.map(hist => (
                  <tr key={hist.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-white">{hist.member?.name}</td>
                    <td className="px-4 py-3">{hist.original?.name}</td>
                    <td className="px-4 py-3">{hist.dest?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hist.status === 'active' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {hist.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(hist.transfer_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{hist.return_date ? new Date(hist.return_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 italic text-gray-400">{hist.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
