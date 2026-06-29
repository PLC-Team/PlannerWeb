'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { 
  BookOpen, Plus, Clock, CheckCircle, Calendar, X,
  Loader2, FileText, User as UserIcon, Save, Search, 
  Filter, AlertCircle, TrendingUp, MoreVertical,
  Paperclip, History, ArrowRight
} from 'lucide-react';
import { TrainingRequest, TrainingRequestStatus, TrainingRequestPriority } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TrainingDashboardPage() {
  const { user, loading: userLoading } = useUser();
  const isManagerOrAdmin = ['manager', 'admin'].includes(user?.role || '');

  // Main UI States
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<(TrainingRequest & { requester?: { name: string }, trainer?: { name: string } }) | null>(null);

  // Form states for New Request / Plan Training
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TrainingRequestPriority>('medium');
  const [remarks, setRemarks] = useState('');
  
  const [planDate, setPlanDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [planTrainer, setPlanTrainer] = useState('');
  
  // Manage Form states (in Drawer)
  const [manageStatus, setManageStatus] = useState<TrainingRequestStatus>('requested');
  const [scheduledDate, setScheduledDate] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [managerRemarks, setManagerRemarks] = useState('');
  
  // Trainer Fulfilment Form States
  const [trainingDuration, setTrainingDuration] = useState('');
  const [trainingMode, setTrainingMode] = useState<'online'|'offline'>('online');
  const [trainerLocation, setTrainerLocation] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Fetch training requests
  const fetchRequests = async () => {
    if (!user) return [];
    
    let query = supabase
      .from('training_requests')
      .select('*, requester:users!training_requests_requested_by_fkey(name), trainer:users!training_requests_trainer_id_fkey(name)')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching training requests:', error);
      return [];
    }
    return data as (TrainingRequest & { requester?: { name: string }, trainer?: { name: string } })[];
  };

  const { data: requests, mutate, isValidating } = useSWR(
    user ? `training_requests_${user.id}` : null,
    fetchRequests
  );

  const requestList = requests || [];

  // KPI Calculations
  const pendingCount = requestList.filter(r => ['requested', 'under_review'].includes(r.status)).length;
  const approvedCount = requestList.filter(r => r.status === 'approved').length;
  const scheduledCount = requestList.filter(r => r.status === 'scheduled').length;
  const completedCount = requestList.filter(r => r.status === 'completed').length;

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataMap: Record<string, number> = {};
    
    // Initialize last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      dataMap[`${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`] = 0;
    }

    requestList.forEach(req => {
      const d = new Date(req.created_at);
      const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (dataMap[key] !== undefined) {
        dataMap[key]++;
      }
    });

    return Object.keys(dataMap).map(key => ({ name: key, Requests: dataMap[key] }));
  }, [requestList]);

  // Widgets Data
  const upcomingTrainings = requestList
    .filter(r => r.status === 'scheduled' && r.scheduled_date && new Date(r.scheduled_date) >= new Date())
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
    .slice(0, 4);

  const approvalQueue = requestList
    .filter(r => ['requested', 'under_review'].includes(r.status))
    .slice(0, 4);

  // Filtered List for Table
  const filteredRequests = requestList.filter(req => {
    const matchesSearch = req.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (req.requester?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleOpenNewModal = () => {
    setTopic('');
    setDescription('');
    setPriority('medium');
    setRemarks('');
    setIsNewRequestModalOpen(true);
  };

  const handleOpenDrawer = (req: TrainingRequest & { requester?: { name: string }, trainer?: { name: string } }) => {
    setSelectedRequest(req);
    setManageStatus(req.status);
    setScheduledDate(req.scheduled_date || '');
    setStartTime(req.start_time || '');
    setEndTime(req.end_time || '');
    setTrainerName(req.trainer_name || '');
    setManagerRemarks(req.manager_remarks || '');
    setTrainingDuration(req.training_duration || '');
    setTrainingMode(req.training_mode || 'online');
    setTrainerLocation(req.location || '');
    setIsDrawerOpen(true);
  };

  const submitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      let managerId = null;
      if (user.role === 'team_member' || user.role === 'team_leader') {
        const { data: hierarchy } = await supabase
          .from('hierarchy')
          .select('manager_id, team_leader_id')
          .or(`team_member_id.eq.${user.id},team_leader_id.eq.${user.id}`)
          .single();
        if (hierarchy) managerId = hierarchy.manager_id;
      }

      const { error } = await supabase
        .from('training_requests')
        .insert({
          topic, description, priority, remarks,
          request_type: 'request',
          requested_by: user.id, manager_id: managerId
        });

      if (error) throw error;

      if (managerId) {
        await supabase.from('notifications').insert({
          user_id: managerId,
          title: 'New Training Request',
          message: `${user.name} has requested training on "${topic}".`
        });
      }

      setIsNewRequestModalOpen(false);
      mutate();
    } catch (err: any) {
      alert('Error submitting request: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPlanRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      // 1. Insert the planned session
      const { data: newSession, error } = await supabase
        .from('training_requests')
        .insert({
          topic, description, priority: 'medium', remarks,
          request_type: 'planned',
          status: 'scheduled',
          scheduled_date: planDate,
          start_time: startTime,
          end_time: endTime,
          location,
          trainer_name: planTrainer,
          requested_by: user.id,
          manager_id: null
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Notify all employees
      // Fetch all user IDs
      const { data: allUsers, error: usersError } = await supabase.from('users').select('id');
      if (!usersError && allUsers) {
        const notificationPayloads = allUsers
          .filter((u: any) => u.id !== user.id) // Optionally don't notify the creator
          .map((u: any) => ({
            user_id: u.id,
            title: 'New Training Scheduled',
            message: `${user.name} has scheduled a training: "${topic}" on ${new Date(planDate).toLocaleDateString()}.`
          }));
        
        if (notificationPayloads.length > 0) {
          await supabase.from('notifications').insert(notificationPayloads);
        }
      }

      // Email Mock
      console.log(`[Email Mock] Sent email notifications to all employees for training: ${topic}`);

      setIsPlanModalOpen(false);
      mutate();
    } catch (err: any) {
      alert('Error planning training: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const takeOwnership = async () => {
    if (!selectedRequest || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('training_requests')
        .update({
          status: 'trainer_assigned',
          trainer_id: user.id
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.requested_by,
        title: 'Trainer Assigned',
        message: `${user.name} has volunteered to conduct your requested training: "${selectedRequest.topic}".`
      });

      setIsDrawerOpen(false);
      mutate();
    } catch (err: any) {
      alert('Error taking ownership: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTrainerSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('training_requests')
        .update({
          status: 'scheduled',
          scheduled_date: scheduledDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          location: trainerLocation || null,
          training_mode: trainingMode,
          training_duration: trainingDuration || null
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Notify Requestor
      await supabase.from('notifications').insert({
        user_id: selectedRequest.requested_by,
        title: 'Training Scheduled',
        message: `Your training "${selectedRequest.topic}" has been scheduled for ${scheduledDate}.`
      });

      // Notify all employees
      const { data: allUsers } = await supabase.from('users').select('id');
      if (allUsers) {
        const payloads = allUsers
          .filter((u: any) => u.id !== user.id && u.id !== selectedRequest.requested_by)
          .map((u: any) => ({
            user_id: u.id,
            title: 'New Training Scheduled',
            message: `${user.name} scheduled a new session: "${selectedRequest.topic}".`
          }));
        if (payloads.length > 0) {
          await supabase.from('notifications').insert(payloads);
        }
      }

      console.log(`[Email Mock] Sent emails for scheduled training: ${selectedRequest.topic}`);

      setIsDrawerOpen(false);
      mutate();
    } catch (err: any) {
      alert('Error scheduling training: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitManageRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('training_requests')
        .update({
          status: manageStatus,
          manager_remarks: managerRemarks
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.requested_by,
        title: 'Training Request Updated',
        message: `Your request for "${selectedRequest.topic}" was updated to ${manageStatus.replace('_', ' ')}.`
      });

      setIsDrawerOpen(false);
      mutate();
    } catch (err: any) {
      alert('Error updating request: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-transparent"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'under_review': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'approved': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'scheduled': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-[#1A2333] text-slate-300 border-blue-500/20';
    }
  };

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-transparent text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-6 font-sans text-[#F8FAFC] pb-24">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#090f1d]/75 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-blue-500/20">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC] flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              Training Requests
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Request, manage and track employee training programs</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="group flex items-center justify-center gap-2 bg-[#090f1d]/75 backdrop-blur-md hover:bg-transparent text-slate-300 border border-blue-500/20 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Calendar className="w-4 h-4 text-purple-500 transition-transform group-hover:scale-110" />
              Plan Training
            </button>
            {!isManagerOrAdmin && (
              <button
                onClick={handleOpenNewModal}
                className="group flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                New Request
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#090f1d]/75 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">Pending Requests</p>
                <p className="text-3xl font-bold text-[#F8FAFC]">{pendingCount}</p>
              </div>
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-[#090f1d]/75 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">Approved Requests</p>
                <p className="text-3xl font-bold text-[#F8FAFC]">{approvedCount}</p>
              </div>
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-[#090f1d]/75 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">Scheduled Trainings</p>
                <p className="text-3xl font-bold text-[#F8FAFC]">{scheduledCount}</p>
              </div>
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-[#090f1d]/75 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">Completed Trainings</p>
                <p className="text-3xl font-bold text-[#F8FAFC]">{completedCount}</p>
              </div>
              <div className="p-3 bg-green-500/20 text-green-400 rounded-xl group-hover:scale-110 transition-transform">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Widget */}
          <div className="lg:col-span-2 bg-[#090f1d]/75 backdrop-blur-md rounded-2xl border border-blue-500/20 shadow-sm p-6 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Monthly Training Volume
            </h3>
            <div className="flex-1 w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Requests" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Queue / Upcoming Widget */}
          <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-2xl border border-blue-500/20 shadow-sm p-6 flex flex-col h-[330px] overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              {isManagerOrAdmin ? <><AlertCircle className="w-4 h-4" /> Approval Queue</> : <><Calendar className="w-4 h-4" /> Upcoming Trainings</>}
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {isManagerOrAdmin ? (
                approvalQueue.length > 0 ? approvalQueue.map(req => (
                  <div key={req.id} onClick={() => handleOpenDrawer(req)} className="p-3 rounded-xl border border-blue-500/10 bg-transparent hover:border-blue-500/40 cursor-pointer transition-colors">
                    <p className="font-semibold text-sm text-[#F8FAFC] truncate">{req.topic}</p>
                    <p className="text-xs text-slate-400 mt-1">{req.requester?.name}</p>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-sm">Queue is empty</span>
                  </div>
                )
              ) : (
                upcomingTrainings.length > 0 ? upcomingTrainings.map(req => (
                  <div key={req.id} onClick={() => handleOpenDrawer(req)} className="p-3 rounded-xl border border-blue-500/10 bg-transparent hover:border-blue-500/40 cursor-pointer transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {req.request_type === 'planned' && <Calendar className="w-3 h-3 text-purple-500" />}
                        <p className="font-semibold text-sm text-[#F8FAFC] truncate max-w-[200px]">{req.topic}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(req.scheduled_date!).toLocaleDateString()} 
                        {req.start_time ? ` at ${req.start_time.substring(0, 5)}` : ''}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Calendar className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-sm">No upcoming trainings</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Data Grid Section */}
        <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-2xl border border-blue-500/20 shadow-sm overflow-hidden flex flex-col">
          
          {/* Filters Bar */}
          <div className="p-4 border-b border-blue-500/10 flex flex-col sm:flex-row gap-4 items-center justify-between bg-transparent/50">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search requests..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#090f1d]/75 backdrop-blur-md border border-blue-500/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#090f1d]/75 backdrop-blur-md border border-blue-500/20 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
              >
                <option value="all">All Statuses</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
              </select>
              <button 
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="p-2 text-slate-400 hover:text-slate-300 hover:bg-[#1A2333] rounded-lg transition-colors"
                title="Reset Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#090f1d]/75 backdrop-blur-md border-b border-blue-500/20 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">ID</th>
                  
                  <th className="py-4 px-6">Topic</th>
                  {isManagerOrAdmin && <th className="py-4 px-6">Requested By</th>}
                  <th className="py-4 px-6">Trainer</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isValidating && requestList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-[#1A2333] rounded-full flex items-center justify-center mb-4">
                          <BookOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-[#F8FAFC] mb-1">No Training Requests Yet</h3>
                        <p className="text-slate-400 text-sm max-w-sm mb-6">There are currently no requests matching your criteria. Create a new request to get started.</p>
                        {!isManagerOrAdmin && (
                          <div className="flex gap-2 justify-center">
                            <button onClick={handleOpenNewModal} className="text-sm font-medium bg-[#090f1d]/75 backdrop-blur-md border border-blue-500/20 shadow-sm px-4 py-2 rounded-lg hover:bg-transparent transition-colors">
                              Request Training
                            </button>
                            <button onClick={() => setIsPlanModalOpen(true)} className="text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 shadow-sm px-4 py-2 rounded-lg hover:bg-purple-100 transition-colors">
                              Plan Training
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr 
                      key={req.id} 
                      onClick={() => handleOpenDrawer(req)}
                      className="hover:bg-transparent/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-6 text-sm text-slate-400 font-mono">
                        TR-{req.id.substring(0, 4).toUpperCase()}
                      </td>
                      
                      <td className="py-3 px-6">
                        <p className="text-sm font-semibold text-[#F8FAFC]">{req.topic}</p>
                      </td>
                      {isManagerOrAdmin && (
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-700">
                                {req.requester?.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <span className="text-sm text-slate-300">{req.requester?.name || 'Unknown'}</span>
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-6 text-sm text-[#F8FAFC]">{req.trainer?.name || req.trainer_name || '-'}</td>
                      <td className="py-3 px-6 text-sm text-slate-300">
                        {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(req.status)} capitalize`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </td>
                      
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Centered Modal */}
      {isDrawerOpen && selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0 z-0" onClick={() => setIsDrawerOpen(false)} />
          <div className="bg-[#090f1d]/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-blue-500/20 relative z-10 animate-fade-in">
            <div className="px-6 py-4 border-b border-blue-500/10 flex items-center justify-between bg-transparent">
              <h2 className="text-lg font-bold text-[#F8FAFC]">Request Details</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-slate-400 hover:text-slate-300 hover:bg-[#1A2333] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-transparent/50">
              <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-xl border border-blue-500/20 p-5 shadow-sm mb-6">
                <div className="flex justify-between items-start mb-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedRequest.status)} capitalize`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">TR-{selectedRequest.id.substring(0,8).toUpperCase()}</span>
                </div>
                <h3 className="text-xl font-bold text-[#F8FAFC] mb-2">{selectedRequest.topic}</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{selectedRequest.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-slate-400 pt-4 border-t border-blue-500/10">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    {selectedRequest.requester?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedRequest.created_at).toLocaleDateString()}
                  </div>
                  {(selectedRequest.request_type === 'planned' || selectedRequest.status === 'scheduled') && (
                    <div className="flex items-center gap-1.5 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                      <Clock className="w-4 h-4" />
                      {selectedRequest.start_time?.substring(0, 5)} - {selectedRequest.end_time?.substring(0, 5)}
                    </div>
                  )}
                  {selectedRequest.trainer && (
                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <UserIcon className="w-4 h-4" />
                      Trainer: {selectedRequest.trainer.name}
                    </div>
                  )}
                </div>
                {(selectedRequest.request_type === 'planned' || selectedRequest.status === 'scheduled') && selectedRequest.location && (
                  <div className="mt-3 text-sm text-slate-300 bg-transparent p-3 rounded-lg border border-blue-500/10 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-300">{selectedRequest.training_mode === 'online' ? 'Meeting Link:' : 'Location:'}</span> 
                      {selectedRequest.location}
                    </div>
                    {selectedRequest.training_duration && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-slate-300">Duration:</span> 
                        {selectedRequest.training_duration}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mock Audit Log / History */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" /> Approval History
                </h4>
                <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-xl border border-blue-500/20 p-4 shadow-sm text-sm">
                  <div className="flex gap-3 mb-3">
                    <div className="w-2 bg-blue-100 rounded-full flex-shrink-0" />
                    <div>
                      <p className="text-[#F8FAFC]">Request submitted by {selectedRequest.requester?.name}</p>
                      <p className="text-xs text-slate-400">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedRequest.status !== 'requested' && (
                    <div className="flex gap-3">
                      <div className="w-2 bg-green-100 rounded-full flex-shrink-0" />
                      <div>
                        <p className="text-[#F8FAFC]">Status updated to {selectedRequest.status.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-400">System logged</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Member: Take Ownership */}
              {!isManagerOrAdmin && selectedRequest.status === 'requested' && selectedRequest.request_type !== 'planned' && (
                <div className="mb-6 bg-purple-50 border border-purple-100 p-4 rounded-xl">
                  <h4 className="text-sm font-bold text-purple-900 mb-2">Volunteer to Train</h4>
                  <p className="text-xs text-purple-700 mb-4">You can take ownership of this requested topic and conduct the training session.</p>
                  <button 
                    onClick={takeOwnership} 
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
                    Take Ownership
                  </button>
                </div>
              )}

              {/* Trainer Scheduling Form */}
              {user?.id === selectedRequest.trainer_id && selectedRequest.status !== 'completed' && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Trainer: Schedule Session</h4>
                  <form onSubmit={submitTrainerSchedule} className="bg-[#090f1d]/75 backdrop-blur-md rounded-xl border border-blue-500/20 p-5 shadow-sm space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
                        <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Duration</label>
                        <input type="text" placeholder="e.g. 1.5 hours" value={trainingDuration} onChange={(e) => setTrainingDuration(e.target.value)} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                        <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                        <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Mode</label>
                      <select value={trainingMode} onChange={(e) => setTrainingMode(e.target.value as 'online'|'offline')} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500">
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">{trainingMode === 'online' ? 'Meeting Link' : 'Location'}</label>
                      <input type="text" required placeholder={trainingMode === 'online' ? 'https://meet.google.com/...' : 'Room 101'} value={trainerLocation} onChange={(e) => setTrainerLocation(e.target.value)} className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      Schedule & Notify
                    </button>
                  </form>
                </div>
              )}

              {/* Management Form (Only for Manager/Admin) */}
              {isManagerOrAdmin && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Manager Actions</h4>
                  <form onSubmit={submitManageRequest} className="bg-[#090f1d]/75 backdrop-blur-md rounded-xl border border-blue-500/20 p-5 shadow-sm space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Status Override</label>
                      <select 
                        value={manageStatus}
                        onChange={(e) => setManageStatus(e.target.value as any)}
                        className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="requested">Requested</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Manager Remarks</label>
                      <textarea 
                        value={managerRemarks}
                        onChange={(e) => setManagerRemarks(e.target.value)}
                        className="w-full bg-transparent border border-blue-500/20 text-[#F8FAFC] text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        placeholder="Provide internal feedback..."
                      />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Request
                    </button>
                    <button type="button" onClick={async () => {
                      if (confirm('Are you sure you want to delete this request?')) {
                        await supabase.from('training_requests').delete().eq('id', selectedRequest.id);
                        setIsDrawerOpen(false);
                        mutate();
                      }
                    }} className="w-full bg-red-500/10 text-red-400 font-bold text-sm py-2 rounded-lg hover:bg-red-500/20 transition-colors mt-2">
                      Delete Request
                    </button>
                  </form>
                </div>
              )}
              {/* View Only Remarks for Employees */}
              {!isManagerOrAdmin && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Scheduling & Remarks</h4>
                  <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-xl border border-blue-500/20 p-5 shadow-sm space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400 text-xs font-semibold mb-1">Scheduled Date</p>
                        <p className="text-[#F8FAFC]">{selectedRequest.scheduled_date ? new Date(selectedRequest.scheduled_date).toLocaleDateString() : 'Pending'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs font-semibold mb-1">Trainer</p>
                        <p className="text-[#F8FAFC]">{selectedRequest.trainer?.name || selectedRequest.trainer_name || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold mb-1">Manager Remarks</p>
                      <div className="bg-transparent p-3 rounded-lg border border-blue-500/10 text-slate-300 min-h-[60px]">
                        {selectedRequest.manager_remarks || 'No remarks provided yet.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {isNewRequestModalOpen && !isManagerOrAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-blue-500/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F8FAFC]">New Training Request</h2>
              <button onClick={() => setIsNewRequestModalOpen(false)} className="text-slate-400 hover:bg-[#1A2333] p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={submitNewRequest} className="p-6 overflow-y-auto space-y-5 bg-transparent/30">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Topic *</label>
                <input 
                  type="text" 
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="e.g. Advanced TypeScript"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description / Purpose *</label>
                <textarea 
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm min-h-[100px]"
                  placeholder="Why is this training needed?"
                />
              </div>

              

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Remarks</label>
                <textarea 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm min-h-[80px]"
                  placeholder="Additional comments..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsNewRequestModalOpen(false)} className="px-5 py-2.5 text-slate-300 bg-[#090f1d]/75 backdrop-blur-md border border-blue-500/20 hover:bg-transparent rounded-xl font-medium transition-colors shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* New Plan Training Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#090f1d]/75 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-blue-500/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Plan a Training Session
              </h2>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-slate-400 hover:bg-[#1A2333] p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={submitPlanRequest} className="p-6 overflow-y-auto space-y-5 bg-transparent/30">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800 flex gap-3">
                <CheckCircle className="w-5 h-5 shrink-0 text-purple-600" />
                <p>This will schedule a new training and automatically notify <strong>all employees</strong>. No manager approval is required.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Topic *</label>
                <input 
                  type="text" 
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="e.g. Advanced React Patterns"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description / Agenda *</label>
                <textarea 
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm min-h-[100px]"
                  placeholder="What will you cover?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Date *</label>
                  <input 
                    type="date" 
                    required
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Trainer Name *</label>
                  <input 
                    type="text" 
                    required
                    value={planTrainer}
                    onChange={(e) => setPlanTrainer(e.target.value)}
                    className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    placeholder="Who is leading this?"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Start Time *</label>
                  <input 
                    type="time" 
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">End Time *</label>
                  <input 
                    type="time" 
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Location / Meeting Link *</label>
                <input 
                  type="text" 
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border-blue-500/20 rounded-xl p-2.5 border bg-[#090f1d]/75 backdrop-blur-md text-[#F8FAFC] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="e.g. Conference Room A or Google Meet URL"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-blue-500/20">
                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="px-5 py-2.5 text-slate-300 bg-[#090f1d]/75 backdrop-blur-md border border-blue-500/20 hover:bg-transparent rounded-xl font-medium transition-colors shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Schedule & Notify All
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
