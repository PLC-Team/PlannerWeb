'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { User } from '@/types';
import { 
  Users, Loader2, ArrowRightLeft, UserMinus, UserPlus, 
  Clock, CheckCircle, AlertTriangle, ArrowLeftRight
} from 'lucide-react';

export default function MyTeamPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
  const [permanentMembers, setPermanentMembers] = useState<any[]>([]);
  const [transferredIn, setTransferredIn] = useState<any[]>([]);
  const [transferredOut, setTransferredOut] = useState<any[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  
  // Modal states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [destinationTL, setDestinationTL] = useState<string>('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch all TLs (for destination dropdown)
      const { data: tls } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'team_leader')
        .neq('id', user.id);
      setTeamLeaders(tls || []);

      // 2. Fetch my primary hierarchy links (I am the TL)
      const { data: myHierarchy } = await supabase
        .from('hierarchy')
        .select('*, member:users!hierarchy_team_member_id_fkey(*)')
        .eq('team_leader_id', user.id)
        .not('team_member_id', 'is', null);

      // 3. Fetch active transfers where I am original OR destination
      const { data: activeTransfers } = await supabase
        .from('team_transfers')
        .select('*, member:users!team_transfers_team_member_id_fkey(*), original:users!team_transfers_original_tl_id_fkey(name), dest:users!team_transfers_destination_tl_id_fkey(name)')
        .eq('status', 'active')
        .or(`original_tl_id.eq.${user.id},destination_tl_id.eq.${user.id}`);

      // 4. Categorize members
      const activeTransfersArr = activeTransfers || [];
      const hierarchyArr = myHierarchy || [];

      // Transferred IN: I am destination_tl
      const tIn = activeTransfersArr.filter((t: any) => t.destination_tl_id === user.id);
      setTransferredIn(tIn);

      // Transferred OUT: I am original_tl
      const tOut = activeTransfersArr.filter((t: any) => t.original_tl_id === user.id);
      setTransferredOut(tOut);

      // Permanent: In my hierarchy, BUT NOT in transferred IN list, AND we will flag if they are transferred OUT
      // Actually, my permanent members are those where my hierarchy entry is the ORIGINAL one.
      // To reliably find permanent members, we look at hierarchy where I am TL.
      // But wait! When a member is transferred to me, a temporary row is added to hierarchy.
      // So 'myHierarchy' includes permanent AND transferred-in.
      const tInMemberIds = tIn.map((t: any) => t.team_member_id);
      const perm = hierarchyArr.filter((h: any) => !tInMemberIds.includes(h.team_member_id));
      
      // Attach transfer out status to permanent members if they are currently transferred out
      const permWithStatus = perm.map((p: any) => {
        const outTransfer = tOut.find((t: any) => t.team_member_id === p.team_member_id);
        return {
          ...p,
          isTransferredOut: !!outTransfer,
          transferDetails: outTransfer
        };
      });
      setPermanentMembers(permWithStatus);

      // 5. Fetch Transfer History (returned)
      const { data: historyData } = await supabase
        .from('team_transfers')
        .select('*, member:users!team_transfers_team_member_id_fkey(name), original:users!team_transfers_original_tl_id_fkey(name), dest:users!team_transfers_destination_tl_id_fkey(name)')
        .eq('status', 'returned')
        .or(`original_tl_id.eq.${user.id},destination_tl_id.eq.${user.id}`)
        .order('return_date', { ascending: false });
        
      setTransferHistory(historyData || []);

    } catch (err) {
      console.error('Error fetching team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleTransferOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !destinationTL || !user) return;
    
    setActionLoading(true);
    try {
      // 1. Get my manager ID so we can insert the temporary hierarchy row for the destination TL
      // Wait, the destination TL has their own manager. We need to find the destination TL's manager.
      const { data: destTLHierarchy } = await supabase
        .from('hierarchy')
        .select('manager_id')
        .eq('team_leader_id', destinationTL)
        .limit(1);
        
      const destManagerId = destTLHierarchy?.[0]?.manager_id || null;
      if (!destManagerId) throw new Error("Could not find manager for destination Team Leader.");

      // 2. Insert into team_transfers
      const { error: transferErr } = await supabase
        .from('team_transfers')
        .insert({
          team_member_id: selectedMember,
          original_tl_id: user.id,
          destination_tl_id: destinationTL,
          remarks: transferRemarks,
          status: 'active'
        });
      if (transferErr) throw transferErr;

      // 3. Insert temporary hierarchy row for destination TL
      const { error: hierErr } = await supabase
        .from('hierarchy')
        .insert({
          manager_id: destManagerId,
          team_leader_id: destinationTL,
          team_member_id: selectedMember
        });
      if (hierErr) throw hierErr;

      setIsTransferModalOpen(false);
      setSelectedMember('');
      setDestinationTL('');
      setTransferRemarks('');
      await fetchData();
      alert('Team member transferred successfully.');
    } catch (err: any) {
      alert(err.message || 'Error transferring member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnMember = async (transfer: any) => {
    if (!confirm(`Are you sure you want to return ${transfer.member?.name} to their original Team Leader?`)) return;
    setActionLoading(true);
    try {
      // Validation: Check if there are open tasks assigned by me to this member
      const { data: openTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_to', transfer.team_member_id)
        .eq('assigned_by', user?.id)
        .neq('status', 'closed')
        .neq('status', 'approved_by_manager');
        
      if (openTasks && openTasks.length > 0) {
        alert("Employee has pending assignments and cannot be transferred back until all assigned work is completed.");
        setActionLoading(false);
        return;
      }

      // Also check if they are in any project members for projects assigned to me
      // Wait, typically TL assigns tasks. If tasks are cleared, we are good.
      // Proceed with return:
      // 1. Update transfer status
      const { error: updateErr } = await supabase
        .from('team_transfers')
        .update({ status: 'returned', return_date: new Date().toISOString() })
        .eq('id', transfer.id);
      if (updateErr) throw updateErr;

      // 2. Delete temporary hierarchy row
      const { error: delErr } = await supabase
        .from('hierarchy')
        .delete()
        .eq('team_leader_id', user?.id)
        .eq('team_member_id', transfer.team_member_id);
      if (delErr) throw delErr;

      await fetchData();
      alert('Team member returned successfully.');
    } catch (err: any) {
      alert(err.message || 'Error returning member.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex py-24 justify-center items-center">
        <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animated-fade relative">
      <div className="absolute top-[-100px] right-[-100px] w-[350px] h-[350px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none z-0" />
      
      <div className="flex justify-between items-start border-b border-white/5 pb-5 z-10 relative">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] font-heading flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-500" />
            My Team Management
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Manage your permanent team members and temporary transfers.
          </p>
        </div>
        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Transfer Member Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 z-10 relative">
        
        {/* Left Column: Permanent Members */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Permanent Team Members ({permanentMembers.length})
          </h2>
          
          <div className="flex flex-col gap-3">
            {permanentMembers.length === 0 ? (
              <div className="glass p-6 rounded-xl text-center text-sm text-gray-500">No permanent team members assigned.</div>
            ) : (
              permanentMembers.map(perm => (
                <div key={perm.id} className={`glass p-4 rounded-xl flex justify-between items-center border-l-4 ${perm.isTransferredOut ? 'border-l-orange-500 opacity-70' : 'border-l-blue-500'}`}>
                  <div>
                    <h3 className="text-sm font-bold text-white">{perm.member?.name || 'Unknown'}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-gray-400 font-mono">{perm.member?.employee_id || 'No ID'}</span>
                      {perm.isTransferredOut && (
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                          <UserMinus className="w-3 h-3" /> Transferred to {perm.transferDetails?.dest?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {/* Status Badge */}
                    {!perm.isTransferredOut && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Transferred In & Out */}
        <div className="flex flex-col gap-6">
          
          {/* Transferred In */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              Transferred In (Temporary) ({transferredIn.length})
            </h2>
            <div className="flex flex-col gap-3">
              {transferredIn.length === 0 ? (
                <div className="glass p-6 rounded-xl text-center text-sm text-gray-500">No temporary members currently transferred to you.</div>
              ) : (
                transferredIn.map(tIn => (
                  <div key={tIn.id} className="glass p-4 rounded-xl flex flex-col gap-3 border-l-4 border-l-purple-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><UserPlus className="w-16 h-16" /></div>
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <h3 className="text-sm font-bold text-purple-300">{tIn.member?.name || 'Unknown'}</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          From: <strong className="text-gray-300">{tIn.original?.name}</strong> • Date: {new Date(tIn.transfer_date).toLocaleDateString()}
                        </p>
                        {tIn.remarks && (
                          <p className="text-[11px] text-gray-300 mt-2 bg-white/5 p-2 rounded italic">"{tIn.remarks}"</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleReturnMember(tIn)}
                        disabled={actionLoading}
                        className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1"
                        title="Return to original Team Leader"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        Return
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Transfer History */}
      <div className="flex flex-col gap-4 mt-4 z-10 relative">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Transfer History
        </h2>
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-[10px] uppercase text-gray-500 bg-white/5 border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">From TL</th>
                  <th className="px-4 py-3">To TL</th>
                  <th className="px-4 py-3">Transfer Date</th>
                  <th className="px-4 py-3">Return Date</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No transfer history found.</td>
                  </tr>
                ) : (
                  transferHistory.map(hist => (
                    <tr key={hist.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-white">{hist.member?.name}</td>
                      <td className="px-4 py-3">{hist.original?.name}</td>
                      <td className="px-4 py-3">{hist.dest?.name}</td>
                      <td className="px-4 py-3">{new Date(hist.transfer_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{hist.return_date ? new Date(hist.return_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white font-heading">Transfer Team Member</h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleTransferOut} className="p-5 flex flex-col gap-4">
              
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex gap-3 text-sm text-blue-200">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-blue-400" />
                <p>Transferring a member gives the destination TL temporary assignment rights. You will retain primary ownership.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Member</label>
                <select 
                  required
                  value={selectedMember}
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Member --</option>
                  {permanentMembers.filter(p => !p.isTransferredOut).map(perm => (
                    <option key={perm.member?.id} value={perm.member?.id}>{perm.member?.name} ({perm.member?.employee_id || 'No ID'})</option>
                  ))}
                </select>
                {permanentMembers.filter(p => !p.isTransferredOut).length === 0 && (
                  <p className="text-xs text-red-400 mt-1">No available permanent members to transfer.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Destination Team Leader</label>
                <select 
                  required
                  value={destinationTL}
                  onChange={e => setDestinationTL(e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose TL --</option>
                  {teamLeaders.map((tl: any) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remarks (Optional)</label>
                <textarea 
                  value={transferRemarks}
                  onChange={e => setTransferRemarks(e.target.value)}
                  rows={3}
                  placeholder="Reason for transfer, e.g., Workload balancing for Project X"
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedMember || !destinationTL}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
