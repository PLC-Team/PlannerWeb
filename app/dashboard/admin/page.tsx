'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, supabaseSignUpClient } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { User, Hierarchy, ActivityLog, UserRole } from '@/types';
import { 
  Users, GitMerge, Database, Plus, Trash2, Edit2, 
  Search, Shield, CheckCircle, AlertCircle, Loader2,
  Lock, Mail, Star, RefreshCw, X
} from 'lucide-react';
import { registerUserAction, deleteUserAction } from '@/app/actions/admin';

export default function AdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: currentAdmin } = useUser();
  const currentTab = searchParams.get('tab') || 'users';

  // State Lists
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<Hierarchy[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Loaders
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Forms - Create User
  const [newUserForm, setNewUserForm] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    role: 'team_member' as UserRole,
    designation: '',
  });
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', designation: '', role: 'team_member' as UserRole });
  const [updatingUser, setUpdatingUser] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Delete User State
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Forms - Create Hierarchy Mapping
  const [newHierarchyForm, setNewHierarchyForm] = useState({
    manager_id: '',
    team_leader_id: '',
    team_member_id: '',
  });
  const [hierarchyError, setHierarchyError] = useState('');
  const [hierarchySuccess, setHierarchySuccess] = useState('');
  const [creatingHierarchy, setCreatingHierarchy] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Filters
  const [searchUserQuery, setSearchUserQuery] = useState('');

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

  // Fetch Data Functions
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('employee_id', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchHierarchy = async () => {
    setLoadingHierarchy(true);
    try {
      const { data, error } = await supabase
        .from('hierarchy')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHierarchy(data || []);
    } catch (err: any) {
      console.error('Error fetching hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (currentAdmin?.role === 'admin') {
      fetchUsers();
      fetchHierarchy();
      fetchLogs();
    }
  }, [currentAdmin?.id, currentAdmin?.role]);

  // Log activity helper
  const logActivity = async (action: string, details: any) => {
    if (!currentAdmin) return;
    try {
      await supabase.from('activity_logs').insert({
        user_id: currentAdmin.id,
        action,
        details,
      });
      fetchLogs();
    } catch (err) {
      console.error('Error writing audit log:', err);
    }
  };

  // Register user handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');
    setCreatingUser(true);

    const { employee_id, name, email, password, role, designation } = newUserForm;

    if (!employee_id || !name || !email || !password || !role) {
      setUserFormError('Please fill in Employee ID, name, email, password, and role.');
      setCreatingUser(false);
      return;
    }

    try {
      const res = await registerUserAction({
        employee_id,
        name,
        email,
        password,
        role,
        designation
      });

      if (!res || !res.success) {
        throw new Error(res?.error || "Failed to register user. The server encountered an unexpected error.");
      }

      setUserFormSuccess(`User ${name} has been successfully registered!`);
      setNewUserForm({ employee_id: '', name: '', email: '', password: '', role: 'team_member', designation: '' });
      
      // Log activity
      await logActivity('User Registered', { name, email, role, designation });
      
      // Refetch
      fetchUsers();
      setTimeout(() => {
        setShowRegisterModal(false);
        setUserFormSuccess('');
      }, 1500);
    } catch (err: any) {
      setUserFormError(err.message || 'Error registering user.');
    } finally {
      setCreatingUser(false);
    }
  };

  // Edit user action handlers
  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      designation: user.designation || '',
      role: user.role,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          designation: editForm.designation,
          role: editForm.role,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      await logActivity('User Profile Updated', { 
        user_id: editingUser.id, 
        old: { name: editingUser.name, role: editingUser.role, designation: editingUser.designation },
        new: editForm 
      });

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Error updating user.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeleting(true);
    setDeleteError('');

    try {
      const res = await deleteUserAction(deleteConfirmUser.id);
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete user.');
      }

      await logActivity('User Deleted', { 
        deleted_id: deleteConfirmUser.id, 
        name: deleteConfirmUser.name,
        email: deleteConfirmUser.email,
        role: deleteConfirmUser.role
      });

      setDeleteConfirmUser(null);
      fetchUsers();
      fetchHierarchy();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting user.');
    } finally {
      setDeleting(false);
    }
  };

  // Hierarchy mapping handlers
  const handleCreateHierarchy = async (e: React.FormEvent) => {
    e.preventDefault();
    setHierarchyError('');
    setHierarchySuccess('');
    setCreatingHierarchy(true);

    const { manager_id, team_leader_id, team_member_id } = newHierarchyForm;

    if (!manager_id || !team_leader_id) {
      setHierarchyError('Manager and Team Leader are required mapping values.');
      setCreatingHierarchy(false);
      return;
    }

    try {
      // Validate mapping roles
      const mgr = users.find(u => u.id === manager_id);
      const tl = users.find(u => u.id === team_leader_id);
      const tm = team_member_id ? users.find(u => u.id === team_member_id) : null;

      if (mgr?.role !== 'manager') throw new Error('Selected Manager does not possess manager role.');
      if (tl?.role !== 'team_leader') throw new Error('Selected Team Leader does not possess team_leader role.');
      if (tm && tm.role !== 'team_member') throw new Error('Selected Team Member does not possess team_member role.');

      const { error } = await supabase
        .from('hierarchy')
        .insert({
          manager_id,
          team_leader_id,
          team_member_id: team_member_id || null
        });

      if (error) throw error;

      setHierarchySuccess('Organizational hierarchy link saved successfully.');
      setNewHierarchyForm({ manager_id: '', team_leader_id: '', team_member_id: '' });
      
      await logActivity('Hierarchy Map Added', { 
        manager: mgr.name, 
        team_leader: tl.name, 
        team_member: tm ? tm.name : 'All Members' 
      });

      fetchHierarchy();
      setTimeout(() => {
        setShowConfigModal(false);
        setHierarchySuccess('');
      }, 1500);
    } catch (err: any) {
      setHierarchyError(err.message || 'Error creating hierarchy link.');
    } finally {
      setCreatingHierarchy(false);
    }
  };

  const handleDeleteHierarchy = async (id: string) => {
    if (!confirm('Remove this organizational mapping relation?')) return;
    try {
      const { error } = await supabase
        .from('hierarchy')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logActivity('Hierarchy Map Deleted', { mapping_id: id });
      fetchHierarchy();
    } catch (err: any) {
      alert(err.message || 'Error removing hierarchy link.');
    }
  };

  // Get name by ID helpers
  const getUserName = (id: string | null) => {
    if (!id) return '-';
    return users.find(u => u.id === id)?.name || 'Unknown User';
  };

  const getRoleBadge = (roleStr: UserRole) => {
    switch (roleStr) {
      case 'admin': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">Admin</span>;

      case 'manager': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">Manager</span>;
      case 'team_leader': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Team Leader</span>;
      case 'team_member': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Team Member</span>;
    }
  };

  // Filter users list
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
    (u.designation || '').toLowerCase().includes(searchUserQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6 animated-fade">
      {/* Intro header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-heading">
            System Administration Portal
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure platform profiles, establish report mappings, and review audit logs.
          </p>
        </div>
      </div>

      {/* Tabs Viewport */}
      {currentTab === 'users' && (
        <div className="flex flex-col gap-6 animated-fade">
          {/* User management table (full width) */}
          <div className="glass p-6 rounded-xl flex flex-col gap-4 w-full">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-2">
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Active Profiles
              </h2>
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Filter users..."
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                {/* Register Button */}
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="btn-primary text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2"
                >
                  <Plus className="w-4 h-4" />
                  Register Profile
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="flex py-12 justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 font-semibold">
                      <th className="py-3 px-4">EMP ID</th>
                      <th className="py-3 px-4">NAME</th>
                      <th className="py-3 px-4">EMAIL</th>
                      <th className="py-3 px-4">ROLE</th>
                      <th className="py-3 px-4">DESIGNATION</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-white/5 transition">
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-400">{u.employee_id || '-'}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">{u.name}</td>
                        <td className="py-3.5 px-4 text-gray-400">{u.email}</td>
                        <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>
                        <td className="py-3.5 px-4 font-medium">{u.designation || '-'}</td>
                        <td className="py-3.5 px-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => startEditUser(u)}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {currentAdmin?.id !== u.id && (
                            <button
                              onClick={() => { setDeleteConfirmUser(u); setDeleteError(''); }}
                              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add User Modal */}
          {mounted && showRegisterModal && createPortal(
            <div className="fixed inset-0 bg-[#07090e]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-[#11182b] border border-white/10 shadow-2xl rounded-xl flex flex-col w-full md:w-[60vw] max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header (Fixed) */}
                <div className="flex-shrink-0 p-5 border-b border-white/10 relative flex justify-between items-center">
                  <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-500" />
                    Register Profile
                  </h2>
                  <button
                    onClick={() => {
                      setShowRegisterModal(false);
                      setUserFormError('');
                      setUserFormSuccess('');
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                  {userFormError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{userFormError}</span>
                    </div>
                  )}
                  {userFormSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mb-4">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{userFormSuccess}</span>
                    </div>
                  )}

                  <form id="registerUserForm" onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Row 1 */}
                    <div className="form-group">
                      <label>EMPLOYEE ID</label>
                      <input
                        type="text"
                        placeholder="e.g. EMP-001"
                        value={newUserForm.employee_id}
                        onChange={(e) => setNewUserForm({ ...newUserForm, employee_id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>NAME</label>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        required
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="form-group">
                      <label>EMAIL ADDRESS</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="email"
                          placeholder="email@company.com"
                          value={newUserForm.email}
                          onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>ROLE</label>
                      <select
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                        required
                      >
                        <option value="admin">Admin</option>

                        <option value="manager">Manager</option>
                        <option value="team_leader">Team Leader</option>
                        <option value="team_member">Team Member</option>
                      </select>
                    </div>

                    {/* Row 3 */}
                    <div className="form-group">
                      <label>PASSWORD</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>DEPARTMENT / DESIGNATION</label>
                      <input
                        type="text"
                        placeholder="e.g. Engineering"
                        value={newUserForm.designation}
                        onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                      />
                    </div>
                  </form>
                </div>

                {/* Footer (Fixed) */}
                <div className="flex-shrink-0 p-5 border-t border-white/10 flex justify-end gap-3 bg-[#0d1323]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setUserFormError('');
                      setUserFormSuccess('');
                    }}
                    className="btn-secondary px-6"
                  >
                    Cancel
                  </button>
                  <button
                    form="registerUserForm"
                    type="submit"
                    className="btn-primary px-6 font-semibold"
                    disabled={creatingUser}
                  >
                    {creatingUser ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Save Profile'
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Edit User Modal */}
          {mounted && editingUser && createPortal(
            <div className="fixed inset-0 bg-[#07090e]/80 backdrop-blur-sm z-[100] md:pl-[280px] flex items-center justify-center p-4">
              <div className="bg-[#11182b] border border-blue-500/30 shadow-2xl p-5 rounded-xl flex flex-col gap-3 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                  onClick={() => setEditingUser(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-500" />
                  Edit Profile
                </h2>

                <form onSubmit={handleUpdateUser} className="flex flex-col gap-4 text-xs">
                  <div className="form-group">
                    <label>NAME</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ROLE</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      required
                    >
                      <option value="admin">Admin</option>

                      <option value="manager">Manager</option>
                      <option value="team_leader">Team Leader</option>
                      <option value="team_member">Team Member</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>DESIGNATION</label>
                    <input
                      type="text"
                      value={editForm.designation}
                      onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={updatingUser}
                      className="btn-primary flex-1 font-semibold"
                    >
                      {updatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {currentTab === 'hierarchy' && (
        <div className="flex flex-col gap-6 animated-fade">
          {/* Hierarchy listings tree */}
          <div className="glass p-6 rounded-xl flex flex-col gap-4 w-full">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-2">
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-blue-500" />
                Organizational Tree Flow
              </h2>
              <button
                onClick={() => setShowConfigModal(true)}
                className="btn-primary text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2"
              >
                <Plus className="w-4 h-4" />
                Configure Link
              </button>
            </div>

            {loadingHierarchy ? (
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
                                  {tl.linkId && (
                                    <button
                                      onClick={() => handleDeleteHierarchy(tl.linkId!)}
                                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 bg-red-500/10 p-1 rounded transition-all z-20"
                                      title="Remove Team Leader Link"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
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
                                          {tm.linkId && (
                                            <button
                                              onClick={() => handleDeleteHierarchy(tm.linkId!)}
                                              className="opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-all absolute right-2 bg-red-500/10"
                                              title="Remove Member Link"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
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

          {/* Add Hierarchy mapping Modal */}
          {showConfigModal && (
            <div className="fixed inset-0 bg-[#07090e]/80 backdrop-blur-sm z-[100] md:pl-[280px] flex items-center justify-center p-4">
              <div className="bg-[#11182b] border border-white/10 shadow-2xl p-5 rounded-xl flex flex-col gap-3 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setHierarchyError('');
                    setHierarchySuccess('');
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-500" />
                  Configure Link
                </h2>

                {hierarchyError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{hierarchyError}</span>
                  </div>
                )}
                {hierarchySuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{hierarchySuccess}</span>
                  </div>
                )}

                <form onSubmit={handleCreateHierarchy} className="flex flex-col gap-3.5 text-xs">
                  <div className="form-group">
                    <label>MANAGER</label>
                    <select
                      value={newHierarchyForm.manager_id}
                      onChange={(e) => setNewHierarchyForm({ ...newHierarchyForm, manager_id: e.target.value })}
                      required
                    >
                      <option value="">Select Manager</option>
                      {users.filter(u => u.role === 'manager').map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.designation || 'Manager'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>TEAM LEADER</label>
                    <select
                      value={newHierarchyForm.team_leader_id}
                      onChange={(e) => setNewHierarchyForm({ ...newHierarchyForm, team_leader_id: e.target.value })}
                      required
                    >
                      <option value="">Select Team Leader</option>
                      {users.filter(u => u.role === 'team_leader').map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.designation || 'Leader'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>TEAM MEMBER (OPTIONAL)</label>
                    <select
                      value={newHierarchyForm.team_member_id}
                      onChange={(e) => setNewHierarchyForm({ ...newHierarchyForm, team_member_id: e.target.value })}
                    >
                      <option value="">Select Team Member (For TM-TL Mapping)</option>
                      {users
                        .filter(u => u.role === 'team_member' && !hierarchy.some(h => h.team_member_id === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.designation || 'Member'})</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-500 leading-tight mt-1.5">
                      Select a team member to link them under the Team Leader. Leave blank to register the Team Leader under the Manager only.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full mt-2 font-semibold"
                    disabled={creatingHierarchy}
                  >
                    {creatingHierarchy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      'Link Mappings'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === 'logs' && (
        <div className="glass p-6 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Platform Activity Log
            </h2>
            <button
              onClick={fetchLogs}
              className="btn-secondary-sm text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>

          {loadingLogs ? (
            <div className="flex py-12 justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] scroll-container">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-semibold sticky top-0 bg-[#0d111c] z-10">
                    <th className="py-3 px-4">TIMESTAMP</th>
                    <th className="py-3 px-4">ACTOR</th>
                    <th className="py-3 px-4">ACTION</th>
                    <th className="py-3 px-4">AUDIT DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-white/5 transition align-top">
                      <td className="py-3 px-4 text-gray-500 font-mono text-[10px] whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                        {getUserName(l.user_id)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 leading-normal max-w-sm overflow-hidden text-ellipsis">
                        {typeof l.details === 'object' ? JSON.stringify(l.details) : l.details}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">No activity logs recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ── DELETE CONFIRMATION MODAL ── */}
      {mounted && deleteConfirmUser && createPortal(
        <div className="fixed inset-0 bg-[#07090e]/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fadeIn md:pl-[280px]">
          <div className="bg-[#11182b] border border-red-500/20 shadow-2xl w-full max-w-sm p-6 rounded-xl flex flex-col gap-5">
            
            {/* Icon + Title */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-heading">Delete User Account</h3>
                <p className="text-xs text-gray-400 mt-1">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            {/* User Details */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white font-semibold">{deleteConfirmUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-gray-300">{deleteConfirmUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Role</span>
                <span className="text-white font-semibold capitalize">{deleteConfirmUser.role.replace('_', ' ')}</span>
              </div>
              {deleteConfirmUser.designation && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Designation</span>
                  <span className="text-gray-300">{deleteConfirmUser.designation}</span>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Deleting this user will remove their login access, profile, and all hierarchy mappings associated with them.</span>
            </div>

            {/* Error */}
            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2.5 px-4 rounded-lg transition disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => { setDeleteConfirmUser(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 btn-secondary font-semibold text-xs"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
