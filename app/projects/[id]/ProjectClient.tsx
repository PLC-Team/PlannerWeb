'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { replacePunchPoints, renameProjectLine, addProjectLine, deleteProjectLine } from '@/app/actions/projects';
import { Project, User, Task, TaskComment, Achievement, Issue, ActivityLog, PunchPoint } from '@/types';
import { 
  Folder, ArrowLeft, ArrowRight, Loader2, Plus, Users, Award, 
  AlertTriangle, FileText, CheckCircle, HelpCircle, 
  MessageSquare, Calendar, ChevronDown, ChevronUp, Download,
  Send, Sparkles, AlertOctagon, Info, BarChart2, Trash2, Activity,
  Upload, Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  LineChart, Line 
} from 'recharts';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';

const STAGE_ORDER = [
  'Project Data Collection',
  'Offline Development',
  'DAPs',
  'Virtual Commissioning',
  'Onsite Commissioning',
  'Data Handover',
  'Production Support'
];

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const parseCustomDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  // Try normal parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try parsing DD/MM/YYYY or DD-MM-YYYY format, ignoring time parts
  const parts = dateStr.trim().split(/[\s,T]+/)[0].split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    
    // Check validity
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
      const custom = new Date(year, month, day);
      if (!isNaN(custom.getTime())) return custom;
    }
  }
  return null;
};

const parseSafeDate = (dStr: string) => {
  if (!dStr) return new Date();
  const d = new Date(dStr);
  if (!isNaN(d.getTime())) return d;
  
  try {
    const [datePart, timePart] = dStr.split(', ');
    if (datePart) {
      const parts = datePart.split('/');
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (month > 11) {
           month = parseInt(parts[0], 10) - 1;
           day = parseInt(parts[1], 10);
        }
        const parsedD = new Date(year, month, day);
        if (!isNaN(parsedD.getTime())) return parsedD;
      }
    }
  } catch (e) {}
  return new Date();
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const projectId = params.id as string;

  // --- DATABASE STATES ---
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Record<string, TaskComment[]>>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  // Members & Users list
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [myTeamMemberIds, setMyTeamMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // --- PROJECT STAGES STATES ---
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [isUpdateStageOpen, setIsUpdateStageOpen] = useState(false);
  const [selectedStageToUpdate, setSelectedStageToUpdate] = useState<any | null>(null);
  const [stageUpdateLoading, setStageUpdateLoading] = useState(false);
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [isRenameLineOpen, setIsRenameLineOpen] = useState(false);
  const [oldLineToRename, setOldLineToRename] = useState('');
  const [newRenameLineName, setNewRenameLineName] = useState('');
  const [isDeleteLineOpen, setIsDeleteLineOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- PAGINATION STATE ---
  const [logsPage, setLogsPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);

  // --- TABS STATE ---
  const [activeTab, setActiveTab] = useState<string>('overview');

  // --- TIMELINE DRAG-TO-SCROLL STATE ---
  const [activeTimelineTab, setActiveTimelineTab] = useState<string>('');
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (!timelineScrollRef.current) return;
    setIsDraggingTimeline(true);
    setStartX(e.pageX - timelineScrollRef.current.offsetLeft);
    setScrollLeft(timelineScrollRef.current.scrollLeft);
  };
  const handleTimelineMouseLeave = () => {
    setIsDraggingTimeline(false);
  };
  const handleTimelineMouseUp = () => {
    setIsDraggingTimeline(false);
  };
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTimeline || !timelineScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - timelineScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; 
    timelineScrollRef.current.scrollLeft = scrollLeft - walk;
  };
  const handleTimelineWheel = (e: React.WheelEvent) => {
    if (e.shiftKey && timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // --- FLOW DRAG STATE ---
  const flowScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingFlow, setIsDraggingFlow] = useState(false);
  const [flowStartX, setFlowStartX] = useState(0);
  const [flowScrollLeft, setFlowScrollLeft] = useState(0);

  const handleFlowMouseDown = (e: React.MouseEvent) => {
    if (!flowScrollRef.current) return;
    setIsDraggingFlow(true);
    setFlowStartX(e.pageX - flowScrollRef.current.offsetLeft);
    setFlowScrollLeft(flowScrollRef.current.scrollLeft);
  };
  const handleFlowMouseLeave = () => setIsDraggingFlow(false);
  const handleFlowMouseUp = () => setIsDraggingFlow(false);
  const handleFlowMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingFlow || !flowScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - flowScrollRef.current.offsetLeft;
    const walk = (x - flowStartX) * 1.5; 
    flowScrollRef.current.scrollLeft = flowScrollLeft - walk;
  };
  const handleFlowWheel = (e: React.WheelEvent) => {
    if (e.shiftKey && flowScrollRef.current) {
      flowScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // --- TASK STATE ---
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newTaskComment, setNewTaskComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [delegateMemberId, setDelegateMemberId] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);

  // Task Filter states
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all');

  // Modals & Submissions Loading
  const [isAssignMemberOpen, setIsAssignMemberOpen] = useState(false);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [isRaiseIssueOpen, setIsRaiseIssueOpen] = useState(false);
  const [isResolveIssueOpen, setIsResolveIssueOpen] = useState(false);

  // Members selection
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [isEditingTeamLeader, setIsEditingTeamLeader] = useState(false);

  // Task assignment form (TL direct to project members)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '', // filtered by project members
    priority: 'medium' as any,
    start_date: '',
    target_date: '',
    remarks: '',
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  // Achievement form
  const [achievementForm, setAchievementForm] = useState({
    title: '',
    details: '',
    attachment_url: '',
  });
  const [achievementFormLoading, setAchievementFormLoading] = useState(false);

  // Timeline Add Activity form
  const [timelineAddForm, setTimelineAddForm] = useState({
    stageName: '',
    taskName: '',
    startDate: '',
    targetDate: ''
  });
  // Issue form
  const [targetDateChangePrompt, setTargetDateChangePrompt] = useState<{
    isOpen: boolean;
    taskIndex: number;
    spIndex: number | null;
    oldDate: string;
    newDate: string;
    reason: string;
  } | null>(null);
  const [issueForm, setIssueForm] = useState({
    title: '',
    description: '',
    category: 'technical' as any,
    priority: 'medium' as any,
    attachment_url: '',
    reported_by_name: '',
    plant: '',
    line: '',
    station: '',
    occurrence_date: '',
    responsible_person_id: '',
    occurrence_condition: '',
    temporary_action: '',
    permanent_countermeasure: '',
  });
  const [issueFormLoading, setIssueFormLoading] = useState(false);

  // Issue resolution form
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolvingLoading, setResolvingLoading] = useState(false);

  // Task execution form (TM updates)
  const [taskProgress, setTaskProgress] = useState<Record<string, number>>({});
  const [taskRemarks, setTaskRemarks] = useState<Record<string, string>>({});
  const [updatingTaskProgress, setUpdatingTaskProgress] = useState<Record<string, boolean>>({});

  // Manager achievements review remarks
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [selectedAchievementId, setSelectedAchievementId] = useState<string | null>(null);

  // Sub-tasks modal states for Kickoff and Data Collection stages
  const [selectedStageForSubTasks, setSelectedStageForSubTasks] = useState<any | null>(null);
  const [subTasksData, setSubTasksData] = useState<any | null>(null);
  const [isSubTasksModalOpen, setIsSubTasksModalOpen] = useState(false);
  const [subTaskInput, setSubTaskInput] = useState('');
  const [newSubPointInputs, setNewSubPointInputs] = useState<Record<number, string>>({});
  const [subTaskSaveLoading, setSubTaskSaveLoading] = useState(false);
  const [isTaskLogsOpen, setIsTaskLogsOpen] = useState(false);
  const [selectedTaskIndexForLogs, setSelectedTaskIndexForLogs] = useState<number | null>(null);
  const [isOverallStatusOpen, setIsOverallStatusOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});
  const [isAddSubItemModalOpen, setIsAddSubItemModalOpen] = useState(false);
  const [selectedTaskIndexForAddSubPoint, setSelectedTaskIndexForAddSubPoint] = useState<number | null>(null);
  const [newSubItemData, setNewSubItemData] = useState({ name: '', targetDate: '' });

  // Revision Modal states
  const [isAddRevisionModalOpen, setIsAddRevisionModalOpen] = useState(false);
  const [selectedTaskIndexForRevision, setSelectedTaskIndexForRevision] = useState<number | null>(null);
  const [selectedSubTaskIndexForRevision, setSelectedSubTaskIndexForRevision] = useState<number | null>(null);
  const [newRevisionData, setNewRevisionData] = useState({ revisionNumber: '', dateReceived: '', remarks: '' });
  const [expandedHistoryTasks, setExpandedHistoryTasks] = useState<Record<string, boolean>>({});
  const [historyFilters, setHistoryFilters] = useState<Record<string, string>>({});

  // --- PUNCH POINTS STATES ---
  const [punchPoints, setPunchPoints] = useState<PunchPoint[]>([]);
  const [punchPointsLoading, setPunchPointsLoading] = useState(false);
  const [isPunchPointModalOpen, setIsPunchPointModalOpen] = useState(false);
  const [punchPointFormData, setPunchPointFormData] = useState<Partial<PunchPoint>>({ status: 'Open' });
  const [punchPointFilters, setPunchPointFilters] = useState({
    line: '',
    status: '',
    issue_raised_date: '',
    target_date: '',
    closed_by: ''
  });
  const [isImportPunchPointsLoading, setIsImportPunchPointsLoading] = useState(false);
  const punchPointsFileInputRef = useRef<HTMLInputElement>(null);

  const fetchPunchPoints = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('punch_points')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPunchPoints(data || []);
    } catch (err) {
      console.error('Error fetching punch points:', err);
    } finally {
      setPunchPointsLoading(false);
    }
  };

  const fetchProjectDetails = async () => {
    if (!projectId || !user) return;
    try {
      // 1-9. Fetch Everything in Parallel
      const [
        projRes,
        tasksRes,
        achRes,
        issRes,
        logsRes,
        pmRes,
        usersRes,
        stagesRes
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('achievements').select('*').eq('project_id', projectId).order('submitted_at', { ascending: false }),
        supabase.from('issues').select('*').eq('project_id', projectId).order('raised_at', { ascending: false }),
        supabase.from('activity_logs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
        supabase.from('project_members').select('team_member_id').eq('project_id', projectId),
        supabase.from('users').select('*'),
        supabase.from('project_stages').select('*').eq('project_id', projectId)
      ]);

      if (projRes.error) throw projRes.error;
      setProject(projRes.data);

      if (tasksRes.error) throw tasksRes.error;
      setTasks(tasksRes.data || []);

      if (achRes.error) throw achRes.error;
      setAchievements(achRes.data || []);

      if (issRes.error) throw issRes.error;
      setIssues(issRes.data || []);

      if (logsRes.error) throw logsRes.error;
      setLogs(logsRes.data || []);

      if (pmRes.error) throw pmRes.error;
      if (usersRes.error) throw usersRes.error;
      setAllUsers(usersRes.data || []);

      const membersList = (usersRes.data || []).filter((u: any) => 
        (pmRes.data || []).some((pm: any) => pm.team_member_id === u.id)
      );
      setProjectMembers(membersList);

      // Dependent Fetches (Comments depends on tasks, Hierarchy depends on user role)
      let commentsPromise = Promise.resolve(null as any);
      if (tasksRes.data && tasksRes.data.length > 0) {
        commentsPromise = supabase
          .from('task_comments')
          .select('*')
          .in('task_id', tasksRes.data.map((t: any) => t.id))
          .order('created_at', { ascending: true });
      }

      let hierarchyPromise = Promise.resolve(null as any);
      if (user?.role === 'team_leader') {
        hierarchyPromise = supabase
          .from('hierarchy')
          .select('team_member_id')
          .eq('team_leader_id', user.id);
      }

      const [commentsRes, hierarchyRes] = await Promise.all([
        commentsPromise,
        hierarchyPromise,
        fetchPunchPoints() // fetchPunchPoints sets state independently
      ]);

      if (commentsRes && !commentsRes.error) {
        const commMap: Record<string, TaskComment[]> = {};
        (commentsRes.data || []).forEach((c: any) => {
          if (!commMap[c.task_id]) commMap[c.task_id] = [];
          commMap[c.task_id].push(c);
        });
        setComments(commMap);
      }

      if (hierarchyRes && !hierarchyRes.error) {
        const memberIds = (hierarchyRes.data || [])
          .map((h: any) => h.team_member_id)
          .filter(Boolean);
        setMyTeamMemberIds(memberIds);
      }

      // Process Stages
      if (stagesRes.error) throw stagesRes.error;
      const getStageInfo = (name: string) => {
        let linePrefix = 'Main Line';
        let baseStage = name;
        if (name.includes(' - ')) {
          const parts = name.split(' - ');
          linePrefix = parts[0];
          baseStage = parts.slice(1).join(' - ');
        }
        return { linePrefix, baseStage };
      };

      const sortedStages = (stagesRes.data || []).sort((a: any, b: any) => {
         const aInfo = getStageInfo(a.stage_name);
         const bInfo = getStageInfo(b.stage_name);
         
         if (aInfo.linePrefix !== bInfo.linePrefix) {
            if (aInfo.linePrefix === 'Main Line') return -1;
            if (bInfo.linePrefix === 'Main Line') return 1;
            const aNumMatch = aInfo.linePrefix.match(/\d+/);
            const bNumMatch = bInfo.linePrefix.match(/\d+/);
            if (aNumMatch && bNumMatch) {
               return parseInt(aNumMatch[0]) - parseInt(bNumMatch[0]);
            }
            return aInfo.linePrefix.localeCompare(bInfo.linePrefix);
         }
         
         return STAGE_ORDER.indexOf(aInfo.baseStage) - STAGE_ORDER.indexOf(bInfo.baseStage);
      });
      setProjectStages(sortedStages);

    } catch (err) {
      console.error('Error fetching project detail page:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreLogs = async () => {
    if (!hasMoreLogs || loadingMoreLogs || !projectId) return;
    setLoadingMoreLogs(true);
    try {
      const nextPage = logsPage + 1;
      const { data: newLogs, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .range(nextPage * 20, (nextPage + 1) * 20 - 1);
        
      if (error) throw error;
      
      if (newLogs && newLogs.length > 0) {
        setLogs(prev => [...prev, ...newLogs]);
        setLogsPage(nextPage);
        if (newLogs.length < 20) setHasMoreLogs(false);
      } else {
        setHasMoreLogs(false);
      }
    } catch (err) {
      console.error('Error fetching more logs:', err);
    } finally {
      setLoadingMoreLogs(false);
    }
  };

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && activeTab === 'logs') {
          fetchMoreLogs();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasMoreLogs, loadingMoreLogs, logsPage, activeTab, projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId, user?.id]);

  useEffect(() => {
    if (user) {
      const tabParam = searchParams.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab(user.role === 'team_member' ? 'my-tasks' : 'overview');
      }
    }
  }, [user?.role, searchParams]);

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) {
        setSelectedTask(updated);
      }
    }
  }, [tasks, selectedTask]);

  const logActivity = async (action: string, details: any, taskId?: string) => {
    if (!user) return;
    
    // Optimistic log insertion
    const tempId = `temp-${Date.now()}`;
    const optimisticLog = {
      id: tempId,
      created_at: new Date().toISOString(),
      action,
      details,
      user_id: user.id,
      task_id: taskId || null,
      project_id: projectId
    };
    
    setLogs(prev => [optimisticLog as ActivityLog, ...prev]);

    try {
      const { data, error } = await supabase.from('activity_logs').insert({
        project_id: projectId,
        task_id: taskId || null,
        user_id: user.id,
        action,
        details,
      }).select().single();
      
      if (error) {
        console.error('Supabase error writing activity log:', error);
        setLogs(prev => prev.filter(l => l.id !== tempId)); // Rollback
        alert(`Log Error (${action}): ` + error.message);
      } else {
        // Swap temp with real log
        setLogs(prev => prev.map(l => l.id === tempId ? data as ActivityLog : l));
      }
      // fetchProjectDetails() has been completely removed to prevent massive dashboard reloads
    } catch (err: any) {
      console.error('Error writing activity log:', err);
      setLogs(prev => prev.filter(l => l.id !== tempId)); // Rollback
      alert(`Log Exception (${action}): ` + err.message);
    }
  };

  const getRoleColorClass = (roleStr: string) => {
    switch (roleStr) {
      case 'admin': return 'bg-red-500/10 text-red-400 border border-red-500/20 font-mono tracking-wider';
      case 'manager': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono tracking-wider';
      case 'team_leader': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono tracking-wider';
      case 'team_member': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono tracking-wider';
      default: return 'bg-gray-500/10 text-gray-400 font-mono';
    }
  };

  const getUserName = (id: string | null) => {
    if (!id) return '-';
    return allUsers.find(u => u.id === id)?.name || 'Unknown User';
  };

  const getUserDesignation = (id: string | null) => {
    if (!id) return '';
    const designation = allUsers.find(u => u.id === id)?.designation;
    return designation && designation !== 'Specialist' ? designation : '';
  };

  const getStatusColorClass = (statusStr: string) => {
    switch (statusStr) {
      case 'pending': return 'bg-slate-800/35 text-gray-400 border border-white/5 font-mono tracking-wider';
      case 'assigned': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(99,102,241,0.05)]';
      case 'in_progress': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.05)] animate-pulse-slow';
      case 'completed_by_member': return 'bg-amber-500/10 text-amber-400 border border-amber-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.05)]';
      case 'approved_by_tl': return 'bg-violet-500/10 text-violet-400 border border-violet-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.05)]';
      case 'approved_by_manager': return 'bg-sky-500/10 text-sky-400 border border-sky-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(14,165,233,0.05)]';
      case 'rejected': return 'bg-red-500/10 text-red-400 border border-red-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.05)]';
      case 'rework_required': return 'bg-orange-500/10 text-orange-400 border border-orange-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(249,115,22,0.05)]';
      case 'closed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-mono tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.05)]';
      default: return 'bg-gray-500/10 text-gray-400 font-mono';
    }
  };

  const getPriorityColorClass = (priorityStr: string) => {
    switch (priorityStr) {
      case 'low': return 'bg-slate-500/10 text-gray-400 border border-slate-500/20 font-mono tracking-wider';
      case 'medium': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono tracking-wider';
      case 'high': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono tracking-wider';
      case 'critical': return 'bg-red-500/10 text-red-400 border border-red-500/25 font-mono tracking-wider shadow-[0_0_8px_rgba(239,68,68,0.1)]';
      default: return 'bg-slate-500/10 text-gray-400 font-mono';
    }
  };

  const getGridPositionClass = (idx: number) => {
    switch (idx) {
      case 0: return 'md:col-start-1 md:row-start-1 lg:col-start-1 lg:row-start-1';
      case 1: return 'md:col-start-2 md:row-start-1 lg:col-start-2 lg:row-start-1';
      case 2: return 'md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1';
      case 3: return 'md:col-start-1 md:row-start-2 lg:col-start-4 lg:row-start-1';
      case 4: return 'md:col-start-1 md:row-start-3 lg:col-start-4 lg:row-start-2';
      case 5: return 'md:col-start-2 md:row-start-3 lg:col-start-3 lg:row-start-2';
      case 6: return 'md:col-start-2 md:row-start-4 lg:col-start-2 lg:row-start-2';
      case 7: return 'md:col-start-1 md:row-start-4 lg:col-start-1 lg:row-start-2';
      default: return '';
    }
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'in_progress':
        return <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderArrows = (idx: number, status: string) => {
    const statusColor = 
      status === 'completed'
        ? 'text-emerald-500'
        : status === 'in_progress'
        ? 'text-blue-500 animate-pulse'
        : 'text-white/10';

    return (
      <>
        {/* --- MOBILE (sm) ARROW: always down except last stage --- */}
        {idx < 7 && (
          <div className={`absolute top-full left-1/2 -translate-x-1/2 h-12 w-6 flex flex-col items-center justify-center pointer-events-none z-20 md:hidden ${statusColor}`}>
            <div className="w-[2px] h-full bg-current" />
            <div className="w-0 h-0 border-t-[6px] border-t-current border-x-[4px] border-x-transparent" />
          </div>
        )}

        {/* --- TABLET (md) ARROWS --- */}
        {idx < 7 && (
          <div className="hidden md:flex lg:hidden pointer-events-none z-20">
            {/* Arrow Right for indices 0, 4 */}
            {(idx === 0 || idx === 4) && (
              <div className={`absolute left-full top-1/2 -translate-y-1/2 w-12 flex items-center ${statusColor}`}>
                <div className="h-[2px] w-full bg-current" />
                <div className="w-0 h-0 border-l-[6px] border-l-current border-y-[4px] border-y-transparent" />
              </div>
            )}
            {/* Arrow Down for indices 1, 3, 5 */}
            {(idx === 1 || idx === 3 || idx === 5) && (
              <div className={`absolute top-full left-1/2 -translate-x-1/2 h-16 w-6 flex flex-col items-center justify-center ${statusColor}`}>
                <div className="w-[2px] h-full bg-current" />
                <div className="w-0 h-0 border-t-[6px] border-t-current border-x-[4px] border-x-transparent" />
              </div>
            )}
            {/* Arrow Left for indices 2, 6 */}
            {(idx === 2 || idx === 6) && (
              <div className={`absolute right-full top-1/2 -translate-y-1/2 w-12 flex items-center flex-row-reverse ${statusColor}`}>
                <div className="h-[2px] w-full bg-current" />
                <div className="w-0 h-0 border-r-[6px] border-r-current border-y-[4px] border-y-transparent" />
              </div>
            )}
          </div>
        )}

        {/* --- DESKTOP (lg) ARROWS --- */}
        {idx < 7 && (
          <div className="hidden lg:flex pointer-events-none z-20">
            {/* Arrow Right for indices 0, 1, 2 */}
            {(idx === 0 || idx === 1 || idx === 2) && (
              <div className={`absolute left-full top-1/2 -translate-y-1/2 w-12 flex items-center ${statusColor}`}>
                <div className="h-[2px] w-full bg-current" />
                <div className="w-0 h-0 border-l-[6px] border-l-current border-y-[4px] border-y-transparent" />
              </div>
            )}
            {/* Arrow Down for index 3 */}
            {idx === 3 && (
              <div className={`absolute top-full left-1/2 -translate-x-1/2 h-16 w-6 flex flex-col items-center justify-center ${statusColor}`}>
                <div className="w-[2px] h-full bg-current" />
                <div className="w-0 h-0 border-t-[6px] border-t-current border-x-[4px] border-x-transparent" />
              </div>
            )}
            {/* Arrow Left for indices 4, 5, 6 */}
            {(idx === 4 || idx === 5 || idx === 6) && (
              <div className={`absolute right-full top-1/2 -translate-y-1/2 w-12 flex items-center flex-row-reverse ${statusColor}`}>
                <div className="h-[2px] w-full bg-current" />
                <div className="w-0 h-0 border-r-[6px] border-r-current border-y-[4px] border-y-transparent" />
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // Project Status Actions (Complete / Reopen)
  const handleUpdateProjectStatus = async (newStatus: 'completed' | 'active') => {
    if (!project) return;
    const actionText = newStatus === 'completed' ? 'Project Completed' : 'Project Reopened';
    if (!confirm(`Are you sure you want to change the project status to ${newStatus === 'completed' ? 'Completed' : 'Running'}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
        
      if (error) throw error;
      
      await logActivity(actionText, { project_name: project.project_name, project_code: project.project_code });
      
      // Update local state
      setProject({ ...project, status: newStatus });
      alert(`Project successfully ${newStatus === 'completed' ? 'marked as completed' : 'reopened'}.`);
    } catch (err: any) {
      alert(err.message || 'Error updating project status.');
    }
  };

  // Manager updates Team Leader
  const handleUpdateTeamLeader = async (newLeaderId: string) => {
    if (!project) return;
    try {
      const { error } = await supabase
        .from('projects')
        .update({ assigned_team_leader_id: newLeaderId || null })
        .eq('id', project.id);
        
      if (error) throw error;
      
      await logActivity(`Project Team Leader reassigned`, { project_name: project.project_name, new_leader_id: newLeaderId });
      
      setProject({ ...project, assigned_team_leader_id: newLeaderId || null });
      setIsEditingTeamLeader(false);
      alert('Team Leader successfully updated.');
    } catch (err: any) {
      alert(err.message || 'Error updating team leader.');
    }
  };

  // --- ACTIONS ---

  // TL Assigns Member to Project
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setMemberLoading(true);

    try {
      // Optimistic Update
      const assignedUser = allUsers.find(u => u.id === selectedMemberId);
      if (assignedUser) {
        setProjectMembers(prev => [...prev, assignedUser]);
      }

      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          team_member_id: selectedMemberId,
          assigned_by: user?.id,
        });

      if (error) throw error;

      await logActivity('Team Member Assigned', { 
        assigned_user: getUserName(selectedMemberId) 
      });

      setIsAssignMemberOpen(false);
      setSelectedMemberId('');
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error assigning project member.');
    } finally {
      setMemberLoading(false);
    }
  };

  // TL Assigns Task to Member (Direct TL tasks)
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskFormLoading(true);

    const { title, description, assigned_to, priority, start_date, target_date, remarks } = taskForm;

    if (!title || !assigned_to || !priority || !start_date || !target_date) {
      alert('Please fill in title, assigned member, priority, start date, and target date.');
      setTaskFormLoading(false);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      id: tempId,
      project_id: projectId,
      project_code: project?.project_code || '',
      project_name: project?.project_name || '',
      title,
      description,
      assigned_by: user?.id,
      assigned_to,
      assigned_by_role: (role === 'manager') ? 'manager' : 'team_leader',
      priority,
      start_date,
      target_date,
      remarks,
      status: 'assigned',
      progress_percent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachment_url: '',
    } as Task;

    // Optimistically update UI
    setTasks(prev => [optimisticTask, ...prev]);
    setIsAssignTaskOpen(false);
    setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', start_date: '', target_date: '', remarks: '' });

    try {
      const { data: taskData, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          project_code: project?.project_code || '',
          project_name: project?.project_name || '',
          title,
          description,
          assigned_by: user?.id,
          assigned_to,
          assigned_by_role: (role === 'manager') ? 'manager' : 'team_leader',
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

      // Swap temp task with real task
      setTasks(prev => prev.map(t => t.id === tempId ? taskData : t));

      // Notify TM/TL
      await supabase.from('notifications').insert({
        user_id: assigned_to,
        title: (role === 'manager') ? 'New Manager-Assigned Task' : 'New Team Leader Task Assigned',
        message: (role === 'manager')
          ? `Manager assigned task "${title}" to you for project ${project?.project_name || ''}.`
          : `Your TL assigned task "${title}" to you for project ${project?.project_name || ''}.`,
        related_task_id: taskData.id,
        related_project_id: projectId,
      });

      await logActivity(
        (role === 'manager') ? 'Task Assigned to TL' : 'Task Assigned to Member',
        { title, assigned_to: getUserName(assigned_to) },
        taskData.id
      );

      // We no longer call fetchProjectDetails() to prevent the 9-query waterfall
    } catch (err: any) {
      console.error('Error assigning task:', err.message);
      // Rollback optimistic update
      setTasks(prev => prev.filter(t => t.id !== tempId));
      alert('Failed to assign task. Rolling back.');
    } finally {
      setTaskFormLoading(false);
    }
  };

  // TM Updates task status/slider progress
  const handleUpdateTaskStatus = async (taskId: string, isCompleteAction = false) => {
    const progressVal = taskProgress[taskId];
    const remarksVal = taskRemarks[taskId] || '';
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    setUpdatingTaskProgress(prev => ({ ...prev, [taskId]: true }));

    // Determine new status:
    // If complete button was clicked, status goes to 'completed_by_member' and progress = 100
    // Else if status is currently pending or assigned and progress is updating, it becomes 'in_progress'
    let newStatus = currentTask.status;
    let finalProgress = progressVal !== undefined ? progressVal : currentTask.progress_percent;

    if (isCompleteAction) {
      newStatus = 'completed_by_member';
      finalProgress = 100;
    } else if (finalProgress > 0 && finalProgress < 100 && (currentTask.status === 'pending' || currentTask.status === 'assigned')) {
      newStatus = 'in_progress';
    }

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        progress_percent: finalProgress, 
        status: newStatus, 
        remarks: remarksVal || currentTask.remarks, 
        updated_at: new Date().toISOString() 
      } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          progress_percent: finalProgress,
          status: newStatus,
          remarks: remarksVal || currentTask.remarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity('Task Updated by Member', { 
        title: currentTask.title,
        progress_percent: finalProgress,
        status: newStatus,
        remarks: remarksVal
      }, taskId);

      if (isCompleteAction) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        
        // Notify TL that member completed it
        if (project?.assigned_team_leader_id) {
          await supabase.from('notifications').insert({
            user_id: project.assigned_team_leader_id,
            title: 'Task Marked Complete',
            message: `Team Member marked task "${currentTask.title}" as completed. Pending your review.`,
            related_task_id: taskId,
            related_project_id: projectId,
          });
        }
      }

      // We no longer call fetchProjectDetails() to prevent massive reloads
    } catch (err: any) {
      // Rollback
      fetchProjectDetails();
      alert(err.message || 'Error updating task.');
    } finally {
      setUpdatingTaskProgress(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleStartTask = async (taskId: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress', updated_at: new Date().toISOString() } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity('Task Started by Member', {
        title: currentTask.title
      }, taskId);

      alert('Task is now in progress.');
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error starting task.');
    }
  };

  const handleTLMarkCompleted = async (taskId: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'approved_by_tl', 
        progress_percent: 100, 
        updated_at: new Date().toISOString() 
      } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'approved_by_tl',
          progress_percent: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity('Task Completed by TL', {
        title: currentTask.title
      }, taskId);

      if (project?.created_by) {
        await supabase.from('notifications').insert({
          user_id: project.created_by,
          title: 'Task Completed by TL',
          message: `TL completed task "${currentTask.title}" and submitted for your approval.`,
          related_task_id: taskId,
          related_project_id: projectId,
        });
      }

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      alert('Task marked as completed.');
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error marking task as completed.');
    }
  };

  const handleDelegateTask = async (taskId: string, memberId: string) => {
    if (!memberId) return;
    setIsDelegating(true);
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        assigned_to: memberId, 
        status: 'assigned', 
        updated_at: new Date().toISOString() 
      } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          assigned_to: memberId,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity('Task Delegated by TL', {
        title: currentTask.title,
        delegated_to: getUserName(memberId)
      }, taskId);

      await supabase.from('notifications').insert({
        user_id: memberId,
        title: 'Task Assigned by TL',
        message: `Your TL delegated task "${currentTask.title}" to you for project ${project?.project_name || ''}.`,
        related_task_id: taskId,
        related_project_id: projectId,
      });

      setDelegateMemberId('');
      alert('Task successfully delegated.');
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error delegating task.');
    } finally {
      setIsDelegating(false);
    }
  };

  // TL Review Actions (Approve / Reject / Send Back for Rework)
  const handleTeamLeaderReview = async (taskId: string, action: 'approve' | 'reject' | 'rework') => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    let finalStatus: Task['status'] = 'approved_by_tl';

    if (action === 'approve') {
      finalStatus = currentTask.assigned_by_role === 'team_leader' ? 'closed' : 'approved_by_tl';
    } else if (action === 'reject') {
      finalStatus = 'rejected';
    } else if (action === 'rework') {
      finalStatus = 'rework_required';
    }

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: finalStatus, 
        updated_at: new Date().toISOString() 
      } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          status: finalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity(`Task Reviewed by TL (${action})`, { 
        title: currentTask.title,
        status: finalStatus
      }, taskId);

      // Notify TM
      if (currentTask.assigned_to) {
        await supabase.from('notifications').insert({
          user_id: currentTask.assigned_to,
          title: `Task Review: ${action.toUpperCase()}`,
          message: action === 'approve' && currentTask.assigned_by_role === 'team_leader'
            ? `Your TL has approved and closed your task "${currentTask.title}".`
            : `Your TL has marked your task "${currentTask.title}" as ${finalStatus.replace(/_/g, ' ')}.`,
          related_task_id: taskId,
          related_project_id: projectId,
        });
      }

      // Notify Manager if Workflow A approved and needs Manager review
      if (action === 'approve' && (currentTask.assigned_by_role === 'manager') && project?.created_by) {
        await supabase.from('notifications').insert({
          user_id: project.created_by,
          title: 'Pending Manager Approval',
          message: `TL approved task "${currentTask.title}". Requires final Manager closure.`,
          related_task_id: taskId,
          related_project_id: projectId,
        });
      }

      if (action === 'approve') {
        confetti({ particleCount: 80, spread: 80 });
      }

      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error processing TL review.');
    }
  };

  // Manager Review Actions on Workflow A (Approve / Reject / Rework)
  const handleManagerReview = async (taskId: string, action: 'approve' | 'reject' | 'rework') => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    let finalStatus: Task['status'] = 'closed';

    if (action === 'approve') {
      finalStatus = 'closed'; // Final approved closes the task
    } else if (action === 'reject') {
      finalStatus = 'rejected';
    } else if (action === 'rework') {
      finalStatus = 'rework_required';
    }

    try {
      // Optimistic Update
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: finalStatus, 
        updated_at: new Date().toISOString() 
      } : t));

      const { error } = await supabase
        .from('tasks')
        .update({
          status: finalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      await logActivity(`Task Reviewed by Manager (${action})`, { 
        title: currentTask.title,
        status: finalStatus
      }, taskId);

      // Notify TL and TM
      const notificationsToSend = [];
      if (currentTask.assigned_to) {
        notificationsToSend.push({
          user_id: currentTask.assigned_to,
          title: `Task Final Approval: ${action.toUpperCase()}`,
          message: `Manager has reviewed task "${currentTask.title}" as ${finalStatus}.`,
          related_task_id: taskId,
          related_project_id: projectId,
        });
      }
      if (project?.assigned_team_leader_id) {
        notificationsToSend.push({
          user_id: project.assigned_team_leader_id,
          title: `Task Final Approval: ${action.toUpperCase()}`,
          message: `Manager has reviewed task "${currentTask.title}" as ${finalStatus}.`,
          related_task_id: taskId,
          related_project_id: projectId,
        });
      }

      await supabase.from('notifications').insert(notificationsToSend);

      if (action === 'approve') {
        confetti({ particleCount: 100, spread: 90, colors: ['#60a5fa', '#34d399', '#f472b6'] });
      }

      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error processing Manager review.');
    }
  };

  const handleUpdateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageToUpdate) return;
    setStageUpdateLoading(true);

    const { id, stage_name, status, remarks } = selectedStageToUpdate;

    try {
      // Optimistic update
      setProjectStages(prev => prev.map(stage => {
        if (stage.id === id) {
          return {
            ...stage,
            status,
            remarks,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          };
        }
        return stage;
      }));

      const { data, error } = await supabase
        .from('project_stages')
        .update({
          status,
          remarks,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update failed. You may not have permission, or the record was not found.');
      }

      await logActivity('Project Stage Updated', {
        stage: stage_name,
        status,
        remarks
      });

      setIsUpdateStageOpen(false);
      setSelectedStageToUpdate(null);
      // No fetchProjectDetails() call
      alert('Project stage updated successfully.');
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error updating project stage.');
    } finally {
      setStageUpdateLoading(false);
    }
  };

  // Helper to parse stage remarks JSON with fallback to status-based structures
  const parseStageRemarks = (remarks: string | null, defaultTasks: string[] = []) => {
    try {
      if (remarks && (remarks.trim().startsWith('{') || remarks.trim().startsWith('['))) {
        const parsed = JSON.parse(remarks);
        if (parsed && parsed.subTasks) {
          // Map tasks to ensure status, targetDate, completedDate, completedBy are defined
          parsed.subTasks = parsed.subTasks.map((t: any) => {
            let status = t.status || (t.completed ? 'complete' : 'pending');
            const subPoints = (t.subPoints || []).map((sp: any) => {
              let spStatus = sp.status || (sp.completed ? 'complete' : 'pending');
              return {
                title: sp.title,
                status: spStatus,
                startDate: sp.startDate || '',
                targetDate: sp.targetDate || '',
                completedDate: sp.completedDate || '',
                completedBy: sp.completedBy || '',
                untickedBy: sp.untickedBy || '',
                untickedDate: sp.untickedDate || '',
                untickedReason: sp.untickedReason || '',
                delayReason: sp.delayReason || '',
                logs: sp.logs || [],
                revisions: sp.revisions || []
              };
            });
            return {
              title: t.title,
              status,
              startDate: t.startDate || '',
              targetDate: t.targetDate || '',
              completedDate: t.completedDate || '',
              completedBy: t.completedBy || '',
              untickedBy: t.untickedBy || '',
              untickedDate: t.untickedDate || '',
              untickedReason: t.untickedReason || '',
              delayReason: t.delayReason || '',
              logs: t.logs || [],
              revisions: t.revisions || [],
              subPoints
            };
          });
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error parsing stage remarks JSON:", e);
    }
    return {
      subTasks: defaultTasks.map(title => ({
        title,
        status: 'pending',
        startDate: '',
        targetDate: '',
        completedDate: '',
        completedBy: '',
        untickedBy: '',
        untickedDate: '',
        untickedReason: '',
        delayReason: '',
        logs: [],
        revisions: [],
        subPoints: []
      }))
    };
  };

  const isTaskDelayed = (targetDateStr: string | null | undefined, status: string | null | undefined) => {
    if (!targetDateStr) return false;
    if (status === 'complete' || status === 'not_applicable') return false;
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime() > target.getTime();
  };

  // Helper to calculate sub-tasks progress based on new status fields (complete/not_applicable count as complete)
  const getSubTasksProgress = (remarks: string | null, defaultCount: number) => {
    try {
      if (remarks && (remarks.trim().startsWith('{') || remarks.trim().startsWith('['))) {
        const data = JSON.parse(remarks);
        if (data && data.subTasks) {
          let total = 0;
          let completed = 0;
          let delayed = 0;
          data.subTasks.forEach((st: any) => {
            if (st.subPoints && st.subPoints.length > 0) {
              st.subPoints.forEach((sp: any) => {
                total++;
                if (sp.status === 'complete' || sp.status === 'not_applicable') completed++;
                if (isTaskDelayed(sp.targetDate, sp.status)) delayed++;
              });
            } else {
              total++;
              if (st.status === 'complete' || st.status === 'not_applicable') completed++;
              if (isTaskDelayed(st.targetDate, st.status)) delayed++;
            }
          });
          return { completed, total, delayed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
        }
      }
    } catch (e) {}
    return { completed: 0, total: defaultCount, delayed: 0, percent: 0 };
  };

  const handleOpenSubTasksModal = (stage: any) => {
    const isKickoff = stage.stage_name === 'Project Kickoff Meeting';
    const isDataCollection = stage.stage_name.endsWith('Project Data Collection');
    const defaultTasks = isKickoff 
      ? ['Internal Kickoff Meeting', 'Customer Kickoff Meeting']
      : isDataCollection
      ? [
          'Existing Line / Reference PLC and GOT Backup',
          'Existing Line Pattern Sheet',
          'Bit Mapping Sheet',
          'Existing Line Robot IO List / Standard Robot IO List',
          'Verify Existing Line Robot IO List with Logic and Share to Simulation',
          'Sequence Sheet',
          'JIG IO List',
          'GA Drawing / Images'
        ]
      : [];

    const parsed = parseStageRemarks(stage.remarks, defaultTasks);
    
    // Ensure all default tasks exist and JIG IO / Sequence / GA Drawing have subPoints
    const existingTitles = (parsed.subTasks || []).map((t: any) => t.title);
    defaultTasks.forEach(title => {
      if (!existingTitles.includes(title)) {
        if (!parsed.subTasks) parsed.subTasks = [];
        parsed.subTasks.push({
          title,
          status: 'pending',
          startDate: '',
          targetDate: '',
          actualStartDate: '',
          completedDate: '',
          completedBy: '',
          subPoints: []
        });
      }
    });

    parsed.subTasks = parsed.subTasks.map((t: any) => {
      const needsSubPoints = !isKickoff && [
        'Sequence Sheet',
        'JIG IO List',
        'GA Drawing / Images'
      ].includes(t.title);
      
      if (needsSubPoints && !t.subPoints) {
        return { ...t, subPoints: [] };
      }
      return t;
    });

    setSelectedStageForSubTasks(stage);
    setSubTasksData(parsed);
    setNewSubPointInputs({});
    setIsSubTasksModalOpen(true);
  };

  const handleToggleCheckPointStatus = (taskIndex: number, clickedStatus: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;

    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];

    let finalStatus = clickedStatus;

    if (finalStatus === 'in_progress') {
      if (!task.startDate || !task.targetDate) {
        if (window.confirm("Start Date and Target Date are missing.\n\nClick OK if you want to mark this activity as Not Applicable (N/A) instead.\nClick Cancel to go back and select the dates.")) {
          finalStatus = 'not_applicable';
        } else {
          return;
        }
      }
    }

    if (finalStatus === 'complete') {
      if (!task.startDate || !task.targetDate) {
        alert("Please select Start Date and Target Date before updating activity status to Complete.");
        return;
      }
    }

    if (finalStatus === 'complete' || finalStatus === 'not_applicable') {
      const isAllowed = user?.role === 'manager' || user?.role === 'team_leader' || user?.role === 'team_member';
      if (!isAllowed) {
        alert("Only Managers, Team Leaders and Team Members are allowed to mark tasks as completed or N/A.");
        return;
      }
      
      if (finalStatus === 'complete') {
        if (task.subPoints && task.subPoints.length > 0) {
          const allCompleted = task.subPoints.every((sp: any) => sp.status === 'complete' || sp.status === 'not_applicable');
          if (!allCompleted) {
            alert("All sub-points must be completed before marking the main task as Complete.");
            return;
          }
        }
      }
    }

    const currentStatus = task.status || 'pending';
    const isRemovingTick = finalStatus === 'pending' && currentStatus !== 'pending';
    const newStatus = finalStatus;

    let reason = '';
    if (isRemovingTick) {
      // Check DB state to see if reason is needed
      const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
      const initialTask = initialParsed?.subTasks ? initialParsed.subTasks[taskIndex] : null;
      const dbStatus = initialTask?.status || 'pending';
      if (dbStatus === 'complete' || dbStatus === 'not_applicable' || dbStatus === 'in_progress') {
        reason = window.prompt("Please enter a reason for reopening this activity:") || '';
        if (!reason.trim()) {
          alert("Reason is mandatory for reopening a saved activity.");
          return;
        }
      }
    }

    const userName = user?.name || getUserName(user?.id || null) || 'Unknown User';

    task.status = newStatus;
    if (newStatus === 'complete' || newStatus === 'not_applicable') {
      task.completed = true;
      task.completedDate = new Date().toLocaleString();
      task.completedBy = userName;
    } else {
      task.completed = false;
      task.completedDate = '';
      task.completedBy = '';
    }

    task.untickedBy = isRemovingTick && reason ? userName : '';
    task.untickedDate = isRemovingTick && reason ? new Date().toLocaleString() : '';
    task.untickedReason = isRemovingTick && reason ? reason.trim() : '';

    setSubTasksData(updated);
  };

  const handleToggleSubPointStatus = (taskIndex: number, spIndex: number, clickedStatus: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;

    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];
    const sp = task.subPoints[spIndex];

    let finalStatus = clickedStatus;

    if (finalStatus === 'in_progress') {
      if (!sp.targetDate) {
        if (window.confirm("Target Date is missing.\n\nClick OK if you want to mark this sub-point as Not Applicable (N/A) instead.\nClick Cancel to go back and select a Target Date.")) {
          finalStatus = 'not_applicable';
        } else {
          return;
        }
      }
    }

    if (finalStatus === 'complete') {
      if (!sp.targetDate) {
        alert("Please select a Target Date before updating activity status to Complete.");
        return;
      }
    }

    if (finalStatus === 'complete' || finalStatus === 'not_applicable') {
      const isAllowed = user?.role === 'manager' || user?.role === 'team_leader' || user?.role === 'team_member';
      if (!isAllowed) {
        alert("Only Managers, Team Leaders and Team Members are allowed to mark tasks as completed or N/A.");
        return;
      }
    }

    const currentStatus = sp.status || 'pending';
    const isRemovingTick = finalStatus === 'pending' && currentStatus !== 'pending';
    const newStatus = finalStatus;

    let reason = '';
    if (isRemovingTick) {
      // Check DB state to see if reason is needed
      const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
      const initialTask = initialParsed?.subTasks ? initialParsed.subTasks[taskIndex] : null;
      const initialSp = initialTask?.subPoints ? initialTask.subPoints[spIndex] : null;
      const dbStatus = initialSp?.status || 'pending';
      if (dbStatus === 'complete' || dbStatus === 'not_applicable' || dbStatus === 'in_progress') {
        reason = window.prompt("Please enter a reason for reopening this sub-point:") || '';
        if (!reason.trim()) {
          alert("Reason is mandatory for reopening a saved activity.");
          return;
        }
      }
    }

    const userName = user?.name || getUserName(user?.id || null) || 'Unknown User';

    sp.status = newStatus;
    if (newStatus === 'complete' || newStatus === 'not_applicable') {
      sp.completed = true;
      sp.completedDate = new Date().toLocaleString();
      sp.completedBy = userName;
    } else {
      sp.completed = false;
      sp.completedDate = '';
      sp.completedBy = '';
    }

    sp.untickedBy = isRemovingTick && reason ? userName : '';
    sp.untickedDate = isRemovingTick && reason ? new Date().toLocaleString() : '';
    sp.untickedReason = isRemovingTick && reason ? reason.trim() : '';

    const allDone = task.subPoints.every((s: any) => 
      s.status === 'complete' || s.status === 'not_applicable'
    );
    
    if (allDone) {
      task.status = 'complete';
      task.completed = true;
      task.completedDate = new Date().toLocaleString();
      task.completedBy = userName;
      task.untickedBy = '';
      task.untickedDate = '';
      task.untickedReason = '';
    } else {
      task.status = 'in_progress';
      task.completed = false;
      task.completedDate = '';
      task.completedBy = '';
    }
    
    setSubTasksData(updated);
  };

  const handleAddDelayReason = (taskIndex: number, spIndex: number = -1) => {
    const reason = window.prompt("Please enter the reason for delay:");
    if (!reason || !reason.trim()) return;

    const updated = { ...subTasksData };
    const userName = user?.name || getUserName(user?.id || null) || 'Unknown User';
    const nowStr = new Date().toLocaleString();

    if (spIndex === -1) {
      updated.subTasks[taskIndex].delayReason = reason.trim();
      if (!updated.subTasks[taskIndex].logs) updated.subTasks[taskIndex].logs = [];
      updated.subTasks[taskIndex].logs.unshift({
        status: "Delay Reason Added",
        date: nowStr,
        by: userName,
        remark: reason.trim()
      });
    } else {
      updated.subTasks[taskIndex].subPoints[spIndex].delayReason = reason.trim();
      if (!updated.subTasks[taskIndex].subPoints[spIndex].logs) updated.subTasks[taskIndex].subPoints[spIndex].logs = [];
      updated.subTasks[taskIndex].subPoints[spIndex].logs.unshift({
        status: "Delay Reason Added",
        date: nowStr,
        by: userName,
        remark: reason.trim()
      });
    }
    setSubTasksData(updated);
  };

  const handleUpdateCheckPointTargetDate = (taskIndex: number, dateVal: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;

    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];

    const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
    const initialTask = initialParsed?.subTasks ? initialParsed.subTasks[taskIndex] : null;
    const dbTargetDate = initialTask?.targetDate || '';

    if (!task.isNew && dbTargetDate && dbTargetDate !== dateVal) {
      task.targetDate = dateVal;
      setSubTasksData(updated);
      setTargetDateChangePrompt({
        isOpen: true,
        taskIndex,
        spIndex: null,
        oldDate: dbTargetDate,
        newDate: dateVal,
        reason: ''
      });
    } else {
      task.targetDateChangeReason = '';
      task.targetDate = dateVal;
      setSubTasksData(updated);
    }
  };

  const handleUpdateSubPointTargetDate = (taskIndex: number, spIndex: number, dateVal: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;

    const updated = { ...subTasksData };
    const sp = updated.subTasks[taskIndex].subPoints[spIndex];

    const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
    const initialTask = initialParsed?.subTasks ? initialParsed.subTasks[taskIndex] : null;
    const initialSp = initialTask?.subPoints ? initialTask.subPoints[spIndex] : null;
    const dbTargetDate = initialSp?.targetDate || '';

    if (!sp.isNew && dbTargetDate && dbTargetDate !== dateVal) {
      sp.targetDate = dateVal;
      setSubTasksData(updated);
      setTargetDateChangePrompt({
        isOpen: true,
        taskIndex,
        spIndex,
        oldDate: dbTargetDate,
        newDate: dateVal,
        reason: ''
      });
    } else {
      sp.targetDateChangeReason = '';
      sp.targetDate = dateVal;
      setSubTasksData(updated);
    }
  };

  const handleSaveSubTasks = async () => {
    if (!selectedStageForSubTasks || !subTasksData) return;
    setSubTaskSaveLoading(true);
    try {
      const subTasks = subTasksData.subTasks || [];
      
      // Parse original remarks to compare and detect newly completed items
      const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
      const initialSubTasks = initialParsed.subTasks || [];
      const nowStr = new Date().toLocaleString();
      const userName = user?.name || getUserName(user?.id || null) || 'Unknown User';

      subTasks.forEach((st: any, index: number) => {
        delete st.isNew;
        const initialTask = initialSubTasks[index];
        const isNowComplete = st.status === 'complete';
        const wasAlreadyComplete = initialTask && initialTask.status === 'complete';

        if (isNowComplete && !wasAlreadyComplete) {
          st.completed = true;
          st.completedDate = nowStr;
          st.completedBy = userName;
        }

        if (st.subPoints && st.subPoints.length > 0) {
          let allSpCompleted = true;
          st.subPoints.forEach((sp: any, spIndex: number) => {
            delete sp.isNew;
            const initialSp = initialTask && initialTask.subPoints ? initialTask.subPoints[spIndex] : null;
            const isSpNowComplete = sp.status === 'complete';
            const wasSpAlreadyComplete = initialSp && initialSp.status === 'complete';

            if (isSpNowComplete && !wasSpAlreadyComplete) {
              sp.completed = true;
              sp.completedDate = nowStr;
              sp.completedBy = userName;
            }

            const oldSpStatus = initialSp ? (initialSp.status || 'pending') : 'pending';
            const newSpStatus = sp.status || 'pending';
            if (oldSpStatus !== newSpStatus) {
              if (!st.logs) st.logs = [];
              st.logs.unshift({
                status: `Sub-point [${sp.title}] marked ${newSpStatus}`,
                date: nowStr,
                by: userName,
                remark: newSpStatus === 'pending' ? (sp.untickedReason || 'Status reverted') : 'Status updated'
              });
            }

            const oldSpTargetDate = initialSp ? (initialSp.targetDate || '') : '';
            const newSpTargetDate = sp.targetDate || '';
            if (oldSpTargetDate && newSpTargetDate && oldSpTargetDate !== newSpTargetDate) {
              if (!sp.logs) sp.logs = [];
              sp.logs.unshift({
                status: `Sub-point [${sp.title}] Target Date Changed`,
                date: nowStr,
                by: userName,
                remark: `From ${oldSpTargetDate} to ${newSpTargetDate}. Reason: ${sp.targetDateChangeReason || 'No reason provided'}`
              });
            } else if (!oldSpTargetDate && newSpTargetDate) {
              if (!sp.logs) sp.logs = [];
              sp.logs.unshift({
                status: `Sub-point [${sp.title}] Target Date Assigned`,
                date: nowStr,
                by: userName,
                remark: `Assigned: ${newSpTargetDate}`
              });
            }
            delete sp.targetDateChangeReason;

            if (sp.status !== 'complete' && sp.status !== 'not_applicable') {
              allSpCompleted = false;
            }
          });

          // Auto-calculate parent task completion if all subpoints are complete or not_applicable
          if (allSpCompleted && st.subPoints.length > 0) {
            const wasParentAlreadyComplete = initialTask && initialTask.status === 'complete';
            st.status = 'complete';
            st.completed = true;
            if (!wasParentAlreadyComplete) {
              st.completedDate = nowStr;
              st.completedBy = userName;
            }
          }
        }
        
        const oldStatus = initialTask ? (initialTask.status || 'pending') : 'pending';
        const newStatus = st.status || 'pending';
        if (oldStatus !== newStatus) {
          if (!st.logs) st.logs = [];
          st.logs.unshift({
            status: newStatus,
            date: nowStr,
            by: userName,
            remark: newStatus === 'pending' ? (st.untickedReason || 'Status reverted') : 'Status updated'
          });
        }

        const oldTargetDate = initialTask ? (initialTask.targetDate || '') : '';
        const newTargetDate = st.targetDate || '';
        if (oldTargetDate && newTargetDate && oldTargetDate !== newTargetDate) {
          if (!st.logs) st.logs = [];
          st.logs.unshift({
            status: `Target Date Changed`,
            date: nowStr,
            by: userName,
            remark: `From ${oldTargetDate} to ${newTargetDate}. Reason: ${st.targetDateChangeReason || 'No reason provided'}`
          });
        } else if (!oldTargetDate && newTargetDate) {
          if (!st.logs) st.logs = [];
          st.logs.unshift({
            status: `Target Date Assigned`,
            date: nowStr,
            by: userName,
            remark: `Assigned: ${newTargetDate}`
          });
        }
        delete st.targetDateChangeReason;
      });

      let totalItems = 0;
      let completedItems = 0;

      subTasks.forEach((st: any) => {
        if (st.subPoints && st.subPoints.length > 0) {
          st.subPoints.forEach((sp: any) => {
            totalItems++;
            if (sp.status === 'complete' || sp.status === 'not_applicable') completedItems++;
          });
        } else {
          totalItems++;
          if (st.status === 'complete' || st.status === 'not_applicable') completedItems++;
        }
      });

      let overallStatus = 'pending';
      if (totalItems > 0) {
        if (completedItems === totalItems) {
          overallStatus = 'completed';
        } else if (completedItems > 0) {
          overallStatus = 'in_progress';
        }
      }

      const remarksString = JSON.stringify(subTasksData);

      const { data, error } = await supabase
        .from('project_stages')
        .update({
          status: overallStatus,
          remarks: remarksString,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedStageForSubTasks.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update failed. You may not have permission, or the record was not found.');
      }

      await logActivity('Stage Subtasks Updated', {
        stage_name: selectedStageForSubTasks.stage_name,
        completed: completedItems,
        total: totalItems
      });

      // Optimistic update for Project Stages
      setProjectStages(prev => prev.map(stage => {
        if (stage.id === selectedStageForSubTasks.id) {
          return {
            ...stage,
            status: overallStatus,
            remarks: remarksString,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          };
        }
        return stage;
      }));

      // We no longer call fetchProjectDetails() here to prevent the massive dashboard reload
      setSelectedStageForSubTasks({
        ...selectedStageForSubTasks,
        remarks: remarksString
      });
      // Optional: alert('Saved successfully!');
    } catch (err: any) {
      // If error occurs, we rollback by refetching everything
      fetchProjectDetails();
      alert(err.message || 'Error saving sub-tasks.');
    } finally {
      setSubTaskSaveLoading(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX: any = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const groupedByStage: Record<string, any[]> = {};
        data.forEach((row: any) => {
          if (row.Stage) {
            if (!groupedByStage[row.Stage]) groupedByStage[row.Stage] = [];
            groupedByStage[row.Stage].push(row);
          }
        });

        let updatedStages = [...projectStages];
        let updatesToDb = [];

        for (const stageName in groupedByStage) {
          if (selectedStageForSubTasks && stageName !== selectedStageForSubTasks.stage_name) {
            continue; // Only import activities belonging to the currently selected line
          }
          const rows = groupedByStage[stageName];
          const stageIndex = updatedStages.findIndex(s => s.stage_name === stageName);
          if (stageIndex === -1) continue;
          
          const stage = updatedStages[stageIndex];
          const parsedRemarks = parseStageRemarks(stage.remarks);
          const existingSubTasks = parsedRemarks.subTasks || [];

          const newSubTasks: any[] = [];
          let currentParentTask: any = null;

          rows.forEach((row: any) => {
            if (row.Type === 'Main Point') {
               let existingTask = null;
               if (row.ID !== undefined && row.ID !== null) {
                 const idStr = String(row.ID).trim();
                 const match = idStr.match(/^(\d+)$/);
                 if (match) {
                   const index = parseInt(match[1]) - 1;
                   existingTask = existingSubTasks[index];
                 }
               }

               const newTask = {
                 title: row.Activity || 'Untitled Task',
                 status: row.Status || 'pending',
                 startDate: row.StartDate || '',
                 targetDate: row.TargetDate || '',
                 actualStartDate: existingTask?.actualStartDate || '',
                 completedDate: row.CompletedDate || '',
                 completedBy: existingTask?.completedBy || '',
                 untickedBy: existingTask?.untickedBy || '',
                 untickedDate: existingTask?.untickedDate || '',
                 untickedReason: existingTask?.untickedReason || '',
                 logs: existingTask?.logs || [],
                 revisions: existingTask?.revisions || [],
                 subPoints: []
               };
               newSubTasks.push(newTask);
               currentParentTask = newTask;
            } else if (row.Type === 'Sub Point') {
               if (currentParentTask) {
                  let existingSp = null;
                  if (row.ID !== undefined && row.ID !== null) {
                    const idStr = String(row.ID).trim();
                    const parts = idStr.split('.');
                    if (parts.length === 2) {
                      const parentIdx = parseInt(parts[0]) - 1;
                      const spIdx = parseInt(parts[1]) - 1;
                      if (existingSubTasks[parentIdx] && existingSubTasks[parentIdx].subPoints) {
                        existingSp = existingSubTasks[parentIdx].subPoints[spIdx];
                      }
                    }
                  }

                  const newSp = {
                    title: row.Activity || 'Untitled Sub Point',
                    status: row.Status || 'pending',
                    targetDate: row.TargetDate || '',
                    completedDate: row.CompletedDate || '',
                    completedBy: existingSp?.completedBy || '',
                    untickedBy: existingSp?.untickedBy || '',
                    untickedDate: existingSp?.untickedDate || '',
                    untickedReason: existingSp?.untickedReason || '',
                    logs: existingSp?.logs || [],
                    revisions: existingSp?.revisions || []
                  };
                  currentParentTask.subPoints.push(newSp);
               }
            }
          });

          const newRemarksStr = JSON.stringify({ subTasks: newSubTasks });
          updatedStages[stageIndex].remarks = newRemarksStr;

          updatesToDb.push({
            id: stage.id,
            remarks: newRemarksStr,
            updated_at: new Date().toISOString()
          });
        }

        if (updatesToDb.length > 0) {
          setProjectStages(updatedStages);
          for (const update of updatesToDb) {
             await supabase.from('project_stages').update({ remarks: update.remarks, updated_at: update.updated_at }).eq('id', update.id);
          }
          alert('Excel imported successfully!');
          
          if (selectedStageForSubTasks) {
             const reParsed = parseStageRemarks(updatedStages.find(s => s.id === selectedStageForSubTasks.id)?.remarks);
             setSubTasksData(reParsed);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse Excel file');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportToExcel = async () => {
    try {
      const XLSX: any = await import('xlsx');
      const data: any[] = [];
      const stagesToExport = selectedStageForSubTasks ? [selectedStageForSubTasks] : [];
      stagesToExport.forEach((stage, stageIdx) => {
        if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
          try {
            const parsed = JSON.parse(stage.remarks);
            if (parsed && parsed.subTasks) {
              parsed.subTasks.forEach((task: any, index: number) => {
                data.push({
                  Stage: stage.stage_name,
                  ID: `${index + 1}`,
                  Activity: task.title,
                  Status: task.status,
                  StartDate: task.startDate || '',
                  TargetDate: task.targetDate || '',
                  CompletedDate: task.completedDate || '',
                  Type: 'Main Point'
                });
                if (task.subPoints && task.subPoints.length > 0) {
                  task.subPoints.forEach((sp: any, spIndex: number) => {
                    data.push({
                      Stage: stage.stage_name,
                      ID: `${index + 1}.${spIndex + 1}`,
                      Activity: sp.title,
                      Status: sp.status,
                      TargetDate: sp.targetDate || '',
                      CompletedDate: sp.completedDate || '',
                      Type: 'Sub Point'
                    });
                  });
                }
              });
            }
          } catch(e) {}
        }
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Status");
      XLSX.writeFile(wb, `${project?.project_name || 'Project'}_Overall_Status.xlsx`);
    } catch (err) {
      alert('Error exporting to Excel');
    }
  };

  const handleTimelineDateChange = async (stageName: string, taskIndex: number, field: 'startDate' | 'targetDate', value: string) => {
    const stageIdx = projectStages.findIndex(s => s.stage_name === stageName);
    if (stageIdx === -1) return;
    
    const stage = projectStages[stageIdx];
    try {
      const parsed = JSON.parse(stage.remarks);
      if (parsed && parsed.subTasks && parsed.subTasks[taskIndex]) {
        parsed.subTasks[taskIndex][field] = value;
        const newRemarksStr = JSON.stringify(parsed);
        
        // Update local state
        const updatedStages = [...projectStages];
        updatedStages[stageIdx].remarks = newRemarksStr;
        setProjectStages(updatedStages);
        
        // Save to DB
        await supabase
          .from('project_stages')
          .update({ remarks: newRemarksStr, updated_at: new Date().toISOString() })
          .eq('id', stage.id);
      }
    } catch (e) {
      console.error('Error updating timeline date', e);
    }
  };

  const handleAddActivityFromTimeline = async (stageName: string, taskName: string, startDate: string, targetDate: string) => {
    const stageIdx = projectStages.findIndex(s => s.stage_name === stageName);
    if (stageIdx === -1) {
      alert('Please select a valid stage.');
      return false;
    }
    
    const stage = projectStages[stageIdx];
    try {
      let parsed = { subTasks: [] as any[] };
      if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
        parsed = JSON.parse(stage.remarks);
      }
      if (!parsed.subTasks) parsed.subTasks = [];
      
      parsed.subTasks.push({
        title: taskName,
        status: 'pending',
        completed: false,
        startDate: startDate,
        targetDate: targetDate,
        actualStartDate: '',
        completedDate: '',
        completedBy: '',
        untickedBy: '',
        untickedDate: '',
        untickedReason: '',
        logs: [],
        revisions: [],
        subPoints: []
      });
      
      const newRemarksStr = JSON.stringify(parsed);
      
      // Update local state
      const updatedStages = [...projectStages];
      updatedStages[stageIdx].remarks = newRemarksStr;
      setProjectStages(updatedStages);
      
      // Save to DB
      const { error } = await supabase
        .from('project_stages')
        .update({ remarks: newRemarksStr, updated_at: new Date().toISOString() })
        .eq('id', stage.id);
        
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error adding activity from timeline', e);
      alert('Failed to add activity.');
      return false;
    }
  };

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.text(`${project?.project_name || 'Project'} Overall Status`, 14, 15);
      
      const tableData: any[] = [];
      projectStages.forEach((stage) => {
        if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
          try {
            const parsed = JSON.parse(stage.remarks);
            if (parsed && parsed.subTasks) {
              parsed.subTasks.forEach((task: any, index: number) => {
                tableData.push([
                  stage.stage_name.substring(0, 20) + '...',
                  `${index + 1}`,
                  task.title,
                  task.status,
                  task.targetDate || '',
                  task.completedDate || '',
                  'Main'
                ]);
                if (task.subPoints && task.subPoints.length > 0) {
                  task.subPoints.forEach((sp: any, spIndex: number) => {
                    tableData.push([
                      stage.stage_name.substring(0, 20) + '...',
                      `${index + 1}.${spIndex + 1}`,
                      sp.title,
                      sp.status,
                      sp.targetDate || '',
                      sp.completedDate || '',
                      'Sub'
                    ]);
                  });
                }
              });
            }
          } catch(e) {}
        }
      });

      autoTable(doc, {
        head: [['Stage', 'ID', 'Activity', 'Status', 'Target', 'Completed', 'Type']],
        body: tableData,
        startY: 20,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] }
      });

      doc.save(`${project?.project_name || 'Project'}_Overall_Status.pdf`);
    } catch (err) {
      alert('Error exporting to PDF');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;
    const cleanLineName = newLineName.trim();
    
    if (cleanLineName.includes('-')) {
      alert('Line name cannot contain hyphens (-).');
      return;
    }

    const lineExists = projectStages.some(s => {
      if (s.stage_name === 'Project Kickoff Meeting') return false;
      if (s.stage_name.includes(' - ')) {
        return s.stage_name.split(' - ')[0].toLowerCase() === cleanLineName.toLowerCase();
      }
      return cleanLineName.toLowerCase() === 'main line';
    });

    if (lineExists) {
      alert(`A line named "${cleanLineName}" already exists.`);
      return;
    }
    
    const subsequentStages = STAGE_ORDER;
    const stagesToInsert = subsequentStages.map(stageType => ({
      project_id: projectId,
      stage_name: `${cleanLineName} - ${stageType}`,
      status: 'pending'
    }));

    try {
      setStageUpdateLoading(true);
      
      // Optimistic update
      const tempStages = stagesToInsert.map((s, idx) => ({ ...s, id: `temp-${Date.now()}-${idx}` }));
      setProjectStages(prev => [...prev, ...tempStages as any]);

      const res = await addProjectLine(projectId, stagesToInsert);

      if (!res.success) {
        throw new Error(res.error || 'Failed to add line');
      }
      
      // Swap temp with real
      if (res.data) {
        setProjectStages(prev => {
          const filtered = prev.filter(s => !s.id.startsWith('temp-'));
          return [...filtered, ...res.data];
        });
      }

      await logActivity('Project Line Added', {
        line_name: cleanLineName,
        project_name: project?.project_name
      });

      setIsAddLineOpen(false);
      setNewLineName('');
      // No fetchProjectDetails() call
      alert(`Line "${cleanLineName}" added successfully.`);
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      console.error('Error adding line:', err);
      alert(err.message || 'Error adding line.');
    } finally {
      setStageUpdateLoading(false);
    }
  };

  const handleDeleteLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineToDelete) return;

    if (lineToDelete === 'Main Line') {
      alert('Cannot delete the Main Line.');
      return;
    }

    setStageUpdateLoading(true);
    try {
      const stagesToDelete = projectStages.filter(s => {
        if (s.stage_name === 'Project Kickoff Meeting') return false;
        let currentLineName = 'Main Line';
        if (s.stage_name.includes(' - ')) {
          currentLineName = s.stage_name.split(' - ')[0];
        }
        return currentLineName === lineToDelete;
      });

      const stageIds = stagesToDelete.map(s => s.id);

      // Optimistic Update
      setProjectStages(prev => prev.filter(s => !stageIds.includes(s.id)));

      if (stageIds.length > 0) {
        const res = await deleteProjectLine(projectId, lineToDelete);
        if (!res.success) {
          throw new Error(res.error || 'Failed to delete line');
        }
      }

      await logActivity('Project Line Deleted', { 
        line_name: lineToDelete, 
        project_name: project?.project_name 
      });

      // No fetchProjectDetails() call
      setIsDeleteLineOpen(false);
      setLineToDelete('');
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      console.error('Error deleting line:', err);
      alert('Failed to delete line. Check console.');
    } finally {
      setStageUpdateLoading(false);
    }
  };

  const handleRenameLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRenameLineName.trim() || !oldLineToRename) return;
    const cleanNewLineName = newRenameLineName.trim();
    
    if (cleanNewLineName.includes('-')) {
      alert('Line name cannot contain hyphens (-).');
      return;
    }
    
    const lineExists = projectStages.some(s => {
      if (s.stage_name === 'Project Kickoff Meeting') return false;
      let currentLineName = 'Main Line';
      if (s.stage_name.includes(' - ')) {
        currentLineName = s.stage_name.split(' - ')[0];
      }
      return currentLineName.toLowerCase() === cleanNewLineName.toLowerCase();
    });

    if (lineExists) {
      alert(`A line named "${cleanNewLineName}" already exists.`);
      return;
    }

    setStageUpdateLoading(true);
    try {
      const oldStages = projectStages.filter(s => {
        if (s.stage_name === 'Project Kickoff Meeting') return false;
        let currentLineName = 'Main Line';
        if (s.stage_name.includes(' - ')) {
          currentLineName = s.stage_name.split(' - ')[0];
        }
        return currentLineName === oldLineToRename;
      });

      // Optimistic Update
      const oldStageIds = oldStages.map(s => s.id);
      setProjectStages(prev => prev.map(s => {
        if (oldStageIds.includes(s.id)) {
          let stageType = s.stage_name;
          if (s.stage_name.includes(' - ')) {
            stageType = s.stage_name.split(' - ').slice(1).join(' - ');
          }
          let newStageName = stageType;
          if (cleanNewLineName !== 'Main Line') {
            newStageName = `${cleanNewLineName} - ${stageType}`;
          }
          return { ...s, stage_name: newStageName };
        }
        return s;
      }));

      const res = await renameProjectLine(projectId, oldLineToRename, cleanNewLineName);
      if (!res.success) {
        throw new Error(res.error || 'Failed to rename line');
      }

      await logActivity('Project Line Renamed', {
        old_line_name: oldLineToRename,
        new_line_name: cleanNewLineName,
        project_name: project?.project_name
      });

      setIsRenameLineOpen(false);
      setOldLineToRename('');
      setNewRenameLineName('');
      // No fetchProjectDetails() call
      alert(`Line renamed from "${oldLineToRename}" to "${cleanNewLineName}" successfully.`);
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      console.error('Error renaming line:', err);
      alert(err.message || 'Error renaming line.');
    } finally {
      setStageUpdateLoading(false);
    }
  };

  // Add Comment on expanded task drawer
  const handleAddComment = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!newTaskComment.trim()) return;
    setSubmittingComment(true);

    const tempId = `temp-${Date.now()}`;
    const newCommentData = {
      task_id: taskId,
      author_id: user?.id,
      comment: newTaskComment,
    };
    
    const optimisticComment = {
      ...newCommentData,
      id: tempId,
      created_at: new Date().toISOString()
    };

    // Optimistic Update
    setComments(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), optimisticComment as TaskComment]
    }));

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert(newCommentData)
        .select()
        .single();

      if (error) throw error;

      // Replace temp comment with real one
      setComments(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map(c => c.id === tempId ? data as TaskComment : c)
      }));

      setNewTaskComment('');
      
      // Notify other task stakeholder
      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask) {
        const notifyTarget = user?.id === currentTask.assigned_to 
          ? currentTask.assigned_by 
          : currentTask.assigned_to;
        
        if (notifyTarget) {
          await supabase.from('notifications').insert({
            user_id: notifyTarget,
            title: 'New Comment on Task',
            message: `${user?.name} added a comment: "${newTaskComment.substring(0, 30)}..."`,
            related_task_id: taskId,
            related_project_id: projectId,
          });
        }
      }

      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error posting comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Achievements Module - Submit Achievement (TL or TM)
  const handleSubmitAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAchievementFormLoading(true);

    const { title, details, attachment_url } = achievementForm;

    if (!title || !details) {
      alert('Please fill in achievement title and details.');
      setAchievementFormLoading(false);
      return;
    }

    try {
      const newAchievement = {
        project_id: projectId,
        project_code: project?.project_code || '',
        title,
        details,
        submitted_by: user?.id,
        attachment_url: attachment_url || null,
        approval_status: 'pending',
      };

      const tempId = `temp-${Date.now()}`;
      const optimisticAch = { ...newAchievement, id: tempId, submitted_at: new Date().toISOString() };
      
      // Optimistic Update
      setAchievements(prev => [optimisticAch as any, ...prev]);

      const { data, error } = await supabase
        .from('achievements')
        .insert(newAchievement)
        .select()
        .single();

      if (error) throw error;

      // Replace temp with real
      setAchievements(prev => prev.map(a => a.id === tempId ? data : a));

      // Notify Manager
      if (project?.created_by) {
        await supabase.from('notifications').insert({
          user_id: project.created_by,
          title: 'New Achievement Submitted',
          message: `${user?.name} submitted achievement "${title}". Pending manager approval.`,
          related_project_id: projectId,
        });
      }

      await logActivity('Achievement Submitted', { title });

      setIsAddAchievementOpen(false);
      setAchievementForm({ title: '', details: '', attachment_url: '' });
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error submitting achievement.');
    } finally {
      setAchievementFormLoading(false);
    }
  };

  // Achievements Module - Manager Approves or Rejects with remarks
  const handleReviewAchievement = async (id: string, status: 'approved' | 'rejected') => {
    if (!reviewRemarks.trim()) {
      alert('Please write review remarks before submitting.');
      return;
    }

    try {
      const currentAch = achievements.find(a => a.id === id);

      // Optimistic Update
      setAchievements(prev => prev.map(a => a.id === id ? { 
        ...a, 
        approval_status: status, 
        manager_remarks: reviewRemarks 
      } : a));

      const { error } = await supabase
        .from('achievements')
        .update({
          approval_status: status,
          manager_remarks: reviewRemarks,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await logActivity(`Achievement Review: ${status}`, { 
        title: currentAch?.title, 
        remarks: reviewRemarks 
      });

      // Notify submitter
      if (currentAch?.submitted_by) {
        await supabase.from('notifications').insert({
          user_id: currentAch.submitted_by,
          title: `Achievement ${status.toUpperCase()}`,
          message: `Manager has ${status} your achievement "${currentAch.title}". Remarks: "${reviewRemarks}".`,
          related_project_id: projectId,
        });
      }

      if (status === 'approved') {
        confetti({ particleCount: 70, spread: 70 });
      }

      setReviewRemarks('');
      setSelectedAchievementId(null);
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error updating achievement status.');
    }
  };

  // Issues Module - Raise Issue
  const handleRaiseIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueFormLoading(true);

    const { 
      title, 
      description, 
      category, 
      priority, 
      attachment_url,
      reported_by_name,
      plant,
      line,
      station,
      occurrence_date,
      responsible_person_id,
      occurrence_condition,
      temporary_action,
      permanent_countermeasure
    } = issueForm;

    if (!title || !description || !reported_by_name || !plant || !line || !station || !occurrence_date || !responsible_person_id || !occurrence_condition || !temporary_action || !permanent_countermeasure) {
      alert('Please fill in all the required issue details.');
      setIssueFormLoading(false);
      return;
    }

    try {
      const newIssueData = {
        project_id: projectId,
        project_code: project?.project_code || '',
        title,
        description,
        category,
        priority,
        raised_by: user?.id,
        attachment_url: attachment_url || null,
        status: 'open',
        reported_by_name,
        plant,
        line,
        station,
        occurrence_date,
        responsible_person_id,
        occurrence_condition,
        temporary_action,
        permanent_countermeasure
      };

      const tempId = `temp-${Date.now()}`;
      const optimisticIssue = { ...newIssueData, id: tempId, raised_at: new Date().toISOString() };

      // Optimistic Update
      setIssues(prev => [optimisticIssue as Issue, ...prev]);

      const { data, error } = await supabase
        .from('issues')
        .insert(newIssueData)
        .select()
        .single();

      if (error) throw error;

      // Replace temp with real
      setIssues(prev => prev.map(i => i.id === tempId ? data as Issue : i));

      // Notify Manager & TL
      const notifies = [];
      if (project?.created_by) {
        notifies.push({
          user_id: project.created_by,
          title: 'Project Issue Logged',
          message: `${user?.name} logged a ${priority} issue/lesson: "${title}".`,
          related_project_id: projectId,
        });
      }
      if (project?.assigned_team_leader_id && project.assigned_team_leader_id !== user?.id) {
        notifies.push({
          user_id: project.assigned_team_leader_id,
          title: 'Project Issue Logged',
          message: `${user?.name} logged a ${priority} issue/lesson: "${title}".`,
          related_project_id: projectId,
        });
      }

      if (notifies.length > 0) {
        await supabase.from('notifications').insert(notifies);
      }

      await logActivity('Project Issue Logged', { title, priority, category });

      setIsRaiseIssueOpen(false);
      setIssueForm({ 
        title: '', 
        description: '', 
        category: 'technical', 
        priority: 'medium', 
        attachment_url: '',
        reported_by_name: '',
        plant: '',
        line: '',
        station: '',
        occurrence_date: '',
        responsible_person_id: '',
        occurrence_condition: '',
        temporary_action: '',
        permanent_countermeasure: ''
      });
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error raising issue.');
    } finally {
      setIssueFormLoading(false);
    }
  };

  // Issues Module - Resolve Issue (Manager or TL)
  const handleResolveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId || !resolutionRemarks.trim()) return;
    setResolvingLoading(true);

    try {
      const currentIssue = issues.find(i => i.id === selectedIssueId);

      // Optimistic Update
      setIssues(prev => prev.map(i => i.id === selectedIssueId ? { 
        ...i, 
        status: 'resolved', 
        resolution_remarks: resolutionRemarks 
      } : i));

      const { error } = await supabase
        .from('issues')
        .update({
          status: 'resolved',
          resolution_remarks: resolutionRemarks,
        })
        .eq('id', selectedIssueId);

      if (error) throw error;

      await logActivity('Issue Resolved', { 
        title: currentIssue?.title, 
        remarks: resolutionRemarks 
      });

      // Notify Submitter
      if (currentIssue?.raised_by) {
        await supabase.from('notifications').insert({
          user_id: currentIssue.raised_by,
          title: 'Issue Marked Resolved',
          message: `Your issue "${currentIssue.title}" was resolved. Remarks: "${resolutionRemarks}".`,
          related_project_id: projectId,
        });
      }

      setIsResolveIssueOpen(false);
      setSelectedIssueId(null);
      setResolutionRemarks('');
      // No fetchProjectDetails() call
    } catch (err: any) {
      fetchProjectDetails(); // Rollback
      alert(err.message || 'Error resolving issue.');
    } finally {
      setResolvingLoading(false);
    }
  };

  // --- PUNCH POINTS HANDLERS ---
  const handleSavePunchPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchPointFormData.line || !punchPointFormData.station_no || !punchPointFormData.concern) {
      alert("Please fill in all mandatory fields.");
      return;
    }

    setIsPunchPointModalOpen(false);
    
    // Check if status changing to Closed
    const isClosing = punchPointFormData.status === 'Closed';
    const existing = punchPointFormData.id ? punchPoints.find(p => p.id === punchPointFormData.id) : null;
    const wasAlreadyClosed = existing?.status === 'Closed';
    
    let closed_by = punchPointFormData.closed_by || null;
    if (isClosing && !wasAlreadyClosed) {
      closed_by = user?.name || null;
    } else if (!isClosing) {
      closed_by = null;
    }

    try {
      const dataToSave = {
        project_id: projectId,
        line: punchPointFormData.line,
        station_no: punchPointFormData.station_no,
        concern: punchPointFormData.concern,
        issue_raised_date: punchPointFormData.issue_raised_date || null,
        target_date: punchPointFormData.target_date || null,
        status: punchPointFormData.status || 'Open',
        closed_by,
        remark: punchPointFormData.remark || ''
      };

      const tempId = punchPointFormData.id || `temp-${Date.now()}`;
      const optimisticPoint = { ...dataToSave, id: tempId, sr_no: punchPoints.length + 1, created_at: new Date().toISOString() };

      // Optimistic Update
      if (punchPointFormData.id) {
        setPunchPoints(prev => prev.map(p => p.id === punchPointFormData.id ? { ...p, ...dataToSave } as PunchPoint : p));
      } else {
        setPunchPoints(prev => [...prev, optimisticPoint as PunchPoint]);
      }

      if (punchPointFormData.id) {
        const { error } = await supabase.from('punch_points').update(dataToSave).eq('id', punchPointFormData.id);
        if (error) throw error;
        await logActivity('Punch Point Updated', { line: dataToSave.line, concern: dataToSave.concern });
      } else {
        const { data: newPoint, error } = await supabase.from('punch_points').insert([dataToSave]).select().single();
        if (error) throw error;
        setPunchPoints(prev => prev.map(p => p.id === tempId ? newPoint : p));
        await logActivity('Punch Point Added', { line: dataToSave.line, concern: dataToSave.concern });
      }
      // We no longer call fetchPunchPoints() here to prevent the loading spinner
    } catch (err: any) {
      fetchPunchPoints(); // Rollback
      alert(err.message || 'Error saving punch point.');
    }
  };

  const handleDeletePunchPoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this punch point?')) return;
    
    // Optimistic Delete
    const previousPoints = [...punchPoints];
    setPunchPoints(prev => prev.filter(p => p.id !== id));

    try {
      const { error } = await supabase.from('punch_points').delete().eq('id', id);
      if (error) throw error;
      await logActivity('Punch Point Deleted', { id });
      // We no longer call fetchPunchPoints() here
    } catch (err: any) {
      setPunchPoints(previousPoints); // Rollback
      alert(err.message || 'Error deleting punch point.');
    }
  };

  const handleExportPunchPoints = async () => {
    try {
      const ExcelJS: any = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Punch Points');
      worksheet.columns = [
        { header: 'Sr No', key: 'sr_no', width: 10 },
        { header: 'Line', key: 'line', width: 20 },
        { header: 'Station No', key: 'station_no', width: 15 },
        { header: 'Concern', key: 'concern', width: 40 },
        { header: 'Issue Raised Date', key: 'issue_raised_date', width: 20 },
        { header: 'Target Date', key: 'target_date', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Closed By', key: 'closed_by', width: 20 },
        { header: 'Remark', key: 'remark', width: 40 }
      ];

      const filtered = punchPoints.filter(p => {
        if (punchPointFilters.line && p.line !== punchPointFilters.line) return false;
        if (punchPointFilters.status && p.status !== punchPointFilters.status) return false;
        if (punchPointFilters.issue_raised_date && p.issue_raised_date !== punchPointFilters.issue_raised_date) return false;
        if (punchPointFilters.target_date && p.target_date !== punchPointFilters.target_date) return false;
        if (punchPointFilters.closed_by && p.closed_by !== punchPointFilters.closed_by) return false;
        return true;
      });

      worksheet.addRows(filtered.map((p, idx) => ({
        ...p,
        sr_no: idx + 1 // Dynamic sequence
      })));

      worksheet.getRow(1).font = { bold: true };
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${project?.project_code || 'PRJ'}_Punch_Points.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error exporting Punch Points');
    }
  };

  const handleImportPunchPoints = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportPunchPointsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const XLSX: any = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const inserts = [];

        for (const row of data as any[]) {
          const line = row['Line'];
          const station_no = row['Station No'];
          const concern = row['Concern'];
          const remark = row['Remark'] || '';
          
          if (!line || !station_no || !concern) {
             continue; // Skip invalid rows
          }
          
          // Helper to parse excel dates
          const parseExcelDate = (val: any) => {
            if (!val) return null;
            if (typeof val === 'number') {
              const date = new Date(Math.round((val - 25569) * 86400 * 1000));
              if (isNaN(date.getTime())) return null;
              return date.toISOString().split('T')[0];
            }
            const date = new Date(val);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
          };

          let statusStr = String(row['Status'] || 'Open').trim();
          if (statusStr.toLowerCase() === 'open') statusStr = 'Open';
          else if (statusStr.toLowerCase() === 'closed') statusStr = 'Closed';
          else if (statusStr.toLowerCase() === 'wip') statusStr = 'WIP';
          else if (statusStr.toLowerCase() === 'na') statusStr = 'NA';

          let closed_by = row['Closed By'] || null;

          inserts.push({
            project_id: projectId,
            line: String(line),
            station_no: String(station_no),
            concern: String(concern),
            issue_raised_date: parseExcelDate(row['Issue Raised Date']),
            target_date: parseExcelDate(row['Target Date']),
            status: statusStr,
            closed_by: closed_by ? String(closed_by) : null,
            remark: String(remark)
          });
        }

        if (inserts.length > 0) {
          // Use the server action to bypass RLS and completely replace the punch points
          const res = await replacePunchPoints(projectId, inserts);
          
          if (!res.success) {
            throw new Error(res.error || 'Failed to replace punch points');
          }

          await fetchPunchPoints();
          if (punchPointsFileInputRef.current) {
            punchPointsFileInputRef.current.value = '';
          }
          alert(`Successfully replaced! Deleted ${res.deletedCount} old points, and inserted ${inserts.length} new points from the file.`);
        } else {
          alert('No valid rows found to import.');
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      alert('Error importing Punch Points: ' + err.message);
    } finally {
      setIsImportPunchPointsLoading(false);
      if (punchPointsFileInputRef.current) punchPointsFileInputRef.current.value = '';
    }
  };

  // --- CSV EXPORT ---
  const handleExportTasksCSV = () => {
    if (tasks.length === 0) return;
    
    // Define headers
    const headers = ['Task Title', 'Description', 'Assigned To', 'Assigned By Role', 'Priority', 'Start Date', 'Target Date', 'Status', 'Progress %', 'Remarks'];
    
    // Map rows
    const rows = tasks.map(t => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${getUserName(t.assigned_to)}"`,
      `"${t.assigned_by_role || ''}"`,
      `"${t.priority}"`,
      `"${t.start_date || ''}"`,
      `"${t.target_date || ''}"`,
      `"${t.status}"`,
      `"${t.progress_percent}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${project?.project_code || 'PRJ'}_Tasks_Export.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  // --- CHARTS CALCULATIONS ---
  const getPieChartData = () => {
    const stats: Record<string, number> = {};
    tasks.forEach(t => {
      stats[t.status] = (stats[t.status] || 0) + 1;
    });
    return Object.keys(stats).map(status => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: stats[status]
    }));
  };

  const getBarChartData = () => {
    // Progress breakdown by project member
    return projectMembers.map(member => {
      const memberTasks = tasks.filter(t => t.assigned_to === member.id);
      const avgProgress = memberTasks.length > 0 
        ? Math.round(memberTasks.reduce((acc, t) => acc + t.progress_percent, 0) / memberTasks.length)
        : 0;
      return {
        name: member.name,
        progress: avgProgress
      };
    });
  };

  const getLineChartData = () => {
    // Activity timeline grouping logs per day
    const dayMap: Record<string, number> = {};
    logs.slice(0, 15).forEach(l => {
      const day = parseSafeDate(l.created_at).toLocaleDateString('en-GB').replace(/\//g, ':');
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    return Object.keys(dayMap).map(day => ({
      date: day,
      activities: dayMap[day]
    })).reverse();
  };

  // Colors for charts
  const CHART_COLORS = ['#00f0ff', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9', '#6366f1'];


  // Filtering helper
  const filteredTasks = tasks.filter(t => {
    const sMatch = taskStatusFilter === 'all' || t.status === taskStatusFilter;
    const pMatch = taskPriorityFilter === 'all' || t.priority === taskPriorityFilter;
    const aMatch = taskAssigneeFilter === 'all' || t.assigned_to === taskAssigneeFilter;
    return sMatch && pMatch && aMatch;
  });

  const memberFilteredTasks = tasks.filter(t => t.assigned_to === user?.id);

  // --- DASHBOARD DATA COMPUTATION ---
  const linesList = Array.from(new Set(
    projectStages
      .filter(s => s.stage_name !== 'Project Kickoff Meeting')
      .map(s => {
        if (s.stage_name.includes(' - ')) {
          return s.stage_name.split(' - ')[0];
        }
        return 'Main Line';
      })
  ));
  if (linesList.length === 0) linesList.push('Main Line');
  let kpiTasks = 0;
  let kpiComplete = 0;
  let kpiPending = 0;
  let kpiOverdue = 0;
  let recentActivityList: any[] = [];
  let latestRevisionsList: any[] = [];
  let targetDatesList: any[] = [];
  let totalStagesCount = projectStages.length > 0 ? projectStages.length : STAGE_ORDER.length;
  let completedStagesCount = projectStages.filter(s => s.status === 'completed').length;
  let overallProgressPct = totalStagesCount > 0 ? Math.round((completedStagesCount / totalStagesCount) * 100) : 0;

  projectStages.forEach(stage => {
    if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
      try {
        const data = JSON.parse(stage.remarks);
        if (data && data.subTasks) {
          data.subTasks.forEach((t: any) => {
            // Target Dates
            if (t.targetDate) {
              targetDatesList.push({ date: t.targetDate, title: t.title, type: 'Main Point', stage: stage.stage_name });
              if (new Date(t.targetDate) < new Date() && t.status !== 'complete' && t.status !== 'not_applicable') kpiOverdue++;
            }
            // History
            if (t.logs) t.logs.forEach((log: any) => recentActivityList.push({ ...log, point: t.title, isRev: false }));
            if (t.revisions) {
              t.revisions.forEach((rev: any) => {
                recentActivityList.push({ ...rev, date: rev.dateReceived, by: rev.uploadedBy, status: `Rev ${rev.revisionNumber} Added`, point: t.title, isRev: true });
                latestRevisionsList.push({ ...rev, point: t.title });
              });
            }

            if (t.subPoints && t.subPoints.length > 0) {
              t.subPoints.forEach((sp: any) => {
                kpiTasks++;
                if (sp.status === 'complete' || sp.status === 'not_applicable') kpiComplete++;
                else kpiPending++;
                if (sp.targetDate) {
                  targetDatesList.push({ date: sp.targetDate, title: sp.title, type: 'Sub Point', stage: stage.stage_name });
                  if (new Date(sp.targetDate) < new Date() && sp.status !== 'complete' && sp.status !== 'not_applicable') kpiOverdue++;
                }
                if (sp.logs) sp.logs.forEach((log: any) => recentActivityList.push({ ...log, point: sp.title, isRev: false }));
                if (sp.revisions) {
                  sp.revisions.forEach((rev: any) => {
                    recentActivityList.push({ ...rev, date: rev.dateReceived, by: rev.uploadedBy, status: `Rev ${rev.revisionNumber} Added`, point: sp.title, isRev: true });
                    latestRevisionsList.push({ ...rev, point: sp.title });
                  });
                }
              });
            } else {
              kpiTasks++;
              if (t.status === 'complete' || t.status === 'not_applicable') kpiComplete++;
              else kpiPending++;
            }
          });
        }
      } catch (e) {}
    }
  });

  recentActivityList.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
  latestRevisionsList.sort((a, b) => parseSafeDate(b.dateReceived).getTime() - parseSafeDate(a.dateReceived).getTime());
  targetDatesList = targetDatesList.filter(x => parseSafeDate(x.date).getTime() >= new Date().setHours(0,0,0,0)).sort((a, b) => parseSafeDate(a.date).getTime() - parseSafeDate(b.date).getTime());

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col animate-in fade-in duration-300">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#e2e8f0] rounded-full animate-pulse"></div>
            <div>
              <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-2"></div>
              <div className="h-4 w-32 bg-[#e2e8f0] rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-24 h-10 bg-[#e2e8f0] rounded-lg animate-pulse hidden sm:block"></div>
            <div className="w-24 h-10 bg-[#e2e8f0] rounded-lg animate-pulse hidden sm:block"></div>
            <div className="w-10 h-10 bg-[#e2e8f0] rounded-full animate-pulse"></div>
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {/* Top Metric Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="bg-white h-24 rounded-2xl shadow-sm border border-[#e2e8f0] animate-pulse"></div>
             ))}
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-2 overflow-hidden pb-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-10 w-28 bg-[#e2e8f0] rounded-lg animate-pulse flex-shrink-0"></div>
            ))}
          </div>
          
          {/* Main Content Area Skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 flex-1 flex flex-col gap-4">
             <div className="flex justify-between items-center mb-4">
               <div className="h-8 w-64 bg-[#e2e8f0] rounded animate-pulse"></div>
               <div className="h-8 w-32 bg-[#e2e8f0] rounded animate-pulse"></div>
             </div>
             {[1, 2, 3, 4, 5].map(i => (
               <div key={i} className="h-20 w-full bg-[#f1f5f9] rounded-xl animate-pulse"></div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  const role = user?.role;

  return (
    <div className="relative min-h-screen bg-[#dbeafe] text-[#0f172a] p-1 md:p-2">

      <div className="relative z-10 flex flex-col gap-3 animated-fade">
      
      {/* NEW MODERN DASHBOARD LAYOUT */}
      
      {/* 1. PROJECT HEADER */}
      <div className="relative bg-[#090f1d]/90 border border-white/10 p-4 md:p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <button 
            onClick={() => router.push(`/dashboard/${role?.replace('_', '-')}`)}
            className="p-2 rounded-lg bg-[#0d1527] border border-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#1e293b] hover:border-[#00f0ff]/50 transition-all shadow-sm"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase font-heading leading-tight flex items-center gap-2">
              <Folder className="w-5 h-5 text-[#00f0ff]" />
              PROJECT: {project.project_name} <span className="text-sm font-mono text-gray-400">({project.project_code})</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1 font-mono tracking-wider">
              CLIENT: <strong className="text-white">{project.customer_name}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 relative z-10 w-full md:w-[350px]">
           <div className="flex justify-between text-xs font-mono font-bold text-white tracking-wider">
             <span>PROGRESS: {overallProgressPct}%</span>
             <span className="text-[#00f0ff]">STAGES: {completedStagesCount} / {totalStagesCount}</span>
           </div>
           <div className="w-full h-3 bg-[#0d1527] rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-[#2563eb] to-[#00f0ff] transition-all duration-700" 
                style={{ width: `${overallProgressPct}%` }}
              />
           </div>
           <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
        </div>
      </div>

      {/* TABS ROW (Dynamic depending on role) */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center border-b-2 border-[#93c5fd] pb-1 gap-2 mt-2">
        <div className="flex gap-1.5 overflow-x-auto scroll-container pb-1">
          {/* MANAGER & ADMIN TABS */}
          {(role === 'manager' || role === 'admin') && (
            <>
              {['overview', 'stages', 'timeline', 'tasks', 'punch-points', 'achievements', 'issues', 'activity-log'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-300 relative border-2 ${
                    activeTab === tab
                      ? 'border-[#2563eb] text-[#2563eb] bg-white shadow-md font-extrabold'
                      : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-white/60'
                  }`}
                >
                  {tab === 'issues' ? 'Diagnostic Logs' : tab === 'stages' ? 'Project Flow' : tab.replace('-', ' ')}
                </button>
              ))}
            </>
          )}

          {/* TEAM LEADER TABS */}
          {role === 'team_leader' && (
            <>
              {['overview', 'stages', 'timeline', 'tasks', 'punch-points', 'achievements', 'issues', 'activity-log'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-300 relative border-2 ${
                    activeTab === tab
                      ? 'border-[#2563eb] text-[#2563eb] bg-white shadow-md font-extrabold'
                      : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-white/60'
                  }`}
                >
                  {tab === 'issues' ? 'Diagnostic Logs' : tab === 'stages' ? 'Project Flow' : tab.replace('-', ' ')}
                </button>
              ))}
            </>
          )}

          {/* TEAM MEMBER TABS */}
          {role === 'team_member' && (
            <>
              {['stages', 'timeline', 'my-tasks', 'punch-points', 'achievements', 'issues', 'activity-log'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-300 relative border-2 ${
                    activeTab === tab
                      ? 'border-[#2563eb] text-[#2563eb] bg-white shadow-md font-extrabold'
                      : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-white/60'
                  }`}
                >
                  {tab === 'issues' ? 'Diagnostic Logs' : tab === 'stages' ? 'Project Flow' : tab.replace('-', ' ')}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Tab specific context button */}
        <div className="flex gap-2 flex-wrap items-center justify-end">
          {activeTab === 'tasks' && tasks.length > 0 && (
            <button
              onClick={handleExportTasksCSV}
              className="btn-secondary-sm text-[9.5px] font-bold tracking-widest font-mono uppercase border border-white/10 hover:border-[#00f0ff]/30 hover:text-[#00f0ff] transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b101d]"
            >
              <Download className="w-3.5 h-3.5 text-[#00f0ff]" /> Export Tasks (CSV)
            </button>
          )}
          {activeTab === 'tasks' && (role === 'team_leader' || role === 'manager') && (
            <button
              onClick={() => setIsAssignTaskOpen(true)}
              className="px-3.5 py-2 text-[9.5px] font-bold tracking-widest font-mono uppercase bg-blue-600 hover:bg-blue-500 border border-blue-500/30 text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.15)] hover:shadow-[0_0_18px_rgba(37,99,235,0.3)] transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Assign Task
            </button>
          )}
          {activeTab === 'achievements' && role !== 'manager' && (
            <button
              onClick={() => setIsAddAchievementOpen(true)}
              className="px-3.5 py-2 text-[9.5px] font-bold tracking-widest font-mono uppercase bg-blue-600 hover:bg-blue-500 border border-blue-500/30 text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.15)] hover:shadow-[0_0_18px_rgba(37,99,235,0.3)] transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Achievement
            </button>
          )}
          {activeTab === 'issues' && (
            <button
              onClick={() => setIsRaiseIssueOpen(true)}
              className="px-3.5 py-2 text-[9.5px] font-bold tracking-widest font-mono uppercase bg-red-900/60 hover:bg-red-800 border border-red-500/30 text-white rounded-lg shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:shadow-[0_0_18px_rgba(239,68,68,0.3)] transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-red-400" /> Log Issue / Lesson Learned
            </button>
          )}
          {activeTab === 'punch-points' && (
            <>
              <button
                onClick={handleExportPunchPoints}
                className="btn-secondary-sm text-[9.5px] font-bold tracking-widest font-mono uppercase border border-white/10 hover:border-[#00f0ff]/30 hover:text-[#00f0ff] transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b101d]"
              >
                <Download className="w-3.5 h-3.5 text-[#00f0ff]" /> Export
              </button>
              <button
                onClick={() => punchPointsFileInputRef.current?.click()}
                disabled={isImportPunchPointsLoading}
                className="btn-secondary-sm text-[9.5px] font-bold tracking-widest font-mono uppercase border border-white/10 hover:border-green-400/30 hover:text-green-400 transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b101d]"
              >
                <Upload className="w-3.5 h-3.5 text-green-400" /> {isImportPunchPointsLoading ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => { setPunchPointFormData({ status: 'Open' }); setIsPunchPointModalOpen(true); }}
                className="px-3.5 py-2 text-[9.5px] font-bold tracking-widest font-mono uppercase bg-blue-600 hover:bg-blue-500 border border-blue-500/30 text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.15)] hover:shadow-[0_0_18px_rgba(37,99,235,0.3)] transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </>
          )}
        </div>
        {/* Hidden input for importing punch points */}
        <input 
          type="file" 
          ref={punchPointsFileInputRef} 
          onChange={handleImportPunchPoints} 
          accept=".xlsx, .xls" 
          className="hidden" 
        />
      </div>

      {/* OVERVIEW PANEL REPLACEMENT */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4 mt-4">
          
          {/* KPI CARDS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             {[
               { label: 'TASKS', value: kpiTasks, color: 'text-[#2563eb]', border: 'border-[#93c5fd]' },
               { label: 'COMPLETE', value: kpiComplete, color: 'text-green-600', border: 'border-green-300' },
               { label: 'PENDING', value: kpiPending, color: 'text-slate-500', border: 'border-slate-300' },
               { label: 'OVERDUE', value: kpiOverdue, color: 'text-red-500', border: 'border-red-300' }
             ].map((kpi, idx) => (
                <div key={idx} className={`bg-white border ${kpi.border} p-3 rounded-lg flex flex-col items-center justify-center shadow-sm relative overflow-hidden group hover:bg-[#dbeafe] transition-all`}>
                   <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-50 transition-opacity" />
                   <span className="text-[10px] font-bold tracking-widest text-slate-500 mb-1">{kpi.label}</span>
                   <span className={`text-3xl font-black font-mono tracking-tighter ${kpi.color}`}>{kpi.value}</span>
                </div>
             ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* LEFT COLUMN: STAGES & TEAM (col-span-8) */}
            <div className="col-span-1 lg:col-span-8 flex flex-col gap-4">
              
              {/* STAGE PROGRESS VERTICAL */}
              <div className="bg-white border border-[#93c5fd] p-5 rounded-xl shadow-sm relative overflow-hidden">
                <h3 className="font-bold text-sm text-[#0f172a] font-heading tracking-wide uppercase flex items-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-[#2563eb]" />
                  Project Stage Progress
                </h3>
                
                <div className="flex flex-col pl-2">
                  {STAGE_ORDER.map((stageName, index) => {
                    const matchingStages = projectStages.filter(s => s.stage_name === stageName || s.stage_name.endsWith(` - ${stageName}`));
                    let stageKpiTasks = 0;
                    let stageKpiComplete = 0;
                    let status = 'pending';
                    
                    if (matchingStages.length > 0) {
                      matchingStages.forEach(st => {
                        let p = getSubTasksProgress(st.remarks, 8);
                        stageKpiTasks += p.total;
                        stageKpiComplete += p.completed;
                      });
                    }

                    const pct = stageKpiTasks > 0 ? Math.round((stageKpiComplete / stageKpiTasks) * 100) : 0;
                    
                    let isCompleted = false;
                    let isInProgress = false;
                    
                    if (stageKpiTasks > 0) {
                      isCompleted = pct === 100;
                      isInProgress = pct > 0 && pct < 100;
                    } else {
                      isCompleted = matchingStages.length > 0 && matchingStages.every(st => st.status === 'completed');
                      isInProgress = matchingStages.some(st => st.status === 'in_progress' || st.status === 'completed') && !isCompleted;
                    }

                    return (
                      <div key={stageName} className="relative flex gap-4 min-h-[70px]">
                         {/* Flow line & Node */}
                         <div className="relative flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] z-10 border-2 ${
                               isCompleted ? 'bg-green-100 border-green-500 text-green-700' :
                               isInProgress ? 'bg-blue-100 border-blue-500 text-blue-700' :
                               'bg-slate-100 border-slate-300 text-slate-500'
                            }`}>
                               {isCompleted ? '✓' : isInProgress ? '◐' : '○'}
                            </div>
                            {index < STAGE_ORDER.length - 1 && (
                               <div className={`w-0.5 flex-1 my-1 ${isCompleted ? 'bg-green-400' : 'bg-slate-300'}`} />
                            )}
                         </div>
                         
                         {/* Stage Info */}
                         <div className={`pb-4 flex-1 ${isCompleted ? 'opacity-80' : isInProgress ? 'opacity-100' : 'opacity-60'}`}>
                            <h4 className="font-bold text-xs text-[#0f172a] uppercase tracking-wider">{stageName}</h4>
                            <div className="flex items-center gap-4 mt-1 text-[10px] font-mono font-bold text-slate-500">
                               <span className={isCompleted ? 'text-green-600' : isInProgress ? 'text-blue-600' : ''}>{pct}% Complete</span>
                               <span>{stageKpiComplete} / {stageKpiTasks || 0} Tasks</span>
                               {matchingStages.length > 0 && matchingStages[0].updated_at && (
                                 <span className="text-slate-400">Updated: {new Date(matchingStages[0].updated_at).toLocaleDateString('en-GB').replace(/\//g, ':')}</span>
                               )}
                            </div>
                            {/* Inner progress bar */}
                            <div className="w-full max-w-sm h-1.5 bg-[#dbeafe] rounded-full mt-2 overflow-hidden">
                               <div className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-[#2563eb]'}`} style={{ width: `${pct}%` }} />
                            </div>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* TEAM INFORMATION COMPACT */}
              <div className="bg-white border border-[#93c5fd] p-5 rounded-xl shadow-sm relative overflow-hidden flex flex-col gap-4">
                 <div className="flex justify-between items-center">
                   <h3 className="font-bold text-sm text-[#0f172a] font-heading tracking-wide uppercase flex items-center gap-2">
                     <Users className="w-4 h-4 text-purple-600" />
                     Team Information
                   </h3>
                   <button className="text-[10px] text-purple-600 hover:text-purple-700 font-bold uppercase tracking-wider underline underline-offset-2">View All</button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Leader */}
                    <div>
                       <div className="flex justify-between items-center mb-2 border-b border-[#93c5fd] pb-1">
                         <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase block">Team Leader</span>
                         {(role === 'manager') && (
                           <button 
                             onClick={() => setIsEditingTeamLeader(!isEditingTeamLeader)} 
                             className="text-[9px] text-[#2563eb] hover:text-[#1d4ed8] font-bold tracking-wider underline"
                           >
                             {isEditingTeamLeader ? 'Cancel' : 'Edit'}
                           </button>
                         )}
                       </div>
                       
                       {isEditingTeamLeader ? (
                         <select
                           value={project.assigned_team_leader_id || ''}
                           onChange={(e) => handleUpdateTeamLeader(e.target.value)}
                           className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#2563eb] outline-none bg-slate-50 text-slate-800"
                         >
                           <option value="">-- Unassigned --</option>
                           {allUsers.filter(u => u.role === 'team_leader').map(tl => (
                             <option key={tl.id} value={tl.id}>{tl.name}</option>
                           ))}
                         </select>
                       ) : (
                         project.assigned_team_leader_id ? (
                           <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-[#bfdbfe]">
                              <div className="w-8 h-8 rounded bg-purple-100 border border-purple-300 text-purple-700 flex items-center justify-center font-bold text-xs">
                                 {getInitials(getUserName(project.assigned_team_leader_id) || 'TL')}
                              </div>
                              <span className="text-xs font-bold text-[#0f172a]">{getUserName(project.assigned_team_leader_id)}</span>
                           </div>
                         ) : (
                           <span className="text-xs font-mono text-slate-400 italic">Not Assigned</span>
                         )
                       )}
                    </div>
                    
                    {/* Members */}
                    <div>
                       <div className="flex justify-between items-center mb-2 border-b border-[#93c5fd] pb-1">
                         <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase block">Team Members ({projectMembers.length})</span>
                         {(role === 'team_leader' || role === 'manager') && (
                           <button 
                             onClick={() => setIsAssignMemberOpen(true)} 
                             className="text-[9px] text-[#2563eb] hover:text-[#1d4ed8] font-bold tracking-wider underline"
                           >
                             Add Member
                           </button>
                         )}
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {projectMembers.length > 0 ? projectMembers.map(m => (
                            <div key={m.id} className="flex items-center gap-2 bg-white pr-3 p-1 rounded-full border border-[#bfdbfe] hover:border-[#93c5fd] transition-colors">
                               <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 text-blue-700 flex items-center justify-center font-bold text-[9px]">
                                  {getInitials(m.name || 'M')}
                               </div>
                               <span className="text-[10px] font-bold text-[#0f172a]">{m.name || 'Unknown'}</span>
                            </div>
                          )) : (
                            <span className="text-xs font-mono text-slate-400 italic">No Members Assigned</span>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              {/* PROJECT COMPLETION BUTTON REPLACEMENT */}
              {(() => {
                const isProjectCompletable = 
                  overallProgressPct >= 100 &&
                  punchPoints.every(p => p.status === 'Closed') &&
                  tasks.every(t => t.status === 'closed' || t.status === 'approved_by_manager');

                return (
                  <div className="bg-white border border-[#93c5fd] p-5 rounded-xl shadow-sm relative overflow-hidden flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm text-[#0f172a] font-heading tracking-wide uppercase">Project Status</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[#2563eb]">
                            <input type="radio" name="proj_status" defaultChecked={project.status === 'active'} className="accent-blue-600" /> Active
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
                            <input type="radio" name="proj_status" className="accent-slate-500" /> On Hold
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-green-600 opacity-60 pointer-events-none">
                            <input type="radio" name="proj_status" defaultChecked={project.status === 'completed'} disabled={!isProjectCompletable} className="accent-green-600" /> Completed
                          </label>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleUpdateProjectStatus('completed')}
                      disabled={!isProjectCompletable || project.status === 'completed'}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black uppercase tracking-widest rounded-lg shadow-sm transition-all"
                    >
                      {project.status === 'completed' ? 'ALREADY COMPLETED' : 'COMPLETE PROJECT'}
                    </button>
                  </div>
                );
              })()}

            </div>

            {/* RIGHT COLUMN: ACTIVITY & TARGETS (col-span-4) */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
              
              {/* RECENT ACTIVITY */}
              <div className="bg-white border border-[#93c5fd] p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col h-[350px]">
                 <h3 className="font-bold text-xs text-[#0f172a] font-heading tracking-wide uppercase flex items-center gap-2 mb-4 border-b border-[#93c5fd] pb-2">
                   <Activity className="w-3.5 h-3.5 text-orange-500" />
                   Recent Activity
                 </h3>
                 <div className="flex-1 overflow-y-auto scroll-container pr-2 flex flex-col gap-3">
                   {recentActivityList.length > 0 ? recentActivityList.slice(0, 20).map((act, i) => (
                      <div key={i} className="flex gap-3">
                         <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full mt-1 ${act.isRev ? 'bg-blue-500' : 'bg-green-500'}`} />
                            {i < Math.min(20, recentActivityList.length) - 1 && <div className="w-[1px] flex-1 bg-[#93c5fd] my-1" />}
                         </div>
                         <div className="flex-1 pb-3">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-[#0f172a] uppercase">{act.status || act.description}</span>
                              <span className="text-[8px] font-mono text-slate-500">{parseSafeDate(act.date).toLocaleDateString('en-GB').replace(/\//g, ':')}</span>
                            </div>
                            <p className="text-[9px] text-slate-600 mt-0.5 leading-tight">{act.point}</p>
                            <p className="text-[8px] text-slate-400 mt-1 uppercase">By: {act.by}</p>
                         </div>
                      </div>
                   )) : (
                      <span className="text-xs font-mono text-slate-400 italic block text-center mt-10">No recent activity</span>
                   )}
                 </div>
              </div>

              {/* LATEST REVISIONS */}
              <div className="bg-white border border-[#93c5fd] p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
                 <h3 className="font-bold text-xs text-[#0f172a] font-heading tracking-wide uppercase flex items-center gap-2 mb-3 border-b border-[#93c5fd] pb-2">
                   <FileText className="w-3.5 h-3.5 text-[#2563eb]" />
                   Latest Revisions
                 </h3>
                 <div className="flex flex-col gap-2">
                   {latestRevisionsList.length > 0 ? latestRevisionsList.slice(0, 4).map((rev, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-[#bfdbfe]">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-[#0f172a] truncate max-w-[150px]" title={rev.point}>{rev.point}</span>
                            <span className="text-[8px] text-slate-500">{parseSafeDate(rev.dateReceived).toLocaleDateString('en-GB').replace(/\//g, ':')}</span>
                         </div>
                         <span className="text-[9px] font-bold font-mono text-[#2563eb] bg-blue-100 px-2 py-0.5 rounded">Rev.{rev.revisionNumber}</span>
                      </div>
                   )) : (
                      <span className="text-[10px] font-mono text-slate-400 italic block text-center my-2">No revisions found</span>
                   )}
                   <button className="text-[9px] text-[#2563eb] font-bold uppercase tracking-wider hover:text-blue-700 mt-1 w-full text-center">View Revision History</button>
                 </div>
              </div>

              {/* UPCOMING TARGET DATES */}
              <div className="bg-white border border-[#93c5fd] p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
                 <h3 className="font-bold text-xs text-[#0f172a] font-heading tracking-wide uppercase flex items-center gap-2 mb-3 border-b border-[#93c5fd] pb-2">
                   <Calendar className="w-3.5 h-3.5 text-pink-500" />
                   Upcoming Targets
                 </h3>
                 <div className="flex flex-col gap-2">
                   {targetDatesList.length > 0 ? targetDatesList.slice(0, 4).map((td, i) => {
                      const daysLeft = Math.ceil((parseSafeDate(td.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                      const isToday = daysLeft === 0;
                      return (
                      <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-[#bfdbfe]">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-[#0f172a] truncate max-w-[150px]" title={td.title}>{td.title}</span>
                            <span className="text-[8px] text-slate-500 truncate max-w-[150px]">{td.stage}</span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold font-mono text-pink-600">{parseSafeDate(td.date).toLocaleDateString('en-GB').replace(/\//g, ':')}</span>
                            <span className={`text-[8px] font-bold ${isToday ? 'text-orange-500' : 'text-slate-400'}`}>{isToday ? 'TODAY' : `${daysLeft} days`}</span>
                         </div>
                      </div>
                   )}) : (
                      <span className="text-[10px] font-mono text-slate-400 italic block text-center my-2">No upcoming targets</span>
                   )}
                 </div>
              </div>

            </div>
          </div>
        </div>
      )}



      {/* TAB: STAGES */}
      {activeTab === 'stages' && (() => {
        const kickoffStage = projectStages.find(s => s.stage_name === 'Project Kickoff Meeting');
        const linesMap: Record<string, any[]> = {};
        
        projectStages.forEach(s => {
          if (s.stage_name === 'Project Kickoff Meeting') return;
          
          let lineName = 'Main Line';
          let stageTitle = s.stage_name;
          
          if (s.stage_name.includes(' - ')) {
            const parts = s.stage_name.split(' - ');
            lineName = parts[0];
            stageTitle = parts.slice(1).join(' - ');
          }
          
          if (!linesMap[lineName]) {
            linesMap[lineName] = [];
          }
          linesMap[lineName].push({
            ...s,
            displayName: stageTitle
          });
        });
        
        const stageOrderSubsequent = STAGE_ORDER;
        
        const lines = Object.keys(linesMap).map(lineName => {
          const stages = linesMap[lineName].sort((a, b) => {
            return stageOrderSubsequent.indexOf(a.displayName) - stageOrderSubsequent.indexOf(b.displayName);
          });
          
          const completedCount = stages.filter(s => s.status === 'completed').length;
          const progressPercent = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;
          
          return {
            lineName,
            stages,
            progressPercent,
            completedCount
          };
        });
        
        lines.sort((a, b) => {
          if (a.lineName === 'Main Line') return -1;
          if (b.lineName === 'Main Line') return 1;
          const minA = Math.min(...a.stages.map(s => parseSafeDate(s.created_at).getTime()));
          const minB = Math.min(...b.stages.map(s => parseSafeDate(s.created_at).getTime()));
          return minA - minB;
        });
 
        const kickoffStatus = kickoffStage?.status || 'pending';
        const kickoffRemarks = kickoffStage?.remarks || 'No remarks provided for this stage.';
        const kickoffLastUpdated = kickoffStage?.updated_at ? parseSafeDate(kickoffStage.updated_at).toLocaleString() : null;
        const kickoffUpdatedBy = kickoffStage?.updated_by ? getUserName(kickoffStage.updated_by) : null;
 
        const isUserAuthorized = role === 'admin' || role === 'manager' || role === 'team_leader' || role === 'team_member';
 
        return (
          <div className="flex flex-col gap-6">
            {/* Engineering Canvas board container */}
            <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-[#93c5fd] relative overflow-x-hidden overflow-y-scroll max-h-[85vh] scroll-container-light shadow-lg">

              <div className="relative z-10 flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-[#93c5fd] pb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#0f172a] font-heading tracking-wide">Project Execution Flow</h3>
                  </div>
                  
                  <div className="flex items-center gap-3.5 flex-wrap">
                    {/* Add Line button in header for high visibility */}
                    {isUserAuthorized && (
                      <button
                        onClick={() => setIsAddLineOpen(true)}
                        className="px-4 py-2 text-xs font-bold tracking-wide bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center gap-1.5 rounded-xl transition-all duration-300 active:scale-95 shadow-md hover:shadow-lg"
                      >
                        <Plus className="w-4 h-4" /> Add Line
                      </button>
                    )}
 
                    <div className="flex gap-3 text-[9px] font-bold bg-white border-2 border-[#93c5fd] px-3 py-1.5 rounded-xl shadow-sm uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-green-700">Completed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                        <span className="text-orange-600">In Progress</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-400 flex-shrink-0" />
                        <span className="text-slate-500">Pending</span>
                      </div>
                    </div>
                  </div>
                </div>
 
                
                {/* --- INLINE CHECKLIST MANAGER --- */}
                {selectedStageForSubTasks && subTasksData ? (
                <div className="bg-white p-4 md:p-5 rounded-2xl shadow-xl flex flex-col gap-2 mb-4 relative">
                  <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-2 gap-4">
                    <div className="flex-1 w-full">
                      <h3 className="font-bold text-base text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-4 bg-[#2563eb] inline-block rounded-full animate-pulse" />
                        {selectedStageForSubTasks.stage_name.includes(' - ') ? selectedStageForSubTasks.stage_name.split(' - ')[1] : selectedStageForSubTasks.stage_name} Checklist
                      </h3>
                      <span className="text-xs text-[#64748b] font-bold uppercase tracking-widest block mt-1">
                        Stage: {selectedStageForSubTasks.stage_name}
                      </span>
                    </div>

                    <div className="flex-1 flex justify-center w-full">
                      <button
                        type="button"
                        onClick={() => setIsOverallStatusOpen(true)}
                        className="px-4 py-2 text-xs font-bold bg-white text-[#2563eb] border-2 border-[#93c5fd] rounded-xl hover:bg-[#dbeafe] transition-all flex items-center gap-2 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        Overall Status
                      </button>
                    </div>

                    <div className="flex-1 flex justify-end gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSubTasksModalOpen(false);
                          setSelectedStageForSubTasks(null);
                          setSubTasksData(null);
                        }}
                        className="px-4 py-2 text-xs font-bold bg-white text-[#64748b] border-2 border-[#e2e8f0] rounded-xl hover:bg-[#f1f5f9] transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSubTasks}
                        disabled={subTaskSaveLoading}
                        className="px-4 py-2 text-xs font-bold bg-[#2563eb] text-white border-2 border-[#2563eb] rounded-xl hover:bg-[#1d4ed8] transition-all flex items-center gap-2"
                      >
                        {subTaskSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  {(() => {
                    const subTasks = subTasksData.subTasks || [];
                    let total = 0;
                    let completed = 0;
                    let pending = 0;
                    let inProgress = 0;
                    let delayed = 0;
                    
                    subTasks.forEach((st: any) => {
                      if (st.subPoints && st.subPoints.length > 0) {
                        st.subPoints.forEach((sp: any) => {
                          total++;
                          if (sp.status === 'complete' || sp.status === 'not_applicable') completed++;
                          else if (sp.status === 'in_progress') inProgress++;
                          else pending++;
                          if (isTaskDelayed(sp.targetDate, sp.status)) delayed++;
                        });
                      } else {
                        total++;
                        if (st.status === 'complete' || st.status === 'not_applicable') completed++;
                        else if (st.status === 'in_progress') inProgress++;
                        else pending++;
                        if (isTaskDelayed(st.targetDate, st.status)) delayed++;
                      }
                    });
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                        <div className="bg-white border border-[#bfdbfe] rounded-xl p-3 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest">Progress</span>
                          <div className="flex items-end gap-2 mt-1">
                            <span className="text-xl font-bold text-[#2563eb] leading-none">{pct}%</span>
                            <span className="text-xs text-[#64748b] font-semibold mb-0.5">{completed}/{total}</span>
                          </div>
                        </div>
                        <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest">Pending</span>
                          <div className="flex items-end gap-2 mt-1">
                            <span className="text-xl font-bold text-[#64748b] leading-none">{pending}</span>
                          </div>
                        </div>
                        <div className="bg-white border border-[#bfdbfe] rounded-xl p-3 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] text-[#2563eb] font-bold uppercase tracking-widest">In Progress</span>
                          <div className="flex items-end gap-2 mt-1">
                            <span className="text-xl font-bold text-[#2563eb] leading-none">{inProgress}</span>
                          </div>
                        </div>
                        <div className="bg-white border border-[#a7f3d0] rounded-xl p-3 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] text-[#059669] font-bold uppercase tracking-widest">Completed</span>
                          <div className="flex items-end gap-2 mt-1">
                            <span className="text-xl font-bold text-[#059669] leading-none">{completed}</span>
                          </div>
                        </div>
                        <div className="bg-white border border-red-200 rounded-xl p-3 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] text-red-600 font-bold uppercase tracking-widest">Delayed</span>
                          <div className="flex items-end gap-2 mt-1">
                            <span className="text-xl font-bold text-red-600 leading-none">{delayed}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Top Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setIsOverallStatusOpen(true)}
                      className="px-3 py-1.5 text-[11px] font-bold bg-white text-[#2563eb] border border-[#93c5fd] rounded-lg hover:bg-[#dbeafe] transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      Overall Status
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = window.prompt('Enter new Activity description:');
                        if (!input || !input.trim()) return;
                        
                        const updated = { ...subTasksData };
                        const isDataCollectionType = !selectedStageForSubTasks.stage_name.includes('Kickoff');
                        const customTaskName = input.trim();
                        const needsSubPoints = isDataCollectionType && [
                          'Sequence Sheet', 'JIG IO List', 'GA Drawing / Images'
                        ].includes(customTaskName);

                        const newTask: any = {
                          title: customTaskName,
                          isNew: true,
                          status: 'pending',
                          completed: false,
                          startDate: '',
                          targetDate: '',
                          actualStartDate: '',
                          completedDate: '',
                          completedBy: '',
                          untickedBy: '',
                          untickedDate: '',
                          untickedReason: '',
                          logs: [],
                          subPoints: needsSubPoints ? [
                            { title: 'Offline Approval', isNew: true, status: 'pending', targetDate: '', completedDate: '', completedBy: '', revisions: [] },
                            { title: 'Online Approval', isNew: true, status: 'pending', targetDate: '', completedDate: '', completedBy: '', revisions: [] },
                            { title: 'Final Handover', isNew: true, status: 'pending', targetDate: '', completedDate: '', completedBy: '', revisions: [] }
                          ] : []
                        };
                        
                        if (!updated.subTasks) updated.subTasks = [];
                        updated.subTasks.push(newTask);
                        setSubTasksData(updated);
                        logActivity('Activity Added', { activity: customTaskName, stage_name: selectedStageForSubTasks.stage_name });
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-white text-[#2563eb] border border-[#93c5fd] rounded-lg hover:bg-[#dbeafe] transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      Add Activity
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-[11px] font-bold bg-white text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-[#f8fafc] transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={exportToExcel}
                      className="px-3 py-1.5 text-[11px] font-bold bg-white text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-[#f8fafc] transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Export
                    </button>
                  </div>

                  {/* Checklist items Header */}
                  <div className="flex items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest px-4 pb-1.5 border-b-2 border-[#93c5fd]/30 mt-2 gap-4">
                    <div className="w-[30px] shrink-0 text-center">ID</div>
                    <div className="flex-1 min-w-[200px]">ACTIVITY / CHECKPOINT</div>
                    <div className="w-[80px] shrink-0 text-center hidden lg:block">REVISION</div>
                    <div className="w-[110px] shrink-0 text-center hidden md:block">START DATE</div>
                    <div className="w-[110px] shrink-0 text-center hidden md:block">TARGET DATE</div>
                    <div className="w-[110px] shrink-0 text-center hidden sm:block">STATUS</div>
                    <div className="w-[130px] shrink-0 text-center hidden xl:block">UPDATED BY</div>
                    <div className="w-[90px] shrink-0 text-center hidden xl:block">LAST UPDATE</div>
                    <div className="w-[180px] shrink-0 text-right">ACTIONS</div>
                  </div>
                  <div className="flex flex-col max-h-[60vh] overflow-y-auto scroll-container">
                    {subTasksData.subTasks.map((task: any, index: number) => {
                      const hasSubPoints = task.subPoints && task.subPoints.length > 0;
                      const isCompleted = task.subPoints && task.subPoints.length > 0 
                        ? task.subPoints.every((sp: any) => sp.status === 'complete' || sp.status === 'not_applicable')
                        : (task.status === 'complete' || task.status === 'not_applicable');

                      const isAllowedToComplete = user?.role === 'team_leader' || user?.role === 'team_member';
                      const isDelayed = isTaskDelayed(task.targetDate, task.status);

                      return (
                        <div key={index} className={`border-b transition-all py-2.5 px-4 flex flex-col gap-1.5 group ${isDelayed ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'border-[#93c5fd]/20 hover:bg-[#93c5fd]/5'}`}>
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
                            {/* ID */}
                            <div className="w-[30px] shrink-0 flex justify-center">
                              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px]">
                                {index + 1}
                              </div>
                            </div>

                            {/* ACTIVITY / CHECKPOINT */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <button
                                type="button"
                                onClick={() => setExpandedTasks(prev => ({ ...prev, [index]: expandedTasks[index] === false ? true : false }))}
                                className="text-[12px] font-mono text-[#2563eb] hover:text-[#1d4ed8] font-bold w-4 h-4 flex items-center justify-center rounded transition-colors shrink-0"
                              >
                                {expandedTasks[index] !== false ? '▼' : '▶'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTaskIndexForAddSubPoint(index);
                                  setNewSubItemData({ name: '', targetDate: '' });
                                  setIsAddSubItemModalOpen(true);
                                }}
                                className="w-4 h-4 rounded bg-white hover:bg-[#dbeafe] text-[#2563eb] border border-[#bfdbfe] font-bold flex items-center justify-center transition-all shadow-sm shrink-0 text-[10px]"
                                title="Add Sub Item"
                              >
                                +
                              </button>
                              <div className="flex-1 grid">
                                <textarea
                                  value={task.title}
                                  readOnly={!task.isNew || task.status === 'complete' || task.status === 'not_applicable'}
                                  rows={1}
                                  onChange={(e) => {
                                    if (!task.isNew || task.status === 'complete' || task.status === 'not_applicable') return;
                                    const updated = { ...subTasksData };
                                    updated.subTasks[index].title = e.target.value;
                                    setSubTasksData(updated);
                                  }}
                                  title={task.isNew ? "Click to edit activity name" : undefined}
                                  className={`col-start-1 row-start-1 bg-transparent outline-none rounded px-1.5 py-0.5 -ml-1.5 text-xs w-full transition-colors resize-none overflow-hidden ${
                                    task.isNew ? "border border-dashed border-gray-300 hover:border-gray-400 focus:border-[#2563eb] focus:border-solid" : "border border-transparent pointer-events-none"
                                  } ${
                                    isCompleted
                                      ? (task.status === 'not_applicable' ? 'text-gray-400' : 'text-[#10b981] font-bold')
                                      : 'text-[#0f172a] font-bold'
                                  }`}
                                />
                                <div className={`col-start-1 row-start-1 invisible whitespace-pre-wrap px-1.5 py-0.5 -ml-1.5 text-xs w-full break-words ${
                                  isCompleted ? (task.status === 'not_applicable' ? 'text-gray-400' : 'font-bold') : 'font-bold'
                                }`}>
                                  {task.title + ' '}
                                </div>
                              </div>
                            </div>

                            {/* REVISION */}
                            <div className="w-[80px] shrink-0 text-center hidden lg:block cursor-pointer hover:bg-white p-1 rounded transition-colors" onClick={() => setExpandedHistoryTasks(prev => ({ ...prev, [index]: !prev[index] }))} title="View History">
                              {!hasSubPoints && task.revisions && task.revisions.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-bold text-[#2563eb]">{task.revisions[task.revisions.length - 1].revisionNumber}</span>
                                  <span className="text-[9px] text-[#64748b]">({task.revisions.length} total)</span>
                                </div>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </div>

                            {/* START DATE */}
                            <div className="w-[110px] shrink-0 text-center hidden md:block">
                              <input
                                type="date"
                                value={task.startDate || ''}
                                readOnly={task.status === 'complete' || task.status === 'not_applicable'}
                                onChange={(e) => {
                                  if (task.status === 'complete' || task.status === 'not_applicable') return;
                                  const updated = { ...subTasksData };
                                  updated.subTasks[index].startDate = e.target.value;
                                  setSubTasksData(updated);
                                }}
                                className="bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2563eb]/50 outline-none rounded px-1.5 py-0.5 text-xs text-[#0f172a] font-mono text-center w-full"
                              />
                            </div>

                            {/* TARGET DATE */}
                            <div className="w-[110px] shrink-0 text-center hidden md:block">
                              <input
                                type="date"
                                value={task.targetDate || ''}
                                readOnly={task.status === 'complete' || task.status === 'not_applicable'}
                                disabled={!task.startDate}
                                onClick={(e) => {
                                  if (!task.startDate) {
                                    alert("Please select the Start Date before selecting the Target Date.");
                                  }
                                }}
                                onChange={(e) => {
                                  if (task.status === 'complete' || task.status === 'not_applicable') return;
                                  if (!task.startDate) {
                                    alert("Please select the Start Date before selecting the Target Date.");
                                    return;
                                  }
                                  handleUpdateCheckPointTargetDate(index, e.target.value);
                                }}
                                className="bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2563eb]/50 outline-none rounded px-1.5 py-0.5 text-xs text-[#0f172a] font-mono text-center w-full"
                              />
                            </div>

                            {/* STATUS */}
                            <div className="w-[110px] shrink-0 flex justify-center hidden sm:flex">
                              <button
                                type="button"
                                onClick={() => handleToggleCheckPointStatus(index, task.status === 'pending' || !task.status ? 'in_progress' : task.status === 'in_progress' ? 'complete' : task.status === 'complete' ? 'not_applicable' : 'pending')}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                                  task.status === 'complete' ? 'bg-[#d1fae5] text-[#059669] border-[#10b981]/30 hover:bg-[#a7f3d0]' :
                                  task.status === 'in_progress' ? 'bg-[#fef3c7] text-[#d97706] border-[#f59e0b]/30 hover:bg-[#fde68a]' :
                                  task.status === 'not_applicable' ? 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1] hover:bg-[#e2e8f0]' :
                                  'bg-white text-[#94a3b8] border-[#e2e8f0] hover:bg-[#f8fafc]'
                                }`}
                                title="Click to cycle status"
                              >
                                {task.status === 'complete' ? '🟢 Complete' :
                                 task.status === 'in_progress' ? '🟡 In Progress' :
                                 task.status === 'not_applicable' ? '⚪ N/A' : 'Pending'}
                              </button>
                            </div>

                            {/* UPDATED BY */}
                            <div className="w-[130px] shrink-0 text-center hidden xl:block">
                               <span className="text-[10px] text-[#475569] font-bold truncate block px-1" title={task.completedBy || task.untickedBy || '-'}>
                                 {task.completedBy || task.untickedBy || '-'}
                               </span>
                            </div>

                            {/* LAST UPDATE */}
                            <div className="w-[90px] shrink-0 text-center hidden xl:block">
                               <span className="text-[10px] text-[#64748b] font-mono">
                                 {task.completedDate ? task.completedDate.split(',')[0] : (task.untickedDate ? task.untickedDate.split(',')[0] : '-')}
                               </span>
                            </div>

                            {/* ACTIONS */}
                            <div className="w-[180px] shrink-0 flex items-center justify-end gap-1.5">
                              {!hasSubPoints && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTaskIndexForRevision(index);
                                    setSelectedSubTaskIndexForRevision(null);
                                    setNewRevisionData({ revisionNumber: '', dateReceived: '', remarks: '' });
                                    setIsAddRevisionModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-white text-[#2563eb] hover:bg-[#dbeafe] rounded-lg border border-[#bfdbfe] text-[10px] font-bold transition-colors shadow-sm"
                                >
                                  + Rev
                                </button>
                              )}
                              {isDelayed && (
                                <button
                                  type="button"
                                  onClick={() => handleAddDelayReason(index)}
                                  className="px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg border border-red-200 text-[10px] font-bold transition-colors shadow-sm whitespace-nowrap"
                                  title="Add Delay Reason"
                                >
                                  Delay Rsn
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedHistoryTasks(prev => ({ ...prev, [index]: !prev[index] }))}
                                className="px-2.5 py-1 bg-white text-[#475569] hover:bg-[#f8fafc] rounded-lg border border-[#cbd5e1] text-[10px] font-bold transition-colors shadow-sm"
                                title="View History"
                              >
                                History
                              </button>

                              {(task.isNew || user?.role === 'manager') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this activity?')) {
                                      logActivity('Activity Deleted', { activity: task.title, stage_name: selectedStageForSubTasks.stage_name });
                                      const updated = { ...subTasksData };
                                      updated.subTasks.splice(index, 1);
                                      setSubTasksData(updated);
                                    }
                                  }}
                                  className="text-[#ef4444] hover:text-[#b91c1c] p-1.5 rounded-lg hover:bg-[#fef2f2] transition-colors"
                                  title="Delete Activity"
                                >
                                  ❌
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded History Section */}
                          {expandedHistoryTasks[index] && (() => {
                            const aggregatedHistory: any[] = [];
                            
                            if (task.logs) {
                              task.logs.forEach((log: any, lIdx: number) => {
                                aggregatedHistory.push({ dateTime: log.date, point: task.title, action: log.status, user: log.by, timestamp: parseSafeDate(log.date).getTime(), isSubPoint: false, isRevision: false, remarks: log.remark, taskIndex: index, spIndex: -1, itemIndex: lIdx });
                              });
                            }
                            if (task.revisions) {
                              task.revisions.forEach((rev: any, rIdx: number) => {
                                aggregatedHistory.push({ dateTime: rev.dateReceived, point: task.title, action: `Revision ${rev.revisionNumber} Added`, user: rev.uploadedBy, timestamp: parseSafeDate(rev.dateReceived).getTime(), isSubPoint: false, isRevision: true, remarks: rev.remarks, taskIndex: index, spIndex: -1, itemIndex: rIdx });
                              });
                            }
                            
                            aggregatedHistory.sort((a, b) => b.timestamp - a.timestamp);
                            
                            const displayHistory = aggregatedHistory;

                            return (
                              <div className="mt-3 pl-[46px] pr-4 pb-2 border-t border-[#93c5fd]/10 pt-4 bg-[#f8fafc] rounded-b-xl -mx-4 px-4 shadow-inner">
                                <div className="flex justify-between items-end mb-3">
                                  <div className="flex items-center gap-4">
                                    <h4 className="text-[11px] font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2">
                                      <svg className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                      Activity History
                                    </h4>
                                  </div>
                                  {!hasSubPoints && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTaskIndexForRevision(index);
                                        setSelectedSubTaskIndexForRevision(null);
                                        setNewRevisionData({ revisionNumber: '', dateReceived: '', remarks: '' });
                                        setIsAddRevisionModalOpen(true);
                                      }}
                                      className="px-2.5 py-1.5 bg-[#2563eb] text-white hover:bg-[#1d4ed8] rounded-lg border border-[#1e40af] text-[9px] font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add Revision
                                    </button>
                                  )}
                                </div>

                                <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm mb-4">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0]">
                                        <th className="py-2.5 px-4 w-[140px]">Date & Time</th>
                                        <th className="py-2.5 px-4 w-[200px]">Point</th>
                                        <th className="py-2.5 px-4">Action</th>
                                        <th className="py-2.5 px-4 w-[120px]">User</th>
                                        <th className="py-2.5 px-4 w-[50px]"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {displayHistory.length > 0 ? (
                                        displayHistory.map((h: any, rIdx: number) => (
                                          <tr key={rIdx} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc] transition-colors text-[11px]">
                                            <td className="py-2.5 px-4 text-[#475569] whitespace-nowrap">{h.dateTime}</td>
                                            <td className="py-2.5 px-4 font-medium text-[#0f172a]">{h.point}</td>
                                            <td className="py-2.5 px-4 text-[#475569]">
                                              <span className={h.isRevision ? "font-bold text-[#2563eb]" : ""}>{h.action}</span>
                                              {h.remarks && <span className="text-[#64748b] text-[10px] block mt-0.5">{h.remarks}</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[#64748b] truncate font-medium">{h.user || '-'}</td>
                                            <td className="py-2.5 px-4 text-center">
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={5} className="py-6 px-4 text-center text-[11px] text-[#94a3b8] italic">
                                            No history recorded yet.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Expanded Sub Points Section */}
                          {expandedTasks[index] !== false && hasSubPoints && (
                            <div className="mt-3 pl-[46px] pr-4 pb-2 border-t border-[#93c5fd]/10 pt-4 bg-white rounded-b-xl -mx-4 px-4 shadow-inner">
                              {/* Backwards Compatibility for Old Sub-Points */}
                              <div>
                                  <h4 className="text-[11px] font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                    Sub-Items
                                  </h4>
                                  <div className="flex flex-col border border-[#e2e8f0] rounded-xl overflow-hidden bg-white mb-2">
                                    {task.subPoints.map((subPoint: any, spIndex: number) => {
                                      const isSpCompleted = subPoint.status === 'complete' || subPoint.status === 'not_applicable';
                                      const isSpAllowedToComplete = user?.role === 'team_leader' || user?.role === 'team_member';
                                      const isSpDelayed = isTaskDelayed(subPoint.targetDate, subPoint.status);

                                      return (
                                        <div key={spIndex} className={`flex flex-col border-b border-[#e2e8f0] last:border-b-0 group/sub ${isSpDelayed ? 'bg-red-50' : ''}`}>
                                          <div className={`flex flex-wrap lg:flex-nowrap items-center gap-4 py-2.5 px-4 transition-colors ${isSpDelayed ? 'hover:bg-red-100' : 'hover:bg-[#f8fafc]'}`}>
                                            {/* ID */}
                                            <div className="w-[30px] shrink-0 flex justify-center">
                                              <div className="w-5 h-5 rounded-full bg-[#f1f5f9] text-[#475569] font-bold flex items-center justify-center text-[9px]">
                                                {index + 1}.{spIndex + 1}
                                              </div>
                                            </div>

                                            {/* ACTIVITY / CHECKPOINT */}
                                            <div className="flex-1 min-w-[200px] grid">
                                              <textarea
                                                value={subPoint.title}
                                                readOnly={!subPoint.isNew || isSpCompleted}
                                                rows={1}
                                                onChange={(e) => {
                                                  if (!subPoint.isNew || isSpCompleted) return;
                                                  const updated = { ...subTasksData };
                                                  updated.subTasks[index].subPoints[spIndex].title = e.target.value;
                                                  setSubTasksData(updated);
                                                }}
                                                title={subPoint.isNew ? "Click to edit sub-item name" : undefined}
                                                className={`col-start-1 row-start-1 bg-transparent outline-none rounded px-1.5 py-0.5 -ml-1.5 text-[11px] w-full transition-colors resize-none overflow-hidden ${
                                                  subPoint.isNew ? "border border-dashed border-gray-300 hover:border-gray-400 focus:border-[#2563eb] focus:border-solid" : "border border-transparent pointer-events-none"
                                                } ${
                                                  subPoint.status === 'complete'
                                                    ? 'text-[#10b981] font-bold'
                                                    : subPoint.status === 'not_applicable'
                                                    ? 'text-gray-500'
                                                    : 'text-[#0f172a] font-bold'
                                                }`}
                                              />
                                              <div className={`col-start-1 row-start-1 invisible whitespace-pre-wrap px-1.5 py-0.5 -ml-1.5 text-[11px] w-full break-words ${
                                                  subPoint.status === 'complete' || (subPoint.status !== 'not_applicable') ? 'font-bold' : ''
                                                }`}>
                                                {subPoint.title + ' '}
                                              </div>
                                            </div>

                                            {/* REVISION */}
                                            <div className="w-[80px] shrink-0 text-center hidden lg:block cursor-pointer hover:bg-white p-1 rounded transition-colors" onClick={() => setExpandedHistoryTasks(prev => ({ ...prev, [`${index}-${spIndex}`]: !prev[`${index}-${spIndex}`] }))} title="View History">
                                              {subPoint.revisions && subPoint.revisions.length > 0 ? (
                                                <div className="flex flex-col items-center">
                                                  <span className="text-[11px] font-bold text-[#2563eb]">{subPoint.revisions[subPoint.revisions.length - 1].revisionNumber}</span>
                                                  <span className="text-[9px] text-[#64748b]">({subPoint.revisions.length} total)</span>
                                                </div>
                                              ) : (
                                                <span className="text-gray-300">-</span>
                                              )}
                                            </div>

                                            {/* START DATE - BLANK */}
                                            <div className="w-[110px] shrink-0 hidden md:block"></div>

                                            {/* TARGET DATE */}
                                            <div className="w-[110px] shrink-0 text-center hidden md:block">
                                              <input
                                                type="date"
                                                value={subPoint.targetDate || ''}
                                                onChange={(e) => handleUpdateSubPointTargetDate(index, spIndex, e.target.value)}
                                                className="bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2563eb]/50 outline-none rounded px-1.5 py-0.5 text-[10px] text-[#64748b] font-mono text-center w-full transition-colors"
                                              />
                                            </div>

                                            {/* STATUS */}
                                            <div className="w-[110px] shrink-0 flex justify-center hidden sm:flex">
                                              <button
                                                type="button"
                                                onClick={() => handleToggleSubPointStatus(index, spIndex, subPoint.status === 'pending' || !subPoint.status ? 'in_progress' : subPoint.status === 'in_progress' ? 'complete' : subPoint.status === 'complete' ? 'not_applicable' : 'pending')}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                                                  subPoint.status === 'complete' ? 'bg-[#d1fae5] text-[#059669] border-[#10b981]/30 hover:bg-[#a7f3d0]' :
                                                  subPoint.status === 'in_progress' ? 'bg-[#fef3c7] text-[#d97706] border-[#f59e0b]/30 hover:bg-[#fde68a]' :
                                                  subPoint.status === 'not_applicable' ? 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1] hover:bg-[#e2e8f0]' :
                                                  'bg-white text-[#94a3b8] border-[#e2e8f0] hover:bg-[#f8fafc]'
                                                }`}
                                                title="Click to cycle status"
                                              >
                                                {subPoint.status === 'complete' ? '🟢 Complete' :
                                                 subPoint.status === 'in_progress' ? '🟡 In Progress' :
                                                 subPoint.status === 'not_applicable' ? '⚪ N/A' : 'Pending'}
                                              </button>
                                            </div>

                                            {/* UPDATED BY */}
                                            <div className="w-[130px] shrink-0 text-center hidden xl:block">
                                               <span className="text-[10px] text-[#475569] font-bold truncate block px-1" title={subPoint.completedBy || subPoint.untickedBy || '-'}>
                                                 {subPoint.completedBy || subPoint.untickedBy || '-'}
                                               </span>
                                            </div>

                                            {/* LAST UPDATE */}
                                            <div className="w-[90px] shrink-0 text-center hidden xl:block">
                                               <span className="text-[10px] text-[#64748b] font-mono">
                                                 {subPoint.completedDate ? subPoint.completedDate.split(',')[0] : (subPoint.untickedDate ? subPoint.untickedDate.split(',')[0] : '-')}
                                               </span>
                                            </div>

                                            {/* ACTIONS */}
                                            <div className="w-[180px] shrink-0 flex items-center justify-end gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedTaskIndexForRevision(index);
                                                  setSelectedSubTaskIndexForRevision(spIndex);
                                                  setNewRevisionData({ revisionNumber: '', dateReceived: '', remarks: '' });
                                                  setIsAddRevisionModalOpen(true);
                                                }}
                                                className="px-2 py-1 bg-white text-[#2563eb] hover:bg-[#dbeafe] rounded-lg border border-[#bfdbfe] text-[9px] font-bold transition-colors shadow-sm"
                                                title="Add Sub-item Revision"
                                              >
                                                + Rev
                                              </button>
                                              
                                              {isSpDelayed && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleAddDelayReason(index, spIndex)}
                                                  className="px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg border border-red-200 text-[9px] font-bold transition-colors shadow-sm whitespace-nowrap"
                                                  title="Add Delay Reason"
                                                >
                                                  Delay Rsn
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => setExpandedHistoryTasks(prev => ({ ...prev, [`${index}-${spIndex}`]: !prev[`${index}-${spIndex}`] }))}
                                                className="px-2 py-1 bg-white text-[#475569] hover:bg-[#f8fafc] rounded-lg border border-[#cbd5e1] text-[9px] font-bold transition-colors shadow-sm"
                                                title="View Sub-Point History"
                                              >
                                                History
                                              </button>

                                              {(subPoint.isNew || user?.role === 'manager') && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (confirm('Are you sure you want to delete this sub-item?')) {
                                                      logActivity('Sub-Item Deleted', { 
                                                        sub_item: subPoint.title, 
                                                        activity: task.title, 
                                                        stage_name: selectedStageForSubTasks.stage_name 
                                                      });
                                                      const updated = { ...subTasksData };
                                                      updated.subTasks[index].subPoints.splice(spIndex, 1);
                                                      setSubTasksData(updated);
                                                    }
                                                  }}
                                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                  title="Delete Sub-Item"
                                                >
                                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Sub-Point Dedicated History Section */}
                                          {expandedHistoryTasks[`${index}-${spIndex}`] && (() => {
                                            const subHistory: any[] = [];
                                            
                                            if (subPoint.logs) {
                                              subPoint.logs.forEach((log: any, lIdx: number) => {
                                                subHistory.push({ dateTime: log.date, action: log.status, user: log.by, timestamp: parseSafeDate(log.date).getTime(), isRevision: false, remarks: log.remark, itemIndex: lIdx });
                                              });
                                            }
                                            if (subPoint.revisions) {
                                              subPoint.revisions.forEach((rev: any, rIdx: number) => {
                                                subHistory.push({ dateTime: rev.dateReceived, action: `Revision ${rev.revisionNumber} Added`, user: rev.uploadedBy, timestamp: parseSafeDate(rev.dateReceived).getTime(), isRevision: true, remarks: rev.remarks, itemIndex: rIdx });
                                              });
                                            }
                                            
                                            subHistory.sort((a, b) => b.timestamp - a.timestamp);
                                            
                                            return (
                                              <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-4 shadow-inner">
                                                <div className="flex justify-between items-end mb-3">
                                                  <h4 className="text-[10px] font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    Sub-Item History
                                                  </h4>
                                                </div>

                                                <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                                                  <table className="w-full text-left border-collapse">
                                                    <thead>
                                                      <tr className="bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0]">
                                                        <th className="py-2 px-3 w-[140px]">Date & Time</th>
                                                        <th className="py-2 px-3">Action</th>
                                                        <th className="py-2 px-3 w-[120px]">User</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {subHistory.length > 0 ? (
                                                        subHistory.map((h: any, rIdx: number) => (
                                                          <tr key={rIdx} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc] transition-colors text-[10px]">
                                                            <td className="py-2 px-3 text-[#475569] whitespace-nowrap">{h.dateTime}</td>
                                                            <td className="py-2 px-3 text-[#475569]">
                                                              <span className={h.isRevision ? "font-bold text-[#2563eb]" : ""}>{h.action}</span>
                                                              {h.remarks && <span className="text-[#64748b] text-[9px] block mt-0.5">{h.remarks}</span>}
                                                            </td>
                                                            <td className="py-2 px-3 text-[#64748b] truncate font-medium">{h.user || '-'}</td>
                                                          </tr>
                                                        ))
                                                      ) : (
                                                        <tr>
                                                          <td colSpan={3} className="py-4 px-3 text-center text-[10px] text-[#94a3b8] italic">
                                                            No history recorded yet.
                                                          </td>
                                                        </tr>
                                                      )}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                            </div>
                          )}
                            </div>
                          );
                    })}
                  </div>

                </div>
                ) : (
                <div className="flex flex-col items-center">
                {/* FLOWCHART VIEW */}

 
                  {/* Horizontal row of columns for parallel lines */}
                  <div 
                    ref={flowScrollRef}
                    onMouseDown={handleFlowMouseDown}
                    onMouseLeave={handleFlowMouseLeave}
                    onMouseUp={handleFlowMouseUp}
                    onMouseMove={handleFlowMouseMove}
                    onWheel={handleFlowWheel}
                    className={`flex flex-row gap-4 overflow-x-scroll pb-4 scroll-container-light w-full items-start px-2 ${isDraggingFlow ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                  >
                    {lines.map((line) => {
                      const isLineCompleted = line.progressPercent === 100;
                      const hasLineActive = line.stages.some(s => s.status === 'in_progress');
                      
                      return (
                        <div key={line.lineName} className="flex-shrink-0 w-[11.5rem] lg:w-48 flex flex-col items-center">
                          {/* Line Header Card */}
                          <div className={`w-full bg-white border-2 p-2.5 rounded-2xl flex flex-col gap-2 shadow-md transition-all duration-300 ${
                            isLineCompleted 
                              ? 'border-green-400' 
                              : hasLineActive 
                              ? 'border-orange-400' 
                              : 'border-[#93c5fd]'
                          }`}>
                            <div className="flex flex-col items-center justify-center text-center w-full gap-1">
                              <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
                                <span className="font-semibold text-xs text-[#0f172a] truncate text-left flex-1" title={line.lineName}>
                                  {line.lineName}
                                </span>
                                {isUserAuthorized && (
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => {
                                        setOldLineToRename(line.lineName);
                                        setNewRenameLineName(line.lineName);
                                        setIsRenameLineOpen(true);
                                      }}
                                      className="px-1.5 py-0.5 bg-white border border-[#93c5fd] hover:bg-[#dbeafe] rounded-lg transition-all text-xs"
                                      title="Rename Line"
                                    >
                                      ✏️
                                    </button>
                                    {line.lineName !== 'Main Line' && ['admin', 'manager', 'team_leader'].includes(role || '') && (
                                      <button
                                        onClick={() => {
                                          setLineToDelete(line.lineName);
                                          setIsDeleteLineOpen(true);
                                        }}
                                        className="px-1.5 py-0.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-all text-xs"
                                        title="Delete Line"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-[9px] text-[#64748b] font-semibold">
                                {line.completedCount}/7 Done
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-[#dbeafe] rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isLineCompleted 
                                    ? 'bg-green-500' 
                                    : 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4]'
                                }`} 
                                style={{ width: `${line.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-center text-[#64748b] font-semibold">{line.progressPercent}% Complete</span>
                          </div>

                          {/* Arrow from header to first stage */}
                          <div className="w-full flex flex-col items-center select-none pointer-events-none">
                            <div className={`w-[3px] h-5 transition-colors duration-300 ${
                              isLineCompleted 
                                ? 'bg-green-500' 
                                : hasLineActive
                                ? 'bg-orange-400'
                                : 'bg-[#93c5fd]'
                            }`} />
                            <div className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent transition-colors duration-300 ${
                              isLineCompleted 
                                ? 'border-t-green-500' 
                                : hasLineActive
                                ? 'border-t-orange-400'
                                : 'border-t-[#93c5fd]'
                            }`} />
                          </div>
{/* Vertical stack of small boxes for the line */}
                          <div className="flex flex-col gap-0 w-full">
                            {line.stages.map((stage, stageIdx) => {
                              const status = stage.status;
                              const remarks = stage.remarks || 'No remarks provided.';
                              const lastUpdated = stage.updated_at ? parseSafeDate(stage.updated_at).toLocaleString() : null;
                              const updatedBy = stage.updated_by ? getUserName(stage.updated_by) : null;

                              const isCompleted = status === 'completed';
                              const isInProgress = status === 'in_progress';
                              const isDataCollection = stage.displayName === 'Project Data Collection';

                              return (
                                <React.Fragment key={stage.id}>
                                  <div 
                                    onClick={() => {
                                      if (isUserAuthorized) {
                                        handleOpenSubTasksModal(stage);
                                      }
                                    }}
                                    className={`relative group bg-white border-2 hover:shadow-lg transition-all duration-300 rounded-2xl p-2.5 flex flex-col gap-2 justify-between w-full ${
                                      (isUserAuthorized) ? 'cursor-pointer' : ''
                                    } ${
                                      isCompleted
                                        ? 'border-green-400 shadow-sm'
                                        : isInProgress
                                        ? 'border-orange-400 shadow-sm'
                                        : 'border-[#93c5fd]'
                                    }`}
                                  >
 
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex justify-between items-center">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 bg-[#2563eb] text-white">
                                          {(stageIdx + 1).toString().padStart(2, '0')}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition ${
                                          isCompleted
                                            ? 'bg-green-100 text-green-700'
                                            : isInProgress
                                            ? 'bg-orange-100 text-orange-600'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {isInProgress ? 'In Progress' : isCompleted ? 'Complete' : 'Pending'}
                                        </span>
                                      </div>
 
                                      <div>
                                        <h4 className="font-semibold text-xs text-[#0f172a] leading-snug group-hover:text-[#2563eb] transition-colors duration-200">
                                          {stage.displayName}
                                        </h4>
                                      </div>
 
                                      {(() => {
                                        let progress = getSubTasksProgress(stage.remarks, 8);
                                        if (progress.total === 8 && (!stage.remarks || !stage.remarks.trim().startsWith('{'))) {
                                          if (status === 'completed') {
                                            progress.percent = 100;
                                            progress.completed = progress.total;
                                          } else if (status === 'in_progress') {
                                            progress.percent = 50;
                                            progress.completed = Math.floor(progress.total / 2);
                                          }
                                        } else if (status === 'completed' && progress.percent < 100) {
                                          progress.percent = 100;
                                          progress.completed = progress.total;
                                        }
                                        return (
                                          <div className="bg-white border border-[#93c5fd] rounded-xl p-2.5 flex flex-col gap-1.5 mt-1">
                                            <div className="flex justify-between items-center">
                                              <span className="text-[10px] text-[#64748b] font-semibold">Progress</span>
                                              <span className="text-[10px] font-bold text-[#2563eb]">{progress.percent}% Complete</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-[#dbeafe] rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] rounded-full transition-all duration-500" 
                                                style={{ width: `${progress.percent}%` }}
                                              />
                                            </div>
                                            <span className="text-[9px] text-[#64748b]">{progress.completed}/{progress.total} Tasks Done</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
 
                                  {/* Connector Arrow to next stage in the column */}
                                  {stageIdx < line.stages.length - 1 && (
                                    <div className="flex flex-col items-center select-none pointer-events-none w-full">
                                      <div className={`w-[3px] h-5 transition-colors duration-300 ${
                                        isCompleted 
                                          ? 'bg-green-500' 
                                          : isInProgress
                                          ? 'bg-orange-400'
                                          : 'bg-[#93c5fd]'
                                      }`} />
                                      <div className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent transition-colors duration-300 ${
                                        isCompleted 
                                          ? 'border-t-green-500' 
                                          : isInProgress
                                          ? 'border-t-orange-400'
                                          : 'border-t-[#93c5fd]'
                                      }`} />
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: TEAM MEMBERS REMOVED */}

      {/* TAB: TIMELINE */}
      {activeTab === 'timeline' && (() => {
        // 0. Extract Unique Lines
        const uniqueLines = new Set<string>();
        projectStages.forEach(stage => {
          if (stage.stage_name === 'Project Kickoff Meeting') return;
          const lineName = stage.stage_name.includes(' - ') ? stage.stage_name.split(' - ')[0] : 'Main Line';
          uniqueLines.add(lineName);
        });
        const linesList = Array.from(uniqueLines);

        // 1. Gather all activities
        const allTimelineTasks: any[] = [];
        projectStages.forEach(stage => {
          if (stage.remarks && (stage.remarks.trim().startsWith('{') || stage.remarks.trim().startsWith('['))) {
            try {
              const parsed = JSON.parse(stage.remarks);
              if (parsed && parsed.subTasks) {
                const lineName = stage.stage_name.includes(' - ') ? stage.stage_name.split(' - ')[0] : 'Main Line';
                parsed.subTasks.forEach((task: any, index: number) => {
                  // Ensure date formats
                  const pStart = parseCustomDate(task.startDate);
                  const pEnd = parseCustomDate(task.targetDate);
                  const aStart = parseCustomDate(task.actualStartDate);
                  const aEnd = parseCustomDate(task.completedDate);
                  
                  let delay = 0;
                  if (pEnd && aEnd) {
                    const diffTime = aEnd.getTime() - pEnd.getTime();
                    delay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  } else if (pEnd && !aEnd && new Date() > pEnd) {
                    const diffTime = new Date().getTime() - pEnd.getTime();
                    delay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }
                  
                  allTimelineTasks.push({
                    id: `${stage.stage_name}-${index}`,
                    stageName: stage.stage_name,
                    lineName,
                    taskIndex: index,
                    taskName: task.title,
                    pStart,
                    pEnd,
                    aStart,
                    aEnd,
                    delay,
                    rawStartDate: task.startDate || '',
                    rawTargetDate: task.targetDate || ''
                  });
                });
              }
            } catch (e) {}
          }
        });

        // Determine selected line (default to first available)
        const selectedLine = activeTimelineTab && linesList.includes(activeTimelineTab) 
          ? activeTimelineTab 
          : (linesList[0] || '');

        // Filter tasks for the currently selected line
        const timelineTasks = selectedLine 
          ? allTimelineTasks.filter(t => t.lineName === selectedLine)
          : [];

        // Compute min and max dates
        let minDate = new Date();
        let maxDate = new Date();
        let datesFound = false;

        timelineTasks.forEach(t => {
          [t.pStart, t.pEnd, t.aStart, t.aEnd].forEach(d => {
            if (d && !isNaN(d.getTime())) {
              if (!datesFound) {
                minDate = new Date(d);
                maxDate = new Date(d);
                datesFound = true;
              } else {
                if (d < minDate) minDate = new Date(d);
                if (d > maxDate) maxDate = new Date(d);
              }
            }
          });
        });

        if (!datesFound) {
          minDate = new Date();
          maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + 30);
        }

        // Add some padding (e.g. 1 week before and after)
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 7);

        // Generate daily column headers
        const days: Date[] = [];
        let gridStart = new Date(minDate);
        gridStart.setHours(0, 0, 0, 0);
        // Start on a Monday for clean weekly boundaries
        const dayOfWeek = gridStart.getDay();
        const diff = gridStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        gridStart.setDate(diff);

        let curr = new Date(gridStart);
        while (curr <= maxDate) {
          days.push(new Date(curr));
          curr.setDate(curr.getDate() + 1);
        }
        // Ensure we end on a Sunday
        while (curr.getDay() !== 1) {
          days.push(new Date(curr));
          curr.setDate(curr.getDate() + 1);
        }
        const gridEnd = new Date(curr); // Represents the end of the last day cell

        const totalMs = gridEnd.getTime() - gridStart.getTime();

        // Group days by month for the top header row
        const months: { label: string, colSpan: number }[] = [];
        let currentMonth = '';
        let currentCount = 0;

        days.forEach(d => {
          const mLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
          if (mLabel !== currentMonth) {
            if (currentMonth !== '') {
              months.push({ label: currentMonth, colSpan: currentCount });
            }
            currentMonth = mLabel;
            currentCount = 1;
          } else {
            currentCount++;
          }
        });
        if (currentCount > 0) {
          months.push({ label: currentMonth, colSpan: currentCount });
        }

        const handleExportTimelineExcel = async () => {
          try {
            const ExcelJS: any = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`${selectedLine || 'Timeline'}`);

            // Define Fixed Columns + Day Columns
            const fixedColumns = [
              { header: 'No.', key: 'no', width: 5 },
              { header: 'Task Name', key: 'taskName', width: 40 },
              { header: 'Planned Start', key: 'pStart', width: 15 },
              { header: 'Planned End', key: 'pEnd', width: 15 },
              { header: 'Actual Start', key: 'aStart', width: 15 },
              { header: 'Actual End', key: 'aEnd', width: 15 },
              { header: 'Delay', key: 'delay', width: 8 },
            ];

            const dayColumns = days.map(d => ({
              header: d.getDate().toString(),
              key: d.toISOString(),
              width: 4
            }));

            worksheet.columns = [...fixedColumns, ...dayColumns];

            // Setup Header Rows (Merge Months)
            worksheet.insertRow(1, []);
            worksheet.getRow(1).height = 25;
            worksheet.getRow(2).height = 25;

            // Fixed Headers Row 1 & 2 Merge
            ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
              worksheet.mergeCells(`${col}1:${col}2`);
              const cell = worksheet.getCell(`${col}1`);
              cell.value = fixedColumns.find(c => c.header === worksheet.getColumn(col).header)?.header;
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // slate-700
              cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });

            // Months Row (Row 1)
            let colIndex = 8; // H column
            months.forEach(m => {
              const startCol = worksheet.getColumn(colIndex).letter;
              const endCol = worksheet.getColumn(colIndex + m.colSpan - 1).letter;
              if (m.colSpan > 1) {
                worksheet.mergeCells(`${startCol}1:${endCol}1`);
              }
              const cell = worksheet.getCell(`${startCol}1`);
              cell.value = m.label.toUpperCase();
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { bold: true, size: 10 };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100
              cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
              colIndex += m.colSpan;
            });

            // Days Row (Row 2)
            days.forEach((d, idx) => {
              const colLetter = worksheet.getColumn(8 + idx).letter;
              const cell = worksheet.getCell(`${colLetter}2`);
              cell.value = d.getDate();
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { bold: true, size: 9 };
              
              const isSunday = d.getDay() === 0;
              if (isSunday) {
                cell.font.color = { argb: 'FFDC2626' }; // red-600
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }; // red-50
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // slate-50
              }
              cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });

            // Add Tasks
            timelineTasks.forEach((task, idx) => {
              const rowData: any = {
                no: idx + 1,
                taskName: task.taskName,
                pStart: task.pStart ? task.pStart.toLocaleDateString('en-GB').replace(/\//g, ':') : '-',
                pEnd: task.pEnd ? task.pEnd.toLocaleDateString('en-GB').replace(/\//g, ':') : '-',
                aStart: task.aStart ? task.aStart.toLocaleDateString('en-GB').replace(/\//g, ':') : '-',
                aEnd: task.aEnd ? task.aEnd.toLocaleDateString('en-GB').replace(/\//g, ':') : '-',
                delay: task.delay
              };
              const row = worksheet.addRow(rowData);
              
              // Style Fixed Columns
              ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = { vertical: 'middle' };
                cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}} };
                if (col === 'G' && task.delay > 0) {
                  cell.font = { color: { argb: 'FFDC2626' }, bold: true };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                }
                if (col === 'B' && task.aEnd) {
                  cell.font = { color: { argb: 'FF16A34A' }, bold: true };
                }
              });

              // Color Timeline Grid
              days.forEach((d, dIdx) => {
                const colLetter = worksheet.getColumn(8 + dIdx).letter;
                const cell = row.getCell(colLetter);
                const dayTime = d.getTime();
                
                const isSunday = d.getDay() === 0;
                
                // Helper to strip time
                const stripTime = (dateObj: Date | null | undefined) => {
                  if (!dateObj) return null;
                  const dClone = new Date(dateObj);
                  dClone.setHours(0,0,0,0);
                  return dClone.getTime();
                };

                const pStartT = stripTime(task.pStart);
                const pEndT = stripTime(task.pEnd);
                const aStartT = stripTime(task.aStart);
                const aEndT = stripTime(task.aEnd);

                // Determine Colors
                let bgColor = null;
                
                const actualStartFallbackT = aStartT !== null ? aStartT : pStartT;
                const nowT = stripTime(new Date());
                
                let effectiveEndT = aEndT;
                if (effectiveEndT === null && actualStartFallbackT !== null && nowT !== null) {
                  if (nowT >= actualStartFallbackT) {
                    effectiveEndT = nowT;
                  }
                }

                if (effectiveEndT !== null && actualStartFallbackT !== null) {
                  if (dayTime >= actualStartFallbackT && dayTime <= effectiveEndT) {
                    if (pEndT === null) {
                      bgColor = 'FF22C55E'; // Green
                    } else {
                      if (dayTime > pEndT) {
                        bgColor = 'FFEF4444'; // Red (Delayed)
                      } else {
                        bgColor = 'FF22C55E'; // Green (On Time)
                      }
                    }
                  }
                }

                // Draw Planned if not colored by actual
                if (!bgColor && pStartT !== null && pEndT !== null) {
                  if (dayTime >= pStartT && dayTime <= pEndT) {
                    bgColor = 'FF93C5FD'; // Planned (Light Blue)
                  }
                }
                
                if (bgColor) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                } else if (isSunday) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                }
                
                cell.border = { 
                  top: {style:'thin', color: {argb:'FFE2E8F0'}}, 
                  bottom: {style:'thin', color: {argb:'FFE2E8F0'}},
                  left: {style:'thin', color: {argb:'FFE2E8F0'}},
                  right: {style:'thin', color: {argb:'FFE2E8F0'}}
                };
              });
            });

            // Save File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${project?.project_name || 'Project'}_Timeline_${selectedLine || 'All'}.xlsx`);
            
          } catch (error) {
            console.error('Error generating Excel timeline:', error);
            alert('Failed to generate Excel file.');
          }
        };

        return (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <h2 className="text-sm font-bold text-[#0f172a] font-mono tracking-widest uppercase flex items-center gap-2">
                 <span className="w-1.5 h-3.5 bg-purple-500 inline-block rounded-full animate-pulse" />
                 // PROJECT TIMELINE (GANTT CHART) //
               </h2>
               <div className="flex gap-4 text-[10px] font-mono font-bold uppercase tracking-wider">
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> PLANNED</div>
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> ACTUAL</div>
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded-sm"></div> DELAYED</div>
               </div>
            </div>

            {/* TIMELINE TABS */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                {linesList.map(line => {
                  const isActive = activeTimelineTab === line || (!activeTimelineTab && line === linesList[0]);
                  return (
                    <button
                      key={line}
                      onClick={() => setActiveTimelineTab(line)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-wider transition-colors whitespace-nowrap ${
                        isActive 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {line.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={handleExportTimelineExcel}
                className="flex items-center gap-2 px-4 py-2 ml-4 bg-green-600 text-white rounded-lg text-xs font-bold font-mono tracking-wider hover:bg-green-700 transition-colors shrink-0 shadow-sm"
              >
                <Download className="w-4 h-4" />
                EXPORT EXCEL
              </button>
            </div>

            <div 
              ref={timelineScrollRef}
              className={`w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] bg-white border border-slate-200 rounded-xl shadow-sm custom-scrollbar relative ${isDraggingTimeline ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
              onMouseDown={handleTimelineMouseDown}
              onMouseLeave={handleTimelineMouseLeave}
              onMouseUp={handleTimelineMouseUp}
              onMouseMove={handleTimelineMouseMove}
              onWheel={handleTimelineWheel}
            >
               <div className="flex w-max min-w-full">
                 
                 {/* LEFT SIDE - TABLE (Sticky) */}
                 <div className="w-[500px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col font-mono text-[9px] uppercase tracking-wider text-slate-600 sticky left-0 z-20 drop-shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center border-b border-slate-200 font-bold bg-slate-100 h-[68px] sticky top-0 z-30">
                       <div className="w-[30px] p-2 border-r border-slate-200 text-center">No</div>
                       <div className="flex-1 p-2 border-r border-slate-200">Task Name</div>
                       <div className="w-[120px] p-2 border-r border-slate-200 text-center bg-amber-100 text-amber-800 h-full flex items-center justify-center">Planned Dates</div>
                       <div className="w-[120px] p-2 border-r border-slate-200 text-center bg-green-100 text-green-800 h-full flex items-center justify-center">Actual Dates</div>
                       <div className="w-[50px] p-2 text-center bg-red-100 text-red-800 h-full flex items-center justify-center">Delay</div>
                    </div>
                    {timelineTasks.map((task, idx) => (
                      <div key={task.id} className="flex items-center border-b border-slate-200 hover:bg-slate-100 transition-colors h-10 bg-white">
                        <div className="w-[30px] p-2 border-r border-slate-200 text-center font-bold">{idx + 1}</div>
                        <div className={`flex-1 p-2 border-r border-slate-200 truncate font-bold ${task.aEnd ? 'text-green-600' : 'text-[#0f172a]'}`} title={task.taskName}>{task.taskName}</div>
                        <div className="w-[120px] p-2 border-r border-slate-200 text-center text-[8px]">
                          {task.pStart ? task.pStart.toLocaleDateString('en-GB').replace(/\//g, ':') : '-'} <br/> {task.pEnd ? task.pEnd.toLocaleDateString('en-GB').replace(/\//g, ':') : '-'}
                        </div>
                        <div className="w-[120px] p-2 border-r border-slate-200 text-center text-[8px]">
                          {task.aStart ? task.aStart.toLocaleDateString('en-GB').replace(/\//g, ':') : '-'} <br/> {task.aEnd ? task.aEnd.toLocaleDateString('en-GB').replace(/\//g, ':') : '-'}
                        </div>
                        <div className={`w-[50px] p-2 text-center font-bold ${task.delay > 0 ? 'bg-red-100 text-red-600' : 'text-slate-500'}`}>
                          {task.delay}
                        </div>
                      </div>
                    ))}
                 </div>

                 {/* RIGHT SIDE - GANTT CHART */}
                 <div className="flex flex-col relative bg-white" style={{ width: `${days.length * 30}px` }}>
                    {/* Header: Months & Days */}
                    <div className="flex flex-col border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                       {/* Months Row */}
                       <div className="flex border-b border-slate-200 h-[34px]">
                         {months.map((m, i) => (
                           <div key={i} className="flex items-center justify-center border-r border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-widest" style={{ width: `${m.colSpan * 30}px`, minWidth: `${m.colSpan * 30}px` }}>
                             {m.label}
                           </div>
                         ))}
                       </div>
                       {/* Days Row */}
                       <div className="flex h-[34px]">
                         {days.map((d, i) => {
                           const isSunday = d.getDay() === 0;
                           return (
                             <div key={i} className={`flex flex-col items-center justify-center border-r border-slate-200 text-[9px] font-mono font-bold w-[30px] min-w-[30px] shrink-0 ${isSunday ? 'bg-red-50 text-red-600' : 'text-slate-500'}`}>
                               <span>{d.getDate()}</span>
                               <span className="text-[7px]">{d.toLocaleString('default', { weekday: 'narrow' })}</span>
                             </div>
                           );
                         })}
                       </div>
                    </div>

                    {/* Chart Body */}
                    <div className="relative flex-1 min-h-[100px]">
                      {/* Vertical Grid Lines mapping to days */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((d, i) => {
                          const isSunday = d.getDay() === 0;
                          const isMonday = d.getDay() === 1;
                          const isMonthStart = d.getDate() === 1;
                          return (
                            <div 
                              key={i} 
                              className={`w-[30px] min-w-[30px] shrink-0 border-r ${isMonthStart ? 'border-slate-400' : isMonday ? 'border-slate-300' : 'border-slate-100'} ${isSunday ? 'bg-red-50/50' : ''}`} 
                            />
                          );
                        })}
                      </div>

                      {/* Bars */}
                      <div className="relative w-full z-10 flex flex-col">
                        {timelineTasks.map((task, idx) => {
                          
                          const getStyle = (start: Date | null, end: Date | null) => {
                             if (!start || !end) return { display: 'none' };
                             let startT = start.getTime();
                             let endT = end.getTime();
                             if (endT < startT) endT = startT;
                             
                             // Limit to grid bounds
                             startT = Math.max(gridStart.getTime(), startT);
                             endT = Math.min(gridEnd.getTime(), endT);

                             const leftPct = ((startT - gridStart.getTime()) / totalMs) * 100;
                             const widthPct = ((endT - startT) / totalMs) * 100;
                             return {
                               left: `${leftPct}%`,
                               width: `${Math.max(0.5, widthPct)}%`
                             };
                          };

                          return (
                            <div key={task.id} className="h-10 border-b border-slate-200 relative flex flex-col justify-center gap-0.5 px-2 hover:bg-slate-50/50 transition-colors">
                               {/* Planned Bar */}
                               {task.pStart && task.pEnd && (
                                 <div 
                                   className="absolute h-[10px] bg-blue-500 rounded-sm shadow-sm"
                                   style={{ ...getStyle(task.pStart, task.pEnd), top: '7px' }}
                                   title={`Planned: ${task.pStart.toLocaleDateString('en-GB').replace(/\//g, ':')} to ${task.pEnd.toLocaleDateString('en-GB').replace(/\//g, ':')}`}
                                 />
                               )}
                               {/* Actual/Progress Bars */}
                               {(task.aEnd || task.aStart || task.pStart) && (() => {
                                  const start = task.aStart || task.pStart;
                                  if (!start) return null;

                                  const now = new Date();
                                  now.setHours(0, 0, 0, 0);
                                  const startMs = new Date(start).setHours(0, 0, 0, 0);

                                  let effectiveEnd = task.aEnd;
                                  if (!effectiveEnd) {
                                    if (now.getTime() >= startMs) {
                                      effectiveEnd = now;
                                    } else {
                                      return null; // Not started and current date is before start date
                                    }
                                  }
                                  
                                  if (!task.pEnd) {
                                    return (
                                      <div 
                                        className="absolute h-[10px] bg-green-500 rounded-sm shadow-sm"
                                        style={{ ...getStyle(start, effectiveEnd), top: '23px' }}
                                        title={`Progress: ${start.toLocaleDateString('en-GB').replace(/\//g, ':')} to ${effectiveEnd.toLocaleDateString('en-GB').replace(/\//g, ':')}`}
                                      />
                                    );
                                  }
                                  
                                  const onTimeEnd = new Date(Math.min(task.pEnd.getTime(), effectiveEnd.getTime()));
                                  const delayedStart = new Date(Math.max(start.getTime(), task.pEnd.getTime()));
                                  const isDelayed = effectiveEnd.getTime() > task.pEnd.getTime();
                                  
                                  return (
                                    <>
                                      {/* Green portion (On Time) */}
                                      {start.getTime() <= task.pEnd.getTime() && (
                                        <div 
                                          className="absolute h-[10px] bg-green-500 rounded-sm shadow-sm"
                                          style={{ ...getStyle(start, onTimeEnd), top: '23px' }}
                                          title={`Progress (On Time): ${start.toLocaleDateString('en-GB').replace(/\//g, ':')} to ${onTimeEnd.toLocaleDateString('en-GB').replace(/\//g, ':')}`}
                                        />
                                      )}
                                      
                                      {/* Red portion (Delayed) */}
                                      {isDelayed && (
                                        <div 
                                          className="absolute h-[10px] bg-red-500 rounded-sm shadow-sm"
                                          style={{ ...getStyle(delayedStart, effectiveEnd), top: '23px' }}
                                          title={`Progress (Delayed): ${delayedStart.toLocaleDateString('en-GB').replace(/\//g, ':')} to ${effectiveEnd.toLocaleDateString('en-GB').replace(/\//g, ':')}`}
                                        />
                                      )}
                                    </>
                                  );
                               })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                 </div>

               </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: TASKS (For Manager and TL) */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-6">
          {/* TASKS STATS */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Total Tasks</span>
              <span className="text-2xl font-bold text-[#2563eb] font-mono leading-none">{tasks.length}</span>
            </div>
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Pending Tasks</span>
              <span className="text-2xl font-bold text-[#f59e0b] font-mono leading-none">{tasks.filter(t => t.status !== 'closed' && t.status !== 'approved_by_manager').length}</span>
            </div>
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Completed Tasks</span>
              <span className="text-2xl font-bold text-[#10b981] font-mono leading-none">{tasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length}</span>
            </div>
          </div>
          {/* PENDING MANAGER APPROVALS ROW (Visible only to Manager) */}
          {(role === 'manager') && tasks.filter(t => t.status === 'approved_by_tl').length > 0 && (
            <div 
              className="relative bg-amber-50 border border-amber-300 p-5 rounded-xl flex flex-col gap-4 shadow-sm overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-400" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400" />

              <h2 className="font-bold text-xs font-mono text-amber-600 flex items-center gap-2 uppercase tracking-widest">
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                // PENDING MANAGER VERIFICATION ({tasks.filter(t => t.status === 'approved_by_tl').length}) //
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {tasks.filter(t => t.status === 'approved_by_tl').map(task => (
                  <div key={task.id} className="relative bg-white border border-amber-200 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono shadow-sm">
                    <div>
                      <h4 className="font-bold text-amber-900 tracking-wide uppercase">{task.title}</h4>
                      <p className="text-amber-700 mt-1 leading-relaxed text-[11px]">{task.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2.5 text-slate-500 text-[9px] uppercase tracking-wider">
                        <span>OWNER: <strong className="text-[#2563eb] font-bold">{getUserName(task.assigned_to)}</strong></span>
                        <span>TL_REV: <strong className="text-purple-600 font-bold">{getUserName(project.assigned_team_leader_id)}</strong></span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleManagerReview(task.id, 'approve')}
                        className="bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Approve & Close
                      </button>
                      <button
                        onClick={() => handleManagerReview(task.id, 'rework')}
                        className="bg-orange-100 hover:bg-orange-600 text-orange-700 hover:text-white border border-orange-300 hover:border-orange-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Send Back Rework
                      </button>
                      <button
                        onClick={() => handleManagerReview(task.id, 'reject')}
                        className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white border border-red-300 hover:border-red-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PENDING TL REVIEWS ROW (Visible only to Team Leader) */}
          {role === 'team_leader' && tasks.filter(t => t.status === 'completed_by_member').length > 0 && (
            <div 
              className="relative bg-purple-50 border border-purple-300 p-5 rounded-xl flex flex-col gap-4 shadow-sm overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-purple-400" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-purple-400" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-purple-400" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-purple-400" />

              <h2 className="font-bold text-xs font-mono text-purple-600 flex items-center gap-2 uppercase tracking-widest">
                <AlertOctagon className="w-4 h-4 text-purple-500 animate-pulse" />
                // PENDING LEADER VERIFICATION ({tasks.filter(t => t.status === 'completed_by_member').length}) //
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {tasks.filter(t => t.status === 'completed_by_member').map(task => (
                  <div key={task.id} className="relative bg-white border border-purple-200 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono shadow-sm">
                    <div>
                      <h4 className="font-bold text-purple-900 tracking-wide uppercase">{task.title}</h4>
                      <p className="text-purple-700 mt-1 leading-relaxed text-[11px]">{task.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2.5 text-slate-500 text-[9px] uppercase tracking-wider">
                        <span>OWNER: <strong className="text-[#2563eb] font-bold">{getUserName(task.assigned_to)}</strong></span>
                        <span>WORKFLOW: <strong className="text-purple-600 font-bold">{task.assigned_by_role === 'manager' ? 'A (MANAGER TASK)' : 'B (TL TASK)'}</strong></span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'approve')}
                        className="bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'rework')}
                        className="bg-orange-100 hover:bg-orange-600 text-orange-700 hover:text-white border border-orange-300 hover:border-orange-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Rework
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'reject')}
                        className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white border border-red-300 hover:border-red-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILTERS ROW */}
          <div className="relative bg-white border border-[#93c5fd] p-4 rounded-xl flex flex-wrap gap-5 items-center text-xs font-mono shadow-sm">
            <span className="font-bold text-[#2563eb] uppercase tracking-widest">// FILTER CONSOLE //</span>
            
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">STATUS</label>
              <select 
                value={taskStatusFilter} 
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="bg-slate-50 border border-[#93c5fd] rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-[#0f172a] outline-none focus:border-[#2563eb]/50 focus:shadow-[0_0_8px_rgba(37,99,235,0.1)] transition-all duration-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed_by_member">Completed by Member</option>
                <option value="approved_by_tl">Approved by TL</option>
                <option value="rework_required">Rework Required</option>
                <option value="closed">Closed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">PRIORITY</label>
              <select 
                value={taskPriorityFilter} 
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="bg-slate-50 border border-[#93c5fd] rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-[#0f172a] outline-none focus:border-[#2563eb]/50 focus:shadow-[0_0_8px_rgba(37,99,235,0.1)] transition-all duration-200"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">ASSIGNEE</label>
              <select 
                value={taskAssigneeFilter} 
                onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                className="bg-slate-50 border border-[#93c5fd] rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-[#0f172a] outline-none focus:border-[#2563eb]/50 focus:shadow-[0_0_8px_rgba(37,99,235,0.1)] transition-all duration-200"
              >
                <option value="all">All Assignees</option>
                <option value={project.assigned_team_leader_id || ''}>{getUserName(project.assigned_team_leader_id)} (TL)</option>
                {projectMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ALL TASKS TABLE */}
          <div className="relative bg-white border border-[#93c5fd] p-5 rounded-xl shadow-sm overflow-hidden">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#2563eb]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#2563eb]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#2563eb]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#2563eb]/40 rounded-br" />

            <h2 className="font-bold text-xs text-[#0f172a] font-mono tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1 h-3 bg-[#2563eb] inline-block rounded-full" />
              // TASKS DATA LEDGER //
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#93c5fd] text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3.5 px-4">// TASK TITLE</th>
                    <th className="py-3.5 px-4">ASSIGNEE</th>
                    <th className="py-3.5 px-4">ASSIGNER</th>
                    <th className="py-3.5 px-4">PRIORITY</th>
                    <th className="py-3.5 px-4">DUE DATE</th>
                    <th className="py-3.5 px-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  {filteredTasks.map(task => (
                    <tr 
                      key={task.id} 
                      onClick={() => {
                        setSelectedTask(task);
                        setIsTaskDetailsOpen(true);
                      }}
                      className="hover:bg-blue-50 transition-all duration-200 cursor-pointer text-[10.5px] group"
                    >
                      <td className="py-4 px-4 font-bold text-[#0f172a] max-w-xs truncate uppercase tracking-wide group-hover:text-[#2563eb]">{task.title}</td>
                      <td className="py-4 px-4 text-slate-600 font-semibold">{getUserName(task.assigned_to)}</td>
                      <td className="py-4 px-4 text-slate-500">{getUserName(task.assigned_by) || getUserName(project?.created_by)}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getPriorityColorClass(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500">{task.target_date || '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getStatusColorClass(task.status)}`}>
                          {task.status === 'closed' ? 'APPROVED' : task.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 italic">// NO MAPPED DATA MATCHING SEARCH FILTERS //</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MY TASKS (For Team Member) */}
      {activeTab === 'my-tasks' && (
        <div className="flex flex-col gap-6">
          {/* TASKS STATS */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Total Tasks</span>
              <span className="text-2xl font-bold text-[#2563eb] font-mono leading-none">{tasks.length}</span>
            </div>
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Pending Tasks</span>
              <span className="text-2xl font-bold text-[#f59e0b] font-mono leading-none">{tasks.filter(t => t.status !== 'closed' && t.status !== 'approved_by_manager').length}</span>
            </div>
            <div className="bg-white border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Completed Tasks</span>
              <span className="text-2xl font-bold text-[#10b981] font-mono leading-none">{tasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length}</span>
            </div>
          </div>
          <h2 className="text-sm font-bold text-[#0f172a] font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#2563eb] inline-block rounded-full animate-pulse" />
            // PERSONAL OPERATIONS CHECKSHEETS //
          </h2>

          <div className="flex flex-col gap-4">
            {memberFilteredTasks.map(task => {
              return (
                <div 
                  key={task.id} 
                  onClick={() => {
                    setSelectedTask(task);
                    setIsTaskDetailsOpen(true);
                  }}
                  className="relative bg-white border border-slate-200 hover:border-[#93c5fd] p-5 rounded-xl flex flex-wrap justify-between items-center gap-4 transition-all duration-300 group shadow-sm cursor-pointer"
                >
                  {/* Micro L-brackets */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-200 group-hover:border-[#93c5fd] rounded-tl transition" />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-200 group-hover:border-[#93c5fd] rounded-tr transition" />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-200 group-hover:border-[#93c5fd] rounded-bl transition" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-200 group-hover:border-[#93c5fd] rounded-br transition" />

                  <div className="flex-1 min-w-0 font-mono">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getPriorityColorClass(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">TARGET_TX_DEADLINE: {task.target_date || '-'}</span>
                    </div>
                    <h3 className="font-bold text-xs text-[#0f172a] mt-2 group-hover:text-[#2563eb] uppercase tracking-wider transition-colors truncate">{task.title}</h3>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status */}
                    <div className="font-mono">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getStatusColorClass(task.status)}`}>
                        {task.status === 'closed' ? 'APPROVED' : task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563eb] group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              );
            })}
            {memberFilteredTasks.length === 0 && (
              <div className="relative bg-slate-50 border border-dashed border-slate-200 p-8 rounded-xl text-center">
                <p className="text-slate-500 italic font-mono text-xs">// NO PENDING ASSIGNED TASKS IN OPERATIONS BUFFER //</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <div className="flex flex-col gap-6">
          <h2 className="text-sm font-bold text-[#0f172a] font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-emerald-500 inline-block rounded-full animate-pulse" />
            // PROJECT LOGGED ACHIEVEMENTS //
          </h2>

          <div className="flex flex-col gap-4">
            {achievements.map(ach => (
              <div key={ach.id} className="relative bg-white border border-emerald-200 hover:border-emerald-300 p-5 rounded-xl flex flex-col gap-3 text-xs transition-all duration-300 shadow-sm overflow-hidden group">
                {/* Emerald L-brackets */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-300 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-300 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-300 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-300 rounded-br" />
                
                {/* Header */}
                <div className="flex justify-between items-start gap-4 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-[#0f172a] font-mono uppercase tracking-wider group-hover:text-emerald-600 transition-colors">{ach.title}</h3>
                    <span className="text-[9px] text-slate-500 mt-1 block font-mono uppercase tracking-wider">
                      TX_SYS_LOGGED: <strong className="text-slate-700 font-bold">{getUserName(ach.submitted_by)}</strong> ON {new Date(ach.submitted_at).toLocaleDateString('en-GB').replace(/\//g, ':')}
                    </span>
                  </div>
                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold font-mono uppercase border tracking-wider transition ${
                    ach.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    ach.approval_status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                    'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
                  }`}>
                    {ach.approval_status}
                  </span>
                </div>

                {/* Details */}
                <p className="text-slate-600 leading-relaxed text-xs font-mono">{ach.details}</p>

                {ach.attachment_url && (
                  <div className="mt-1 flex items-center gap-1.5 text-blue-600 font-mono text-[9px] uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attachment: {ach.attachment_url}</span>
                  </div>
                )}

                {/* Manager remarks */}
                {ach.manager_remarks && (
                  <div className="relative bg-slate-50 border border-slate-200 p-3 rounded-lg mt-2 max-w-md font-mono text-[10px]">
                    <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-slate-300" />
                    <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-slate-300" />
                    <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-slate-300" />
                    <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-slate-300" />

                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest">// MANAGER FEEDBACK SYS //</span>
                    <p className="text-slate-700 mt-1 leading-normal italic font-semibold">&quot;{ach.manager_remarks}&quot;</p>
                    <span className="text-[8px] text-slate-500 mt-1 block uppercase">REVIEWER: {getUserName(ach.reviewed_by)}</span>
                  </div>
                )}

                {/* Manager Review Action triggers */}
                {(role === 'manager') && ach.approval_status === 'pending' && (
                  <div className="border-t border-white/10 pt-4 mt-2 flex flex-col gap-3 max-w-md text-xs font-mono">
                    <div className="form-group flex flex-col gap-1.5">
                      <label className="text-[8px] text-gray-400 font-bold tracking-widest uppercase">REVIEW EVALUATION REMARKS</label>
                      <input
                        type="text"
                        placeholder="Provide feedback remarks for the team..."
                        value={selectedAchievementId === ach.id ? reviewRemarks : ''}
                        onChange={(e) => {
                          setSelectedAchievementId(ach.id);
                          setReviewRemarks(e.target.value);
                        }}
                        className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 font-mono transition-all"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewAchievement(ach.id, 'approved')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] tracking-widest uppercase transition-all duration-300 active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewAchievement(ach.id, 'rejected')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] tracking-widest uppercase transition-all duration-300 active:scale-95"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
            {achievements.length === 0 && (
              <div className="relative bg-[#090f1d]/40 border border-dashed border-white/10 p-8 rounded-xl text-center">
                <p className="text-gray-500 italic font-mono text-xs">// NO ARCHIVED PROJECT ACHIEVEMENTS LOGGED //</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ISSUES */}
      {activeTab === 'issues' && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-sm font-bold text-[#0f172a] font-mono tracking-widest uppercase flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-red-500 inline-block rounded-full animate-pulse" />
              // SECURE THREAT LOG & RESOLUTIONS //
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {issues.map(iss => {
              const isResolved = iss.status === 'resolved';

              return (
                <div 
                  key={iss.id} 
                  className={`relative bg-white border p-5 rounded-xl flex flex-col gap-3.5 text-xs transition-all duration-300 shadow-sm overflow-hidden ${
                    isResolved ? 'border-emerald-200 hover:border-emerald-300' : 'border-red-200 hover:border-red-300'
                  }`}
                >
                  {/* Status specific L-brackets */}
                  <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l rounded-tl ${isResolved ? 'border-emerald-300' : 'border-red-300'}`} />
                  <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r rounded-tr ${isResolved ? 'border-emerald-300' : 'border-red-300'}`} />
                  <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l rounded-bl ${isResolved ? 'border-emerald-300' : 'border-red-300'}`} />
                  <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r rounded-br ${isResolved ? 'border-emerald-300' : 'border-red-300'}`} />

                  {/* Header */}
                  <div className="flex justify-between items-center gap-4 border-b border-slate-200 pb-2.5">
                    <div>
                      <h3 className="font-bold text-sm text-[#0f172a] font-mono uppercase tracking-wider">{iss.title}</h3>
                      <span className="text-[9px] text-slate-500 mt-1 block font-mono uppercase tracking-wider">
                        TX_SYS_LOGGED: <strong className="text-slate-700 font-bold">{getUserName(iss.raised_by)}</strong> ON {new Date(iss.raised_at).toLocaleDateString('en-GB').replace(/\//g, ':')}
                      </span>
                    </div>
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold font-mono uppercase border tracking-wider transition ${
                      isResolved 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                    }`}>
                      {iss.status}
                    </span>
                  </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[9.5px]">
                  <div>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Reported By</span>
                    <span className="text-[#0f172a] font-bold block mt-0.5 uppercase">{iss.reported_by_name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Occurrence Date</span>
                    <span className="text-[#0f172a] font-bold block mt-0.5">{iss.occurrence_date ? new Date(iss.occurrence_date).toLocaleDateString('en-GB').replace(/\//g, ':') : '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Responsible Person</span>
                    <span className="text-[#0f172a] font-bold block mt-0.5 uppercase">{getUserName(iss.responsible_person_id)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Location (P/L/S)</span>
                    <span className="text-[#0f172a] font-bold block mt-0.5 uppercase text-[#2563eb]">
                      {iss.plant || '-'}{iss.line ? ` / ${iss.line}` : ''}{iss.station ? ` / ${iss.station}` : ''}
                    </span>
                  </div>
                </div>

                {/* Long text fields */}
                <div className="flex flex-col gap-3 font-mono">
                  <div>
                    <span className="block text-[8.5px] text-red-600/70 uppercase tracking-widest">// Issue Description</span>
                    <p className="text-slate-600 leading-relaxed text-xs mt-0.5 font-medium">{iss.description}</p>
                  </div>
                  <div>
                    <span className="block text-[8.5px] text-red-600/70 uppercase tracking-widest">// Condition for Occurrence</span>
                    <p className="text-slate-600 leading-relaxed text-xs mt-0.5 font-medium">{iss.occurrence_condition || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-[8.5px] text-red-600/70 uppercase tracking-widest">// Temporary Action Taken</span>
                    <p className="text-slate-600 leading-relaxed text-xs mt-0.5 font-medium">{iss.temporary_action || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-[8.5px] text-red-600/70 uppercase tracking-widest">// Permanent Countermeasure / Lesson learned</span>
                    <p className="text-slate-600 leading-relaxed text-xs mt-0.5 font-medium">{iss.permanent_countermeasure || '-'}</p>
                  </div>
                </div>

                  {iss.attachment_url && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-blue-600 font-mono text-[9px] uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Attachment: {iss.attachment_url}</span>
                    </div>
                  )}

                  {/* Resolution remarks details */}
                  {iss.resolution_remarks && (
                    <div className="relative bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg mt-2 max-w-md font-mono text-[10px]">
                      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-emerald-300" />
                      <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-emerald-300" />
                      <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-emerald-300" />
                      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-emerald-300" />

                      <span className="block text-[8px] text-emerald-600 font-bold uppercase tracking-widest">// RESOLVED SYSTEM COUNTERMEASURE //</span>
                      <p className="text-[#0f172a] mt-1 leading-normal italic font-semibold">&quot;{iss.resolution_remarks}&quot;</p>
                      <span className="text-[8px] text-slate-500 mt-1 block uppercase">RESOLVED DATE: {iss.occurrence_date ? new Date(iss.occurrence_date).toLocaleDateString('en-GB').replace(/\//g, ':') : 'N/A'}</span>
                    </div>
                  )}

                {/* Resolve Issue Action Button (For Manager & TL when open) */}
                {!isResolved && (role === 'manager' || role === 'team_leader') && (
                  <div className="border-t border-slate-200 pt-3.5 mt-2 flex justify-start">
                    <button
                      onClick={() => {
                        setSelectedIssueId(iss.id);
                        setIsResolveIssueOpen(true);
                      }}
                      className="bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
                    >
                      Mark as Resolved
                    </button>
                  </div>
                )}

                </div>
              );
            })}
            {issues.length === 0 && (
              <div className="relative bg-slate-50 border border-dashed border-slate-200 p-8 rounded-xl text-center">
                <p className="text-slate-500 italic font-mono text-xs">// NO INCIDENT LOGS DETECTED ON OPERATIONS GRIDS //</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PUNCH POINTS */}
      {activeTab === 'punch-points' && (() => {
        const totalPunchPoints = punchPoints.length;
        const openPunchPoints = punchPoints.filter(p => p.status === 'Open').length;
        const closedPunchPoints = punchPoints.filter(p => p.status === 'Closed').length;

        return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 lg:p-6 min-h-[500px]">
          <div className="flex flex-col gap-4 mb-6">
            <h2 className="text-xl font-bold font-heading text-[#0f172a] uppercase tracking-widest flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Punch Points
            </h2>

            {/* KPI CARDS */}
            <div className="grid grid-cols-3 gap-4 mb-2">
              <div className="bg-white border border-[#93c5fd] p-3 rounded-lg flex flex-col items-center justify-center shadow-sm relative overflow-hidden group hover:bg-[#dbeafe] transition-all">
                 <span className="text-[10px] font-bold tracking-widest text-slate-500 mb-1">TOTAL PUNCH POINTS</span>
                 <span className="text-3xl font-black font-mono tracking-tighter text-[#2563eb]">{totalPunchPoints}</span>
              </div>
              <div className="bg-white border border-amber-300 p-3 rounded-lg flex flex-col items-center justify-center shadow-sm relative overflow-hidden group hover:bg-[#dbeafe] transition-all">
                 <span className="text-[10px] font-bold tracking-widest text-slate-500 mb-1">OPEN</span>
                 <span className="text-3xl font-black font-mono tracking-tighter text-amber-600">{openPunchPoints}</span>
              </div>
              <div className="bg-white border border-green-300 p-3 rounded-lg flex flex-col items-center justify-center shadow-sm relative overflow-hidden group hover:bg-[#dbeafe] transition-all">
                 <span className="text-[10px] font-bold tracking-widest text-slate-500 mb-1">CLOSED</span>
                 <span className="text-3xl font-black font-mono tracking-tighter text-green-600">{closedPunchPoints}</span>
              </div>
            </div>
            
            {/* FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line</label>
                <select
                  value={punchPointFilters.line}
                  onChange={(e) => setPunchPointFilters({ ...punchPointFilters, line: e.target.value })}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">All Lines</option>
                  <option value="Common">Common</option>
                  {linesList.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
                <select
                  value={punchPointFilters.status}
                  onChange={(e) => setPunchPointFilters({ ...punchPointFilters, status: e.target.value })}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="WIP">WIP</option>
                  <option value="Closed">Closed</option>
                  <option value="NA">NA</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Raised Date</label>
                <input
                  type="date"
                  value={punchPointFilters.issue_raised_date}
                  onChange={(e) => setPunchPointFilters({ ...punchPointFilters, issue_raised_date: e.target.value })}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Date</label>
                <input
                  type="date"
                  value={punchPointFilters.target_date}
                  onChange={(e) => setPunchPointFilters({ ...punchPointFilters, target_date: e.target.value })}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Closed By</label>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={punchPointFilters.closed_by}
                  onChange={(e) => setPunchPointFilters({ ...punchPointFilters, closed_by: e.target.value })}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                <tr>
                  <th className="p-3">Sr No</th>
                  <th className="p-3">Line</th>
                  <th className="p-3">Station No</th>
                  <th className="p-3">Concern</th>
                  <th className="p-3">Raised Date</th>
                  <th className="p-3">Target Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Closed By</th>
                  <th className="p-3 max-w-[200px]">Remark</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[#0f172a]">
                {punchPointsLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td>
                  </tr>
                ) : (
                  punchPoints.map((p, idx) => ({ ...p, originalIndex: idx + 1 })).filter(p => {
                    if (punchPointFilters.line && p.line !== punchPointFilters.line) return false;
                    if (punchPointFilters.status && p.status !== punchPointFilters.status) return false;
                    if (punchPointFilters.issue_raised_date && p.issue_raised_date !== punchPointFilters.issue_raised_date) return false;
                    if (punchPointFilters.target_date && p.target_date !== punchPointFilters.target_date) return false;
                    if (punchPointFilters.closed_by && !p.closed_by?.toLowerCase().includes(punchPointFilters.closed_by.toLowerCase())) return false;
                    return true;
                  }).map((p) => (
                    <tr 
                      key={p.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setPunchPointFormData(p);
                        setIsPunchPointModalOpen(true);
                      }}
                    >
                      <td className="p-3 font-mono font-bold text-slate-500">{p.originalIndex}</td>
                      <td className="p-3 font-bold">{p.line}</td>
                      <td className="p-3">{p.station_no}</td>
                      <td className="p-3 whitespace-normal min-w-[200px]">{p.concern}</td>
                      <td className="p-3">{(p.issue_raised_date && !p.issue_raised_date.startsWith('1970-01-01')) ? new Date(p.issue_raised_date).toLocaleDateString('en-GB').replace(/\//g, ':') : '-'}</td>
                      <td className="p-3">{(p.target_date && !p.target_date.startsWith('1970-01-01')) ? new Date(p.target_date).toLocaleDateString('en-GB').replace(/\//g, ':') : '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.status?.toLowerCase() === 'closed' ? 'bg-green-100 text-green-700' :
                          p.status?.toLowerCase() === 'open' ? 'bg-amber-100 text-amber-700' :
                          p.status?.toLowerCase() === 'wip' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">{p.closed_by || '-'}</td>
                      <td className="p-3 truncate max-w-[200px]" title={p.remark}>{p.remark}</td>
                      <td className="p-3 flex justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePunchPoint(p.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase font-mono bg-red-50 px-2 py-1 rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {!punchPointsLoading && punchPoints.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500 font-mono text-xs">No punch points found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* TAB: ACTIVITY LOG */}
      {activeTab === 'activity-log' && (
        <div className="relative bg-white border border-[#93c5fd] p-6 rounded-xl shadow-sm overflow-hidden">
          {/* L-brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#2563eb]/50 rounded-tl" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#2563eb]/50 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#2563eb]/50 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#2563eb]/50 rounded-br" />

          <h2 className="text-sm font-bold text-[#0f172a] mb-6 font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#2563eb] inline-block rounded-full animate-pulse" />
            // TELEMETRY CHRONOLOGICAL SYSTEM LOGS //
          </h2>

          <div className="overflow-x-auto max-h-[480px] scroll-container">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#93c5fd] text-slate-500 font-bold uppercase tracking-wider text-[9px] sticky top-0 bg-slate-50 z-10 py-3">
                  <th className="py-3 px-4">// TIMESTAMP</th>
                  <th className="py-3 px-4">SYS_ACTOR</th>
                  <th className="py-3 px-4">SYS_ACTION</th>
                  <th className="py-3 px-4">TX_PAYLOAD_DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition-all duration-200 align-top text-[10.5px]">
                    <td className="py-3.5 px-4 text-emerald-600 font-bold whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap uppercase">
                      {getUserName(log.user_id)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-sm overflow-hidden text-ellipsis leading-relaxed uppercase text-[9.5px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 italic">// SYSTEM LOGSTREAM IS VACANT //</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* --- POPUP MODAL: ASSIGN MEMBER --- */}
      {isAssignMemberOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              // ASSIGN PROJECT MEMBER //
            </h3>
            
            <form onSubmit={handleAssignMember} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">SELECT TEAM MEMBER CANDIDATE</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                >
                  <option value="">Select Candidate</option>
                  {/* Filter candidates that are Team Members and NOT already assigned to this project */}
                  {allUsers
                    .filter(u => 
                      u.role === 'team_member' && 
                      !projectMembers.some(pm => pm.id === u.id) &&
                      (user?.role !== 'team_leader' || myTeamMemberIds.includes(u.id))
                    )
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={memberLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {memberLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Assign Member'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssignMemberOpen(false)}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: ASSIGN TASK --- */}
      {isAssignTaskOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              {role === 'manager' ? '// ASSIGN MANAGER TASK //' : '// ASSIGN TL TASK //'}
            </h3>

            <form onSubmit={handleAssignTask} className="flex flex-col gap-4 text-xs p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ACTIVITY / TITLE</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">DESCRIPTION</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                  {role === 'manager' ? 'ASSIGN TO TEAM LEADER' : 'ASSIGN TO PROJECT MEMBER'}
                </label>
                <select
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                >
                  <option value="">{role === 'manager' ? 'Select Team Leader' : 'Select Project Member'}</option>
                  {role === 'manager' 
                    ? allUsers.filter(u => u.role === 'team_leader').map(tl => (
                        <option key={tl.id} value={tl.id}>{tl.name}</option>
                      ))
                    : projectMembers
                        .filter(member => role !== 'team_leader' || myTeamMemberIds.includes(member.id))
                        .map(member => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))
                  }
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">PRIORITY</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">START DATE</label>
                  <input
                    type="date"
                    value={taskForm.start_date}
                    onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                  />
                </div>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">TARGET DATE</label>
                <input
                  type="date"
                  value={taskForm.target_date}
                  onChange={(e) => setTaskForm({ ...taskForm, target_date: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">REMARKS / GUIDELINES</label>
                <input
                  type="text"
                  placeholder="Additional remarks..."
                  value={taskForm.remarks}
                  onChange={(e) => setTaskForm({ ...taskForm, remarks: e.target.value })}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  type="submit"
                  disabled={taskFormLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {taskFormLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Assign Task'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssignTaskOpen(false)}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: ADD ACHIEVEMENT --- */}
      {isAddAchievementOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              // LOG PROJECT ACHIEVEMENT //
            </h3>

            <form onSubmit={handleSubmitAchievement} className="flex flex-col gap-3.5">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ACHIEVEMENT TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Migration completed early"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">DETAILS</label>
                <textarea
                  placeholder="Summarize the impact and details..."
                  value={achievementForm.details}
                  onChange={(e) => setAchievementForm({ ...achievementForm, details: e.target.value })}
                  rows={3}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ATTACHMENT FILENAME / URL (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. report.pdf"
                  value={achievementForm.attachment_url}
                  onChange={(e) => setAchievementForm({ ...achievementForm, attachment_url: e.target.value })}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="flex gap-3.5 mt-3">
                <button
                  type="submit"
                  disabled={achievementFormLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {achievementFormLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Log Achievement'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddAchievementOpen(false)}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* --- POPUP MODAL: LOG ISSUE & LESSON LEARNED --- */}
      {isRaiseIssueOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-red-500/30 w-full max-w-lg p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* Red L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-500/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-500/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-500/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-500/40 rounded-br" />

            <h3 className="font-bold text-base text-red-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-red-500 inline-block rounded-full animate-pulse" />
              // LOG ISSUE & LESSON LEARNED //
            </h3>

            <form onSubmit={handleRaiseIssue} className="flex flex-col gap-3.5">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ISSUE TITLE / SUMMARY</label>
                <input
                  type="text"
                  placeholder="e.g. Robot collision on line 3"
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ISSUE REPORTED BY</label>
                  <input
                    type="text"
                    placeholder="Reporter's name"
                    value={issueForm.reported_by_name}
                    onChange={(e) => setIssueForm({ ...issueForm, reported_by_name: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  />
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">OCCURRENCE DATE</label>
                  <input
                    type="date"
                    value={issueForm.occurrence_date}
                    onChange={(e) => setIssueForm({ ...issueForm, occurrence_date: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">PLANT</label>
                  <input
                    type="text"
                    placeholder="Plant name/code"
                    value={issueForm.plant}
                    onChange={(e) => setIssueForm({ ...issueForm, plant: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  />
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">LINE</label>
                  <input
                    type="text"
                    placeholder="Line code"
                    value={issueForm.line}
                    onChange={(e) => setIssueForm({ ...issueForm, line: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  />
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">STATION</label>
                  <input
                    type="text"
                    placeholder="Station ID"
                    value={issueForm.station}
                    onChange={(e) => setIssueForm({ ...issueForm, station: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">RESPONSIBLE PERSON</label>
                {project && (
                  <select
                    value={issueForm.responsible_person_id}
                    onChange={(e) => setIssueForm({ ...issueForm, responsible_person_id: e.target.value })}
                    required
                    className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                  >
                    <option value="">Select Candidate ({projectMembers.length + (project.assigned_team_leader_id ? 1 : 0)} available)</option>
                    {project.assigned_team_leader_id && (
                      <option value={project.assigned_team_leader_id}>
                        {getUserName(project.assigned_team_leader_id)}
                      </option>
                    )}
                    {projectMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ISSUE DESCRIPTION</label>
                <textarea
                  placeholder="Explain the incident/issue..."
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  rows={2}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">CONDITION FOR OCCURRENCE OF THE ISSUE</label>
                <textarea
                  placeholder="Describe occurrence conditions (e.g. software state, hardware load)..."
                  value={issueForm.occurrence_condition}
                  onChange={(e) => setIssueForm({ ...issueForm, occurrence_condition: e.target.value })}
                  rows={2}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">TEMPORARY ACTION TAKEN</label>
                <textarea
                  placeholder="Describe immediate/short-term actions..."
                  value={issueForm.temporary_action}
                  onChange={(e) => setIssueForm({ ...issueForm, temporary_action: e.target.value })}
                  rows={2}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">PERMANENT COUNTERMEASURE</label>
                <textarea
                  placeholder="Describe long-term preventive countermeasures/lessons learned..."
                  value={issueForm.permanent_countermeasure}
                  onChange={(e) => setIssueForm({ ...issueForm, permanent_countermeasure: e.target.value })}
                  rows={2}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 resize-none transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ATTACHMENT FILENAME / URL (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. capture.png"
                  value={issueForm.attachment_url}
                  onChange={(e) => setIssueForm({ ...issueForm, attachment_url: e.target.value })}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-red-500/50 transition-all"
                />
              </div>

              <div className="flex gap-3.5 mt-2">
                <button
                  type="submit"
                  disabled={issueFormLoading}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(239,68,68,0.2)] border border-red-500/30"
                >
                  {issueFormLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Log Issue & Lesson'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRaiseIssueOpen(false)}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* --- POPUP MODAL: TASK DETAILS --- */}
      {isTaskDetailsOpen && selectedTask && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-2xl p-6 rounded-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#00f0ff]/40 rounded-br" />

            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap text-[9px] font-bold">
                  <span className={`px-2 py-0.5 rounded uppercase border ${getPriorityColorClass(selectedTask.priority)}`}>
                    {selectedTask.priority} Priority
                  </span>
                  <span className={`px-2 py-0.5 rounded uppercase border ${getStatusColorClass(selectedTask.status)}`}>
                    Status: {selectedTask.status === 'closed' ? 'Approved' : selectedTask.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white uppercase mt-2 tracking-wide flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
                  {selectedTask.title}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsTaskDetailsOpen(false);
                  setSelectedTask(null);
                }}
                className="text-gray-400 hover:text-white transition font-mono font-bold text-xs bg-[#0d1527] border border-slate-700 hover:bg-white/10 px-2 py-1 rounded border border-white/10"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Details Fields Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px] bg-black/45 p-3.5 rounded-lg border border-white/5">
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">ASSIGNED TO</span>
                <span className="text-[#00f0ff] font-bold block mt-0.5 uppercase">{getUserName(selectedTask.assigned_to)}</span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">ASSIGNED BY</span>
                <span className="text-white font-bold block mt-0.5 uppercase">
                  {getUserName(selectedTask.assigned_by) || getUserName(project?.created_by)}
                </span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">TARGET DATE</span>
                <span className="text-white font-bold block mt-0.5">{selectedTask.target_date || '-'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">START DATE</span>
                <span className="text-white font-bold block mt-0.5">{selectedTask.start_date || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">REMARKS / GUIDELINES</span>
                <span className="text-gray-300 block mt-0.5 italic">{selectedTask.remarks || '-'}</span>
              </div>
            </div>

            {/* Description */}
            <div className="text-xs">
              <h4 className="font-bold text-gray-500 uppercase tracking-widest text-[8px] mb-1">// TASK DESCRIPTION //</h4>
              <p className="text-gray-300 leading-relaxed bg-[#0d1527]/50 p-3 rounded border border-white/5">
                {selectedTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Actions Section depending on role */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="font-bold text-gray-500 uppercase tracking-widest text-[8px] mb-2">// ACTIONS OPERATION CHANNEL //</h4>
              
              {/* TM ACTIONS */}
              {role === 'team_member' && selectedTask.assigned_to === user?.id && (
                <div className="flex gap-3">
                  {(selectedTask.status === 'assigned' || selectedTask.status === 'rework_required') && (
                    <button
                      onClick={() => handleStartTask(selectedTask.id)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                    >
                      Start Task
                    </button>
                  )}
                  {selectedTask.status !== 'completed_by_member' && selectedTask.status !== 'closed' && selectedTask.status !== 'approved_by_tl' && (
                    <button
                      onClick={() => handleUpdateTaskStatus(selectedTask.id, true)}
                      className="flex-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    >
                      Mark Completed
                    </button>
                  )}
                  {(selectedTask.status === 'completed_by_member' || selectedTask.status === 'approved_by_tl' || selectedTask.status === 'closed') && (
                    <span className="text-gray-500 italic">// NO ACTIVE ACTIONS REQUIRED. OPERATIONS PENDING VERIFICATION //</span>
                  )}
                </div>
              )}

              {/* TL ACTIONS */}
              {role === 'team_leader' && (
                <div className="flex flex-col gap-3">
                  {/* Task Review actions (if completed by a member) */}
                  {selectedTask.status === 'completed_by_member' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTeamLeaderReview(selectedTask.id, 'approve')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 flex-1"
                      >
                        {selectedTask.assigned_by_role === 'team_leader' ? 'Approve & Close Task' : 'Approve & Submit'}
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(selectedTask.id, 'rework')}
                        className="bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 flex-1"
                      >
                        Rework
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(selectedTask.id, 'reject')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 flex-1"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {/* Task completed/delegated by TL self */}
                  {selectedTask.assigned_to === user?.id && (
                    <div className="flex flex-col gap-3">
                      {selectedTask.status !== 'approved_by_tl' && selectedTask.status !== 'closed' && (
                        <button
                          onClick={() => handleTLMarkCompleted(selectedTask.id)}
                          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_10px_rgba(16,185,129,0.1)] w-full"
                        >
                          Mark Completed (Submit to Manager)
                        </button>
                      )}

                      {/* Delegation options for Manager-assigned task */}
                      {selectedTask.assigned_by_role === 'manager' && selectedTask.status !== 'closed' && (
                        <div className="relative bg-black/45 border border-white/5 p-3.5 rounded-lg flex flex-col gap-2">
                          <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">// Delegate Task to Project Member //</label>
                          <div className="flex gap-2">
                            <select
                              value={delegateMemberId}
                              onChange={(e) => setDelegateMemberId(e.target.value)}
                              className="flex-1 bg-[#0d1527] border border-white/10 rounded-lg text-xs px-2.5 py-1 text-white outline-none"
                            >
                              <option value="">Select Candidate</option>
                              {projectMembers
                                .filter(member => user?.role !== 'team_leader' || myTeamMemberIds.includes(member.id))
                                .map(member => (
                                  <option key={member.id} value={member.id}>{member.name}</option>
                                ))}
                            </select>
                            <button
                              disabled={isDelegating}
                              onClick={() => handleDelegateTask(selectedTask.id, delegateMemberId)}
                              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-1 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 text-[10px]"
                            >
                              {isDelegating ? 'Delegating...' : 'Delegate'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTask.status === 'approved_by_tl' && (
                    <span className="text-gray-500 italic">// APPROVED BY YOU. AWAITING MANAGER SIGN-OFF //</span>
                  )}
                  {selectedTask.status === 'closed' && (
                    <span className="text-emerald-400 font-bold italic">// TASK CLOSED & VALIDATED //</span>
                  )}
                </div>
              )}

              {/* MANAGER ACTIONS */}
              {(role === 'manager') && (
                <div className="flex gap-3">
                  {selectedTask.assigned_by_role === 'team_leader' ? (
                    <span className="text-gray-500 italic">
                      {selectedTask.status === 'closed' 
                        ? '// TASK COMPLETED AND CLOSED BY TEAM LEADER //' 
                        : `// STATUS: ${selectedTask.status.replace(/_/g, ' ')}. TL FLOW ASSIGNED //`}
                    </span>
                  ) : selectedTask.status === 'approved_by_tl' ? (
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleManagerReview(selectedTask.id, 'approve')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase flex-1 transition"
                      >
                        Approve & Close
                      </button>
                      <button
                        onClick={() => handleManagerReview(selectedTask.id, 'rework')}
                        className="bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase flex-1 transition"
                      >
                        Rework
                      </button>
                      <button
                        onClick={() => handleManagerReview(selectedTask.id, 'reject')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-mono font-bold py-2 px-4 rounded-lg tracking-widest uppercase flex-1 transition"
                      >
                        Reject
                      </button>
                    </div>
                  ) : selectedTask.status === 'closed' ? (
                    <span className="text-emerald-400 font-bold italic">// TASK COMPLETED AND CLOSED //</span>
                  ) : (
                    <span className="text-gray-500 italic">// STATUS: {selectedTask.status.replace(/_/g, ' ')}. PENDING MEMBER RESOLUTION //</span>
                  )}
                </div>
              )}
            </div>

            {/* Comments / Discussions Section */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="font-bold text-gray-500 uppercase tracking-widest text-[8px] mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> // COMMUNICATIONS LOGS //
              </h4>
              
              {/* comments list */}
              <div className="flex flex-col gap-2.5 max-h-[180px] overflow-y-auto scroll-container mb-3.5">
                {(comments[selectedTask.id] || []).map(comm => (
                  <div key={comm.id} className="relative bg-[#0d1527] border border-white/5 p-3 rounded-lg leading-relaxed text-[11px]">
                    <div className="flex justify-between items-center text-[9px] font-semibold text-gray-500 mb-1">
                      <span className="text-[#00f0ff] font-bold">{getUserName(comm.author_id)}</span>
                      <span>{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-300">{comm.comment}</p>
                  </div>
                ))}
                {(comments[selectedTask.id] || []).length === 0 && (
                  <p className="text-gray-500 italic text-[10px]">// DISCUSSION LOGSTREAM EMPTY //</p>
                )}
              </div>

              {/* add comment input */}
              <form onSubmit={(e) => handleAddComment(e, selectedTask.id)} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type logs, operations remarks, status updates..."
                  value={newTaskComment}
                  onChange={(e) => setNewTaskComment(e.target.value)}
                  className="flex-1 bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50"
                  required
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="bg-[#0d1527] border border-slate-700 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] border border-white/10 hover:border-[#00f0ff]/30 py-2 px-4 rounded-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
      {/* --- POPUP MODAL: UPDATE STAGE --- */}
      {isUpdateStageOpen && selectedStageToUpdate && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              // UPDATE STAGE STATUS //
            </h3>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest -mt-2">
              SYSTEM NODE: {selectedStageToUpdate.stage_name}
            </span>
            
            <form onSubmit={handleUpdateStage} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">STAGE STATUS</label>
                <select
                  value={selectedStageToUpdate.status}
                  onChange={(e) => setSelectedStageToUpdate({ ...selectedStageToUpdate, status: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">REMARKS / STATUS SUMMARY</label>
                <textarea
                  value={selectedStageToUpdate.remarks || ''}
                  onChange={(e) => setSelectedStageToUpdate({ ...selectedStageToUpdate, remarks: e.target.value })}
                  placeholder="Summarize the current progress or notes for this stage..."
                  rows={4}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={stageUpdateLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {stageUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateStageOpen(false);
                    setSelectedStageToUpdate(null);
                  }}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: ADD LINE --- */}
      {isAddLineOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              // ADD LINE PIPELINE //
            </h3>
            <p className="text-[10px] text-gray-400 tracking-wide -mt-2">Creates a new parallel execution milestone flow for this project starting after the Kickoff stage.</p>
            
            <form onSubmit={handleAddLine} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">LINE NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Line 2, Shop Floor A, Station 5"
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={stageUpdateLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {stageUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Flow'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddLineOpen(false);
                    setNewLineName('');
                  }}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: DELETE LINE --- */}
      {isDeleteLineOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-8 h-8 rounded bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white tracking-widest uppercase">Delete Line</h3>
                <p className="text-[10px] text-gray-500 tracking-wider">Are you sure you want to delete this line?</p>
              </div>
            </div>

            <form onSubmit={handleDeleteLine} className="flex flex-col gap-4">
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                <p className="text-red-400 leading-relaxed text-[10px] tracking-wide">
                  <strong className="text-white">Warning:</strong> Deleting the <strong className="text-[#00f0ff]">{lineToDelete}</strong> line will permanently remove all associated stages and their progress. This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={stageUpdateLoading}
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(225,29,72,0.2)]"
                >
                  {stageUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete Line'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteLineOpen(false)}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: RENAME LINE --- */}
      {isRenameLineOpen && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
              // RENAME LINE PIPELINE //
            </h3>
            <p className="text-[10px] text-gray-400 tracking-wide -mt-2">Updates the name prefix for all stages under this milestone pipeline.</p>
            
            <form onSubmit={handleRenameLine} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">CURRENT LINE NAME</label>
                <input
                  type="text"
                  disabled
                  value={oldLineToRename}
                  className="w-full bg-[#0d1527]/50 border border-white/5 rounded-lg text-xs px-3 py-2 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">NEW LINE NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Line 1, Main Line, Station A"
                  value={newRenameLineName}
                  onChange={(e) => setNewRenameLineName(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={stageUpdateLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  {stageUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Rename Pipeline'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRenameLineOpen(false);
                    setOldLineToRename('');
                    setNewRenameLineName('');
                  }}
                  className="flex-1 bg-[#0d1527] border border-slate-700 hover:bg-white/10 text-white border border-white/10 font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL: RESOLVE ISSUE --- */}
      {isResolveIssueOpen && selectedIssueId && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-[#090f1d]/95 border border-white/10 w-full max-w-md p-6 rounded-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 font-mono text-xs">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h3 className="font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-emerald-500 inline-block rounded-full animate-pulse" />
              // RESOLVE SYSTEM ISSUE //
            </h3>
            {(() => {
              const currentIssue = issues.find(i => i.id === selectedIssueId);
              return currentIssue ? (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex flex-col gap-1">
                  <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest">ACTIVE THREAT: {currentIssue.title}</span>
                  <p className="text-gray-400 text-[10px] leading-relaxed mt-1">{currentIssue.description}</p>
                </div>
              ) : null;
            })()}

            <form onSubmit={handleResolveIssue} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">COUNTERMEASURES & RESOLUTION REMARKS</label>
                <textarea
                  value={resolutionRemarks}
                  onChange={(e) => setResolutionRemarks(e.target.value)}
                  placeholder="Detail the countermeasure steps taken to resolve this issue..."
                  required
                  rows={4}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={resolvingLoading}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold font-mono py-2 px-4 rounded-lg tracking-widest uppercase transition-all duration-300 active:scale-97 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                >
                  {resolvingLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Resolve Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TARGET DATE CHANGE REASON MODAL */}
      {targetDateChangePrompt?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-[#0f172a]">Reason for Date Change</h3>
              <button
                onClick={() => {
                  const updated = { ...subTasksData };
                  if (targetDateChangePrompt.spIndex !== null) {
                    updated.subTasks[targetDateChangePrompt.taskIndex].subPoints[targetDateChangePrompt.spIndex].targetDate = targetDateChangePrompt.oldDate;
                  } else {
                    updated.subTasks[targetDateChangePrompt.taskIndex].targetDate = targetDateChangePrompt.oldDate;
                  }
                  setSubTasksData(updated);
                  setTargetDateChangePrompt(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Changing target date from <strong className="text-slate-900">{targetDateChangePrompt.oldDate}</strong> to <strong className="text-slate-900">{targetDateChangePrompt.newDate}</strong>.
              </p>
              <textarea
                value={targetDateChangePrompt.reason}
                onChange={e => setTargetDateChangePrompt(prev => prev ? { ...prev, reason: e.target.value } : null)}
                placeholder="Enter mandatory reason for this change..."
                className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#2563eb] focus:bg-white transition-all font-medium text-[#0f172a]"
                rows={4}
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 rounded-b-2xl">
              <button
                onClick={() => {
                  const updated = { ...subTasksData };
                  if (targetDateChangePrompt.spIndex !== null) {
                    updated.subTasks[targetDateChangePrompt.taskIndex].subPoints[targetDateChangePrompt.spIndex].targetDate = targetDateChangePrompt.oldDate;
                  } else {
                    updated.subTasks[targetDateChangePrompt.taskIndex].targetDate = targetDateChangePrompt.oldDate;
                  }
                  setSubTasksData(updated);
                  setTargetDateChangePrompt(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!targetDateChangePrompt.reason.trim()) {
                    alert("Reason is mandatory for modifying a previously saved target date.");
                    return;
                  }
                  const updated = { ...subTasksData };
                  if (targetDateChangePrompt.spIndex !== null) {
                    updated.subTasks[targetDateChangePrompt.taskIndex].subPoints[targetDateChangePrompt.spIndex].targetDateChangeReason = targetDateChangePrompt.reason.trim();
                  } else {
                    updated.subTasks[targetDateChangePrompt.taskIndex].targetDateChangeReason = targetDateChangePrompt.reason.trim();
                  }
                  setSubTasksData(updated);
                  setTargetDateChangePrompt(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#2563eb] hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERALL STATUS MODAL */}
      {isOverallStatusOpen && subTasksData && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative bg-white w-full max-w-6xl p-4 md:p-6 rounded-2xl flex flex-col gap-4 max-h-[95vh] shadow-2xl">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-5 bg-[#2563eb] inline-block rounded-full" />
                  Overall Status
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Stage: {selectedStageForSubTasks?.stage_name}</p>
              </div>
              <button
                onClick={() => setIsOverallStatusOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition shadow-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
              {(() => {
                const uniqueStations = Array.from(new Set(
                  subTasksData.subTasks.flatMap((t: any) =>
                    t.subPoints ? t.subPoints.map((sp: any) => sp.title) : []
                  )
                ));

                return (
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-white text-[#2563eb] sticky top-0 z-10 shadow-sm border-b-2 border-[#93c5fd]">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase border-r border-[#93c5fd]/30">#</th>
                        <th className="px-4 py-3 font-bold uppercase border-r border-[#93c5fd]/30 min-w-[200px]">Activity / Checkpoint</th>
                        <th className="px-4 py-3 font-bold uppercase border-r border-[#93c5fd]/30">Target Date</th>
                        {uniqueStations.map((st: any) => (
                          <th key={st} className="px-4 py-3 font-bold uppercase border-r border-[#93c5fd]/30 text-center min-w-[100px]">{st}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subTasksData.subTasks.map((task: any, idx: number) => {
                        const hasSubPoints = task.subPoints && task.subPoints.length > 0;
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-gray-500 border-r border-gray-100 text-center">{idx + 1}</td>
                            <td className="px-4 py-3 font-bold text-gray-800 border-r border-gray-100 whitespace-normal min-w-[200px]">{task.title}</td>
                            <td className="px-4 py-3 font-mono text-gray-600 border-r border-gray-100">{task.targetDate || '-'}</td>
                            {hasSubPoints ? (
                              uniqueStations.map((st: any) => {
                                const sp = task.subPoints.find((p: any) => p.title === st);
                                if (!sp) return <td key={st} className="px-4 py-3 border-r border-gray-100 bg-gray-50/50 text-center text-gray-300">-</td>;
                                
                                let badge = '';
                                if (sp.status === 'complete') badge = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                else if (sp.status === 'in_progress') badge = 'bg-blue-100 text-blue-700 border-blue-200';
                                else if (sp.status === 'not_applicable') badge = 'bg-gray-100 text-gray-500 border-gray-200';
                                else badge = 'border-transparent text-gray-400';
                                
                                return (
                                  <td key={st} className="px-4 py-3 border-r border-gray-100 text-center">
                                    <span className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${badge}`}>
                                      {sp.status === 'not_applicable' ? 'N/A' : (sp.status || 'Pending').replace('_', ' ')}
                                    </span>
                                  </td>
                                );
                              })
                            ) : (
                              uniqueStations.length > 0 ? (
                                <td colSpan={uniqueStations.length} className="px-4 py-3 border-r border-gray-100 text-center bg-[#f8fafc]">
                                  <div className="flex flex-col items-center justify-center gap-1.5">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Common for all stations</span>
                                    <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider inline-block ${
                                      task.status === 'complete' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      task.status === 'not_applicable' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                      'border-transparent text-gray-400'
                                    }`}>
                                      {task.status === 'not_applicable' ? 'N/A' : (task.status || 'Pending').replace('_', ' ')}
                                    </span>
                                  </div>
                                </td>
                              ) : (
                                <td className="px-4 py-3 border-r border-gray-100 text-center bg-[#f8fafc]">
                                  <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider inline-block ${
                                      task.status === 'complete' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      task.status === 'not_applicable' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                      'border-transparent text-gray-400'
                                    }`}>
                                      {task.status === 'not_applicable' ? 'N/A' : (task.status || 'Pending').replace('_', ' ')}
                                  </span>
                                </td>
                              )
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* ADD REVISION MODAL */}
      {isAddRevisionModalOpen && selectedTaskIndexForRevision !== null && subTasksData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#2563eb] to-[#1e40af] p-4 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg">Add Revision</h3>
                <p className="text-[10px] text-blue-200 font-mono line-clamp-1 mt-0.5">
                  {selectedSubTaskIndexForRevision !== null 
                    ? subTasksData.subTasks[selectedTaskIndexForRevision].subPoints[selectedSubTaskIndexForRevision].title 
                    : subTasksData.subTasks[selectedTaskIndexForRevision].title}
                </p>
              </div>
              <button 
                onClick={() => setIsAddRevisionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Revision Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Rev.1, Rev.2..."
                  value={newRevisionData.revisionNumber}
                  onChange={(e) => setNewRevisionData({...newRevisionData, revisionNumber: e.target.value})}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Date Received <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={newRevisionData.dateReceived}
                  onChange={(e) => setNewRevisionData({...newRevisionData, dateReceived: e.target.value})}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Description / Remarks <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="What changed in this revision?"
                  value={newRevisionData.remarks}
                  onChange={(e) => setNewRevisionData({...newRevisionData, remarks: e.target.value})}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all min-h-[80px] resize-y"
                />
              </div>
            </div>

            <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddRevisionModalOpen(false)}
                className="px-4 py-2 font-bold text-sm text-[#64748b] hover:text-[#0f172a] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newRevisionData.revisionNumber.trim() || !newRevisionData.dateReceived || !newRevisionData.remarks.trim()) {
                    alert('Revision Number, Date Received, and Reason/Remarks are required.');
                    return;
                  }
                  
                  const updated = { ...subTasksData };
                  let targetObject = null;
                  
                  if (selectedSubTaskIndexForRevision !== null) {
                    targetObject = updated.subTasks[selectedTaskIndexForRevision].subPoints[selectedSubTaskIndexForRevision];
                  } else {
                    targetObject = updated.subTasks[selectedTaskIndexForRevision];
                  }
                  
                  if (!targetObject.revisions) {
                    targetObject.revisions = [];
                  }
                  
                  targetObject.revisions.push({
                    revisionNumber: newRevisionData.revisionNumber.trim(),
                    dateReceived: newRevisionData.dateReceived,
                    remarks: newRevisionData.remarks.trim(),
                    uploadedBy: user?.name || 'System User'
                  });
                  
                  setSubTasksData(updated);
                  setIsAddRevisionModalOpen(false);
                  
                  // Expand the history to show the new revision
                  if (selectedSubTaskIndexForRevision !== null) {
                    setExpandedHistoryTasks(prev => ({ ...prev, [`${selectedTaskIndexForRevision}-${selectedSubTaskIndexForRevision}`]: true }));
                  } else {
                    setExpandedHistoryTasks(prev => ({ ...prev, [selectedTaskIndexForRevision]: true }));
                  }
                }}
                className="px-5 py-2 font-bold text-sm bg-[#2563eb] text-white hover:bg-[#1d4ed8] rounded-xl shadow-md transition-all"
              >
                Save Revision
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TASK LOGS SLIDE-OVER */}
      {isTaskLogsOpen && selectedTaskIndexForLogs !== null && subTasksData && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99]"
            onClick={() => {
              setIsTaskLogsOpen(false);
              setSelectedTaskIndexForLogs(null);
            }}
          />
          <div className="fixed top-0 right-0 h-screen w-full md:w-[400px] bg-white z-[100] shadow-2xl flex flex-col transform transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
              <div>
                <h2 className="text-sm font-bold text-[#0f172a] tracking-wider uppercase">Task Logs</h2>
                <p className="text-[10px] text-gray-500 font-mono mt-1 line-clamp-1">{subTasksData.subTasks[selectedTaskIndexForLogs].title}</p>
              </div>
              <button
                onClick={() => {
                  setIsTaskLogsOpen(false);
                  setSelectedTaskIndexForLogs(null);
                }}
                className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-100 flex items-center justify-center transition shadow-sm"
              >
                ✕
              </button>
            </div>

            {/* Logs Timeline */}
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
              {(() => {
                const logs = subTasksData.subTasks[selectedTaskIndexForLogs].logs || [];
                if (logs.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                      <FileText className="w-12 h-12 mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">No logs recorded yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-5 relative before:absolute before:inset-y-0 before:left-[15px] before:w-px before:bg-blue-100">
                    {logs.map((log: any, idx: number) => {
                      const statusStr = typeof log.status === 'string' ? log.status.toLowerCase() : '';
                      const isUntick = statusStr === 'pending' || statusStr.includes('pending');
                      const isComplete = statusStr === 'complete' || statusStr.includes('complete');
                      const isNA = statusStr === 'not_applicable' || statusStr.includes('not_applicable');
                      const isInProgress = statusStr === 'in_progress' || statusStr.includes('in_progress');

                      let dotColor = 'bg-gray-400';
                      let borderColor = 'border-gray-100';
                      let badgeClasses = 'bg-gray-100 text-gray-600';
                      let remarkClasses = 'bg-gray-50 text-gray-600 border-gray-100';
                      let displayStatus = log.status;

                      if (isUntick) {
                        dotColor = 'bg-red-500';
                        borderColor = 'border-red-100';
                        badgeClasses = 'bg-red-50 text-red-600';
                        remarkClasses = 'bg-[#fee2e2] text-[#991b1b] border-[#f87171]';
                        displayStatus = statusStr === 'pending' ? 'Unticked' : log.status;
                      } else if (isComplete) {
                        dotColor = 'bg-emerald-500';
                        borderColor = 'border-emerald-100';
                        badgeClasses = 'bg-emerald-50 text-emerald-600';
                        remarkClasses = 'bg-[#d1fae5] text-[#065f46] border-[#34d399]';
                      } else if (isNA) {
                        dotColor = 'bg-blue-500';
                        borderColor = 'border-blue-100';
                        badgeClasses = 'bg-blue-50 text-blue-600';
                        remarkClasses = 'bg-white text-[#1e3a8a] border-[#93c5fd]';
                        displayStatus = statusStr === 'not_applicable' ? 'N/A' : log.status;
                      } else if (isInProgress) {
                        dotColor = 'bg-amber-500';
                        borderColor = 'border-amber-100';
                        badgeClasses = 'bg-amber-50 text-amber-600';
                        remarkClasses = 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]';
                        displayStatus = statusStr === 'in_progress' ? 'In Progress' : log.status;
                      }

                      return (
                        <div key={idx} className="relative pl-10">
                          <div className={`absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#eff6ff] shadow-sm ${dotColor}`} />
                          <div className={`bg-white p-3.5 rounded-xl border shadow-sm flex flex-col gap-2 relative ${borderColor}`}>
                            <div className="absolute top-3 right-3 text-[9px] font-mono text-gray-400">{log.date}</div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClasses}`}>
                                {displayStatus}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-bold text-gray-800">{log.by}</span> updated status
                            </div>
                            {log.remark && (
                              <div className={`p-2 rounded text-[10px] font-mono border ${remarkClasses}`}>
                                // {log.remark}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {loadingMoreLogs && (
                      <div className="flex justify-center p-4">
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                      </div>
                    )}
                    <div ref={observerTarget} className="h-4 w-full" />
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ADD SUB ITEM MODAL */}
      {isAddSubItemModalOpen && selectedTaskIndexForAddSubPoint !== null && (
        <div className="fixed inset-0 bg-[#07090e]/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-[#f8fafc]">
              <h2 className="text-sm font-bold text-[#0f172a] tracking-wider uppercase">Add Sub Item</h2>
              <button
                onClick={() => {
                  setIsAddSubItemModalOpen(false);
                  setSelectedTaskIndexForAddSubPoint(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wide mb-2">Sub Item Name</label>
                <input
                  type="text"
                  value={newSubItemData.name}
                  onChange={(e) => setNewSubItemData({ ...newSubItemData, name: e.target.value })}
                  placeholder="Enter name..."
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] transition-all shadow-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wide mb-2">Target Date (Optional)</label>
                <input
                  type="date"
                  value={newSubItemData.targetDate}
                  onChange={(e) => setNewSubItemData({ ...newSubItemData, targetDate: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] font-mono shadow-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAddSubItemModalOpen(false);
                  setSelectedTaskIndexForAddSubPoint(null);
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newSubItemData.name.trim()) return;
                  const updated = { ...subTasksData };
                  if (!updated.subTasks[selectedTaskIndexForAddSubPoint].subPoints) {
                    updated.subTasks[selectedTaskIndexForAddSubPoint].subPoints = [];
                  }
                  updated.subTasks[selectedTaskIndexForAddSubPoint].subPoints.push({
                    title: newSubItemData.name.trim(),
                    status: 'pending',
                    targetDate: newSubItemData.targetDate || '',
                    completedDate: '',
                    completedBy: '',
                    untickedBy: '',
                    untickedDate: '',
                    untickedReason: ''
                  });
                  updated.subTasks[selectedTaskIndexForAddSubPoint].completed = false;
                  updated.subTasks[selectedTaskIndexForAddSubPoint].status = 'pending';
                  
                  setExpandedTasks(prev => ({ ...prev, [selectedTaskIndexForAddSubPoint]: true }));
                  
                  setSubTasksData(updated);
                  logActivity('Sub-Item Added', { 
                    sub_item: newSubItemData.name.trim(), 
                    activity: updated.subTasks[selectedTaskIndexForAddSubPoint].title, 
                    stage_name: selectedStageForSubTasks.stage_name 
                  });
                  setIsAddSubItemModalOpen(false);
                  setSelectedTaskIndexForAddSubPoint(null);
                }}
                disabled={!newSubItemData.name.trim()}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}



      {/* PUNCH POINT MODAL */}
      {isPunchPointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#0f172a] font-heading flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                {punchPointFormData.id ? 'Edit Punch Point' : 'Add Punch Point'}
              </h2>
              <button 
                onClick={() => setIsPunchPointModalOpen(false)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePunchPoint} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line *</label>
                  <select
                    required
                    value={punchPointFormData.line || ''}
                    onChange={e => setPunchPointFormData({ ...punchPointFormData, line: e.target.value })}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a]"
                  >
                    <option value="" disabled>Select Line</option>
                    <option value="Common">Common</option>
                    {linesList.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Station No *</label>
                  <input
                    type="text"
                    required
                    value={punchPointFormData.station_no || ''}
                    onChange={e => setPunchPointFormData({ ...punchPointFormData, station_no: e.target.value })}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Concern *</label>
                <textarea
                  required
                  rows={2}
                  value={punchPointFormData.concern || ''}
                  onChange={e => setPunchPointFormData({ ...punchPointFormData, concern: e.target.value })}
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Issue Raised Date</label>
                  <input
                    type="date"
                    value={punchPointFormData.issue_raised_date || ''}
                    onChange={e => setPunchPointFormData({ ...punchPointFormData, issue_raised_date: e.target.value })}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Date</label>
                  <input
                    type="date"
                    value={punchPointFormData.target_date || ''}
                    onChange={e => setPunchPointFormData({ ...punchPointFormData, target_date: e.target.value })}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status *</label>
                  <select
                    required
                    value={punchPointFormData.status || 'Open'}
                    onChange={e => setPunchPointFormData({ ...punchPointFormData, status: e.target.value as any })}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a]"
                  >
                    <option value="Open">Open</option>
                    <option value="WIP">WIP</option>
                    <option value="Closed">Closed</option>
                    <option value="NA">NA</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Closed By</label>
                  <input
                    type="text"
                    disabled
                    value={punchPointFormData.closed_by || '-'}
                    className="w-full text-sm p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Remark</label>
                <textarea
                  rows={2}
                  value={punchPointFormData.remark || ''}
                  onChange={e => setPunchPointFormData({ ...punchPointFormData, remark: e.target.value })}
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-[#0f172a] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPunchPointModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold font-mono tracking-widest uppercase text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold font-mono tracking-widest uppercase text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                >
                  Save Punch Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
