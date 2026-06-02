'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Project, User, Task, TaskComment, Achievement, Issue, ActivityLog } from '@/types';
import { 
  Folder, ArrowLeft, ArrowRight, Loader2, Plus, Users, Award, 
  AlertTriangle, FileText, CheckCircle, HelpCircle, 
  MessageSquare, Calendar, ChevronDown, ChevronUp, Download,
  Send, Sparkles, AlertOctagon, Info, BarChart2, Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  LineChart, Line 
} from 'recharts';
import confetti from 'canvas-confetti';

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

  // --- TABS STATE ---
  const [activeTab, setActiveTab] = useState<string>('overview');

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

  // Issue form
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

  const fetchProjectDetails = async () => {
    if (!projectId || !user) return;
    setLoading(true);
    try {
      // 1. Fetch Project Details
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (projErr) throw projErr;
      setProject(projData);

      // Default tab synced via separate useEffect hook below

      // 2. Fetch Tasks under this project
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (tasksErr) throw tasksErr;
      setTasks(tasksData || []);

      // 3. Fetch Comments for tasks
      if (tasksData && tasksData.length > 0) {
        const { data: commentsData, error: commentsErr } = await supabase
          .from('task_comments')
          .select('*')
          .in('task_id', tasksData.map((t: any) => t.id))
          .order('created_at', { ascending: true });
        if (commentsErr) throw commentsErr;

        const commMap: Record<string, TaskComment[]> = {};
        (commentsData || []).forEach((c: any) => {
          if (!commMap[c.task_id]) commMap[c.task_id] = [];
          commMap[c.task_id].push(c);
        });
        setComments(commMap);
      }

      // 4. Fetch Achievements
      const { data: achievementsData, error: achErr } = await supabase
        .from('achievements')
        .select('*')
        .eq('project_id', projectId)
        .order('submitted_at', { ascending: false });
      if (achErr) throw achErr;
      setAchievements(achievementsData || []);

      // 5. Fetch Issues
      const { data: issuesData, error: issErr } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId)
        .order('raised_at', { ascending: false });
      if (issErr) throw issErr;
      setIssues(issuesData || []);

      // 6. Fetch Logs
      const { data: logsData, error: logsErr } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (logsErr) throw logsErr;
      setLogs(logsData || []);

      // 7. Fetch Project Members
      const { data: pmData, error: pmErr } = await supabase
        .from('project_members')
        .select('team_member_id')
        .eq('project_id', projectId);
      if (pmErr) throw pmErr;

      // 8. Fetch all users profiles to map names/emails
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*');
      if (usersErr) throw usersErr;
      setAllUsers(usersData || []);

      const membersList = (usersData || []).filter((u: any) => 
        (pmData || []).some((pm: any) => pm.team_member_id === u.id)
      );
      setProjectMembers(membersList);

      // 8.5 Fetch hierarchy to filter Team Leader's views
      if (user?.role === 'team_leader') {
        const { data: hierarchyData, error: hierarchyErr } = await supabase
          .from('hierarchy')
          .select('team_member_id')
          .eq('team_leader_id', user.id);
        if (hierarchyErr) throw hierarchyErr;
        const memberIds = (hierarchyData || [])
          .map((h: any) => h.team_member_id)
          .filter(Boolean);
        setMyTeamMemberIds(memberIds);
      }

      // 9. Fetch Project Stages
      const { data: stagesData, error: stagesErr } = await supabase
        .from('project_stages')
        .select('*')
        .eq('project_id', projectId);
      if (stagesErr) throw stagesErr;
      
      const sortedStages = (stagesData || []).sort((a: any, b: any) => {
        return STAGE_ORDER.indexOf(a.stage_name) - STAGE_ORDER.indexOf(b.stage_name);
      });
      setProjectStages(sortedStages);

    } catch (err) {
      console.error('Error fetching project detail page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId, user]);

  useEffect(() => {
    if (user) {
      const tabParam = searchParams.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab(user.role === 'team_member' ? 'my-tasks' : 'overview');
      }
    }
  }, [user, searchParams]);

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
    try {
      await supabase.from('activity_logs').insert({
        project_id: projectId,
        task_id: taskId || null,
        user_id: user.id,
        action,
        details,
      });
      fetchProjectDetails(); // refresh logs
    } catch (err) {
      console.error('Error writing activity log:', err);
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

  // --- ACTIONS ---

  // TL Assigns Member to Project
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setMemberLoading(true);

    try {
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
      fetchProjectDetails();
    } catch (err: any) {
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
          assigned_by_role: role === 'manager' ? 'manager' : 'team_leader',
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

      // Notify TM/TL
      await supabase.from('notifications').insert({
        user_id: assigned_to,
        title: role === 'manager' ? 'New Manager-Assigned Task' : 'New Team Leader Task Assigned',
        message: role === 'manager'
          ? `Manager assigned task "${title}" to you for project ${project?.project_name || ''}.`
          : `Your TL assigned task "${title}" to you for project ${project?.project_name || ''}.`,
        related_task_id: taskData.id,
        related_project_id: projectId,
      });

      await logActivity(
        role === 'manager' ? 'Task Assigned to TL' : 'Task Assigned to Member',
        { title, assigned_to: getUserName(assigned_to) },
        taskData.id
      );

      setIsAssignTaskOpen(false);
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', start_date: '', target_date: '', remarks: '' });
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error assigning task.');
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

      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error updating task.');
    } finally {
      setUpdatingTaskProgress(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleStartTask = async (taskId: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
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
    } catch (err: any) {
      alert(err.message || 'Error starting task.');
    }
  };

  const handleTLMarkCompleted = async (taskId: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
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
    } catch (err: any) {
      alert(err.message || 'Error marking task as completed.');
    }
  };

  const handleDelegateTask = async (taskId: string, memberId: string) => {
    if (!memberId) return;
    setIsDelegating(true);
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    try {
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
    } catch (err: any) {
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
      if (action === 'approve' && currentTask.assigned_by_role === 'manager' && project?.created_by) {
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

      fetchProjectDetails();
    } catch (err: any) {
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

      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error processing Manager review.');
    }
  };

  const handleUpdateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageToUpdate) return;
    setStageUpdateLoading(true);

    const { id, stage_name, status, remarks } = selectedStageToUpdate;

    try {
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
      fetchProjectDetails();
      alert('Project stage updated successfully.');
    } catch (err: any) {
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
                targetDate: sp.targetDate || '',
                completedDate: sp.completedDate || '',
                completedBy: sp.completedBy || '',
                untickedBy: sp.untickedBy || '',
                untickedDate: sp.untickedDate || '',
                untickedReason: sp.untickedReason || ''
              };
            });
            return {
              title: t.title,
              status,
              targetDate: t.targetDate || '',
              completedDate: t.completedDate || '',
              completedBy: t.completedBy || '',
              untickedBy: t.untickedBy || '',
              untickedDate: t.untickedDate || '',
              untickedReason: t.untickedReason || '',
              logs: t.logs || [],
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
        targetDate: '',
        completedDate: '',
        completedBy: '',
        untickedBy: '',
        untickedDate: '',
        untickedReason: '',
        logs: [],
        subPoints: []
      }))
    };
  };

  // Helper to calculate sub-tasks progress based on new status fields (complete/not_applicable count as complete)
  const getSubTasksProgress = (remarks: string | null, defaultCount: number) => {
    try {
      if (remarks && (remarks.trim().startsWith('{') || remarks.trim().startsWith('['))) {
        const data = JSON.parse(remarks);
        if (data && data.subTasks) {
          let total = 0;
          let completed = 0;
          data.subTasks.forEach((st: any) => {
            if (st.subPoints && st.subPoints.length > 0) {
              st.subPoints.forEach((sp: any) => {
                total++;
                if (sp.status === 'complete' || sp.status === 'not_applicable') completed++;
              });
            } else {
              total++;
              if (st.status === 'complete' || st.status === 'not_applicable') completed++;
            }
          });
          return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
        }
      }
    } catch (e) {}
    return { completed: 0, total: defaultCount, percent: 0 };
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
          targetDate: '',
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
    if (!subTasksData) return;

    if (user?.role === 'manager') {
      alert("Managers are not allowed to update task status.");
      return;
    }

    if (clickedStatus === 'complete' || clickedStatus === 'not_applicable') {
      const isAllowed = user?.role === 'team_leader' || user?.role === 'team_member';
      if (!isAllowed) {
        alert("Only Team Leaders and Team Members are allowed to mark tasks as completed or N/A.");
        return;
      }
    }

    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];
    const currentStatus = task.status || 'pending';
    const isRemovingTick = currentStatus === clickedStatus;
    const newStatus = isRemovingTick ? 'pending' : clickedStatus;

    let reason = '';
    if (isRemovingTick) {
      reason = window.prompt("Please enter a reason for unticking this task:") || '';
      if (!reason.trim()) {
        alert("Reason is mandatory for unticking.");
        return;
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

    task.untickedBy = isRemovingTick ? userName : '';
    task.untickedDate = isRemovingTick ? new Date().toLocaleString() : '';
    task.untickedReason = isRemovingTick ? reason.trim() : '';

    setSubTasksData(updated);
  };

  const handleToggleSubPointStatus = (taskIndex: number, spIndex: number, clickedStatus: string) => {
    if (!subTasksData) return;

    if (user?.role === 'manager') {
      alert("Managers are not allowed to update task status.");
      return;
    }

    if (clickedStatus === 'complete' || clickedStatus === 'not_applicable') {
      const isAllowed = user?.role === 'team_leader' || user?.role === 'team_member';
      if (!isAllowed) {
        alert("Only Team Leaders and Team Members are allowed to mark tasks as completed or N/A.");
        return;
      }
    }

    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];
    const sp = task.subPoints[spIndex];
    const currentStatus = sp.status || 'pending';
    const isRemovingTick = currentStatus === clickedStatus;
    const newStatus = isRemovingTick ? 'pending' : clickedStatus;

    let reason = '';
    if (isRemovingTick) {
      reason = window.prompt("Please enter a reason for unticking this sub-point:") || '';
      if (!reason.trim()) {
        alert("Reason is mandatory for unticking.");
        return;
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

    sp.untickedBy = isRemovingTick ? userName : '';
    sp.untickedDate = isRemovingTick ? new Date().toLocaleString() : '';
    sp.untickedReason = isRemovingTick ? reason.trim() : '';

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

  const handleUpdateCheckPointTargetDate = (taskIndex: number, dateVal: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;
    const updated = { ...subTasksData };
    const task = updated.subTasks[taskIndex];

    const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
    const initialTask = initialParsed.subTasks?.[taskIndex];
    const initialTargetDate = initialTask?.targetDate || '';

    if (initialTargetDate && initialTargetDate !== dateVal) {
      const reason = window.prompt(`Changing target date from ${initialTargetDate} to ${dateVal}. Please enter a reason:`);
      if (!reason || !reason.trim()) {
        alert("Reason is mandatory for modifying a previously saved target date.");
        return;
      }
      task.targetDateChangeReason = reason.trim();
    } else if (initialTargetDate === dateVal) {
      task.targetDateChangeReason = '';
    }

    task.targetDate = dateVal;
    setSubTasksData(updated);
  };

  const handleUpdateSubPointTargetDate = (taskIndex: number, spIndex: number, dateVal: string) => {
    if (!subTasksData || !selectedStageForSubTasks) return;
    const updated = { ...subTasksData };
    const sp = updated.subTasks[taskIndex].subPoints[spIndex];

    const initialParsed = parseStageRemarks(selectedStageForSubTasks.remarks);
    const initialTask = initialParsed.subTasks?.[taskIndex];
    const initialSp = initialTask?.subPoints?.[spIndex];
    const initialTargetDate = initialSp?.targetDate || '';

    if (initialTargetDate && initialTargetDate !== dateVal) {
      const reason = window.prompt(`Changing sub-point target date from ${initialTargetDate} to ${dateVal}. Please enter a reason:`);
      if (!reason || !reason.trim()) {
        alert("Reason is mandatory for modifying a previously saved target date.");
        return;
      }
      sp.targetDateChangeReason = reason.trim();
    } else if (initialTargetDate === dateVal) {
      sp.targetDateChangeReason = '';
    }

    sp.targetDate = dateVal;
    setSubTasksData(updated);
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
              if (!st.logs) st.logs = [];
              st.logs.unshift({
                status: `Sub-point [${sp.title}] Target Date Changed`,
                date: nowStr,
                by: userName,
                remark: `From ${oldSpTargetDate} to ${newSpTargetDate}. Reason: ${sp.targetDateChangeReason || 'No reason provided'}`
              });
            } else if (!oldSpTargetDate && newSpTargetDate) {
              if (!st.logs) st.logs = [];
              st.logs.unshift({
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

      setIsSubTasksModalOpen(false);
      setSelectedStageForSubTasks(null);
      setSubTasksData(null);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error saving sub-tasks.');
    } finally {
      setSubTaskSaveLoading(false);
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
      const { error } = await supabase
        .from('project_stages')
        .insert(stagesToInsert);

      if (error) throw error;

      await logActivity('Project Line Added', {
        line_name: cleanLineName,
        project_name: project?.project_name
      });

      setIsAddLineOpen(false);
      setNewLineName('');
      fetchProjectDetails();
      alert(`Line "${cleanLineName}" added successfully.`);
    } catch (err: any) {
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

      if (stageIds.length > 0) {
        const { error } = await supabase
          .from('project_stages')
          .delete()
          .in('id', stageIds);
        
        if (error) throw error;
      }

      await fetchProjectDetails();
      setIsDeleteLineOpen(false);
      setLineToDelete('');
    } catch (err: any) {
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

      const updatePromises = oldStages.map(stage => {
        let stageType = stage.stage_name;
        if (stage.stage_name.includes(' - ')) {
          stageType = stage.stage_name.split(' - ').slice(1).join(' - ');
        }
        
        let newStageName = stageType;
        if (cleanNewLineName !== 'Main Line') {
          newStageName = `${cleanNewLineName} - ${stageType}`;
        }

        return supabase
          .from('project_stages')
          .update({ stage_name: newStageName })
          .eq('id', stage.id);
      });

      const results = await Promise.all(updatePromises);
      const failedUpdate = results.find(r => r.error);
      if (failedUpdate) throw failedUpdate.error;

      await logActivity('Project Line Renamed', {
        old_line_name: oldLineToRename,
        new_line_name: cleanNewLineName,
        project_name: project?.project_name
      });

      setIsRenameLineOpen(false);
      setOldLineToRename('');
      setNewRenameLineName('');
      fetchProjectDetails();
      alert(`Line renamed from "${oldLineToRename}" to "${cleanNewLineName}" successfully.`);
    } catch (err: any) {
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

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: user?.id,
          comment: newTaskComment,
        });

      if (error) throw error;

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

      fetchProjectDetails();
    } catch (err: any) {
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
      const { data, error } = await supabase
        .from('achievements')
        .insert({
          project_id: projectId,
          project_code: project?.project_code || '',
          title,
          details,
          submitted_by: user?.id,
          attachment_url: attachment_url || null,
          approval_status: 'pending',
        });

      if (error) throw error;

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
      fetchProjectDetails();
    } catch (err: any) {
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
      fetchProjectDetails();
    } catch (err: any) {
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
      const { error } = await supabase
        .from('issues')
        .insert({
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
        });

      if (error) throw error;

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
      fetchProjectDetails();
    } catch (err: any) {
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
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error resolving issue.');
    } finally {
      setResolvingLoading(false);
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
      const day = new Date(l.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  if (loading || !project) {
    return (
      <div className="flex py-24 justify-center items-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  const role = user?.role;

  return (
    <div className="relative min-h-screen bg-[#dbeafe] text-[#0f172a] p-1 md:p-2">

      <div className="relative z-10 flex flex-col gap-3 animated-fade">
      
      {/* Top Breadcrumb & Project Header */}
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white border-2 border-[#93c5fd] p-2.5 rounded-xl shadow-md overflow-hidden">
        
        <div className="relative z-10 flex items-center gap-4">
          <button 
            onClick={() => router.push(`/dashboard/${role?.replace('_', '-')}`)}
            className="p-1.5 rounded-lg bg-[#eff6ff] border-2 border-[#93c5fd] text-[#2563eb] hover:bg-[#dbeafe] hover:border-[#2563eb] transition-all duration-300 active:scale-95 shadow-sm"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-extrabold bg-[#2563eb] text-white px-2.5 py-0.5 rounded-lg tracking-widest uppercase shadow-sm">
                {project.project_code}
              </span>
              <span className="text-[10px] font-semibold text-[#64748b] tracking-wide">
                Plant: {project.customer_name}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0f172a] mt-1.5 font-heading tracking-wide leading-tight">
              {project.project_name}
            </h1>
          </div>
        </div>

        </div>

      {/* TABS ROW (Dynamic depending on role) */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center border-b-2 border-[#93c5fd] pb-1 gap-2">
        <div className="flex gap-1.5 overflow-x-auto scroll-container pb-1">
          {/* MANAGER TABS */}
          {role === 'manager' && (
            <>
              {['overview', 'stages', 'tasks', 'achievements', 'issues', 'activity-log'].map(tab => (
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
              {['overview', 'stages', 'tasks', 'achievements', 'issues'].map(tab => (
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
              {['my-tasks', 'stages', 'achievements', 'issues'].map(tab => (
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
        </div>
      </div>

      {/* --- TAB PANELS --- */}

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Project Stages Horizontal Stepper */}
          <div className="relative bg-[#090f1d]/70 border border-white/10 p-5 rounded-xl flex flex-col gap-4 text-xs shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

            <div className="flex justify-between items-center relative z-10">
              <h3 className="font-bold text-sm text-white font-heading tracking-wide uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-[#00f0ff] inline-block" />
                Project Execution Progress
              </h3>
                <span className="text-[9.5px] text-slate-300 font-mono tracking-wider">
                  STAGES COMPLETED: {projectStages.filter(s => s.status === 'completed').length} / {projectStages.length > 0 ? projectStages.length : STAGE_ORDER.length}
                </span>
            </div>
            
            <div className="flex items-center gap-1 overflow-x-auto py-3 scroll-container relative z-10">
              {STAGE_ORDER.map((stageName, index) => {
                const matchingStages = projectStages.filter(s => s.stage_name === stageName || s.stage_name.endsWith(` - ${stageName}`));
                
                let status = 'pending';
                if (matchingStages.length > 0) {
                  const completedCount = matchingStages.filter(s => s.status === 'completed').length;
                  const inProgressCount = matchingStages.filter(s => s.status === 'in_progress').length;
                  if (completedCount === matchingStages.length) status = 'completed';
                  else if (completedCount > 0 || inProgressCount > 0) status = 'in_progress';
                }

                return (
                  <React.Fragment key={stageName}>
                    {/* Step Node */}
                    <div className="flex flex-col items-center min-w-[110px] text-center gap-2 group cursor-pointer transition-all duration-300 hover:scale-105">
                      <div className="relative w-12 h-12 flex items-center justify-center font-bold font-mono text-xs">
                        {(() => {
                          let aggTotal = 0;
                          let aggCompleted = 0;
                          
                          matchingStages.forEach(st => {
                            let p = getSubTasksProgress(st.remarks, 8);
                            if (!st.remarks || !st.remarks.trim().startsWith('{')) {
                              if (st.status === 'completed') {
                                p.percent = 100; p.completed = p.total || 8; p.total = p.total || 8;
                              } else if (st.status === 'in_progress') {
                                p.percent = 50; p.completed = Math.floor((p.total || 8) / 2); p.total = p.total || 8;
                              }
                            } else if (st.status === 'completed' && p.percent < 100) {
                              p.percent = 100; p.completed = p.total;
                            }
                            aggTotal += p.total;
                            aggCompleted += p.completed;
                          });

                          let progressData = {
                            total: aggTotal,
                            completed: aggCompleted,
                            percent: aggTotal > 0 ? Math.round((aggCompleted / aggTotal) * 100) : 0
                          };

                          if (progressData.total === 0) {
                            if (status === 'completed') progressData.percent = 100;
                            else if (status === 'in_progress') progressData.percent = 50;
                          } else if (status === 'completed' && progressData.percent < 100) {
                            progressData.percent = 100;
                          }
                          const radius = 22;
                          const circumference = 2 * Math.PI * radius;
                          const dashoffset = circumference - (progressData.percent / 100) * circumference;
                          return (
                            <React.Fragment>
                              <svg className="w-12 h-12 transform -rotate-90 absolute top-0 left-0">
                                <circle className="text-white/5" strokeWidth="2.5" stroke="currentColor" fill="transparent" r={radius} cx="24" cy="24" />
                                <circle 
                                  className={`transition-all duration-500 ease-in-out ${status === 'completed' ? 'text-emerald-500' : status === 'in_progress' ? 'text-cyan-500' : 'text-slate-400'}`} 
                                  strokeWidth="2.5" 
                                  strokeDasharray={circumference} 
                                  strokeDashoffset={dashoffset} 
                                  strokeLinecap="round" 
                                  stroke="currentColor" 
                                  fill="transparent" 
                                  r={radius} 
                                  cx="24" 
                                  cy="24" 
                                  style={{ filter: status !== 'pending' ? `drop-shadow(0 0 4px ${status === 'completed' ? '#10b981' : '#06b6d4'})` : 'none' }}
                                />
                              </svg>
                              <span className={`text-[9.5px] z-10 font-bold ${status === 'completed' ? 'text-emerald-400' : status === 'in_progress' ? 'text-cyan-400' : 'text-slate-300'}`}>
                                {progressData.percent}%
                              </span>
                            </React.Fragment>
                          );
                        })()}
                      </div>
                      <span className={`text-[8.5px] font-bold font-mono tracking-wider max-w-[100px] truncate transition-colors duration-300 uppercase ${
                        status === 'completed' ? 'text-emerald-400' : status === 'in_progress' ? 'text-cyan-400' : 'text-slate-300'
                      }`} title={stageName}>
                        {stageName.replace('Project ', '')}
                      </span>
                      
                      {/* Tooltip for remarks */}
                      {matchingStages.some(s => s.remarks && !s.remarks.trim().startsWith('{')) && (
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 bg-[#0d1527] border border-[#00f0ff]/30 p-2.5 rounded text-[9.5px] text-gray-300 w-52 text-left pointer-events-none shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
                          <span className="text-[8px] font-bold text-[#00f0ff] uppercase block mb-1 tracking-wider">// REMARKS //</span>
                          {matchingStages.find(s => s.remarks && !s.remarks.trim().startsWith('{'))?.remarks}
                        </div>
                      )}
                    </div>
                    
                    {/* Connector Line */}
                    {index < STAGE_ORDER.length - 1 && (
                      <div className={`flex-grow h-[1.5px] min-w-[20px] max-w-[40px] rounded transition-all duration-500 ${
                        status === 'completed'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                          : status === 'in_progress'
                          ? 'bg-gradient-to-r from-cyan-500/50 to-transparent bg-cyan-400/20'
                          : 'bg-[#0d1527] border border-slate-700'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unified Team Information card */}
            <div className="relative bg-[#090f1d]/75 border border-white/10 p-5 rounded-xl text-xs shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-sm text-white font-heading tracking-wide uppercase flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-[#8b5cf6] inline-block" />
                    Team Information
                  </h3>
                  {role === 'team_leader' && (
                    <button
                      onClick={() => setIsAssignMemberOpen(true)}
                      className="px-2.5 py-1 text-[9px] font-bold tracking-widest font-mono uppercase bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white rounded flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Assign
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Team Leader Section */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Team Leader</h4>
                    <div className="flex items-center gap-4 bg-[#0b101d] border border-white/5 p-3.5 rounded-lg h-[68px]">
                      <div className="w-11 h-11 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 text-[#8b5cf6] font-extrabold flex items-center justify-center text-sm uppercase shadow-[0_0_10px_rgba(139,92,246,0.15)] font-mono shrink-0">
                        {getInitials(getUserName(project.assigned_team_leader_id))}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-white text-sm font-semibold tracking-wide block truncate">{getUserName(project.assigned_team_leader_id)}</span>
                        {getUserDesignation(project.assigned_team_leader_id) && (
                          <span className="text-[10px] text-gray-400 font-mono tracking-wide mt-1 block uppercase truncate">{getUserDesignation(project.assigned_team_leader_id)}</span>
                        )}
                      </div>
                    </div>

                    {/* Project Status Actions */}
                    {(role === 'manager' || role === 'admin') && (
                      <div className="mt-4 border-t border-white/5 pt-4 flex gap-3 relative z-10">
                        {project.status !== 'completed' ? (
                          <button
                            onClick={() => handleUpdateProjectStatus('completed')}
                            className="flex-1 py-2.5 px-3 text-[10px] font-bold tracking-widest font-mono uppercase bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-300"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Complete Project
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateProjectStatus('active')}
                            className="flex-1 py-2.5 px-3 text-[10px] font-bold tracking-widest font-mono uppercase bg-[#0d1527] border border-slate-700 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/5 hover:text-white rounded-lg flex items-center justify-center gap-1.5 transition-all duration-300 shadow-[0_0_12px_rgba(0,240,255,0.05)]"
                          >
                            <Plus className="w-3.5 h-3.5" /> Reopen Project
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Team Members Section */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Team Members ({projectMembers.length})</h4>
                    <div className="flex flex-col gap-2.5 max-h-[160px] overflow-y-auto scroll-container pr-2">
                      {projectMembers.map(member => (
                        <div key={member.id} className="flex items-center gap-3 bg-[#0d1527]/40 border border-white/3 p-2 rounded-lg hover:border-[#00f0ff]/20 transition-all duration-200">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold font-mono flex items-center justify-center text-[10px] uppercase shrink-0">
                            {getInitials(member.name)}
                          </div>
                          <div className="overflow-hidden">
                            <span className="block font-medium text-white leading-tight truncate">{member.name}</span>
                            {member.designation && member.designation !== 'Specialist' && (
                              <span className="text-[9px] text-gray-400 font-mono mt-0.5 block uppercase tracking-wider truncate">{member.designation}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {projectMembers.length === 0 && (
                        <p className="text-gray-500 italic font-mono uppercase tracking-wider py-4 text-center text-[10px]">No members assigned.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts visualizations */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Donut Chart: task status breakdown */}
              <div className="relative bg-[#090f1d]/75 border border-white/10 p-5 rounded-xl flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

                <h3 className="font-bold text-sm text-white font-heading tracking-wide uppercase flex items-center gap-2 relative z-10">
                  <BarChart2 className="w-4 h-4 text-[#00f0ff]" />
                  Task Status Breakdown
                </h3>
                <div className="h-48 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {getPieChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d1527', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff', fontSize: '9px', fontFamily: 'monospace' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Labels breakdown legend */}
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold font-mono text-gray-400 mt-2 relative z-10">
                  {getPieChartData().map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 bg-[#0d1527]/30 border border-white/3 p-1 rounded">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length], boxShadow: `0 0 6px ${CHART_COLORS[index % CHART_COLORS.length]}` }} />
                      <span className="truncate">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart: progress by member */}
              <div className="relative bg-[#090f1d]/75 border border-white/10 p-5 rounded-xl flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

                <h3 className="font-bold text-sm text-white font-heading tracking-wide uppercase flex items-center gap-2 relative z-10">
                  <BarChart2 className="w-4 h-4 text-[#8b5cf6]" />
                  Average Progress by Member (%)
                </h3>
                <div className="h-56 relative z-10">
                  {projectMembers.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs font-mono text-gray-500 italic">// NO ASSIGNED MEMBERS //</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getBarChartData()}>
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={8} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={8} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d1527', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff', fontSize: '9px', fontFamily: 'monospace' }}
                        />
                        <Bar dataKey="progress" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                          {getBarChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Line Chart: activity timeline */}
              <div className="relative bg-[#090f1d]/75 border border-white/10 p-5 rounded-xl flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00f0ff]/40 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00f0ff]/40 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00f0ff]/40 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00f0ff]/40 rounded-br" />

                <h3 className="font-bold text-sm text-white font-heading tracking-wide uppercase flex items-center gap-2 relative z-10">
                  <BarChart2 className="w-4 h-4 text-[#10b981]" />
                  Recent Activity Frequency
                </h3>
                <div className="h-56 relative z-10">
                  {logs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs font-mono text-gray-500 italic">// NO REGISTERED LOGS //</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getLineChartData()}>
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={8} />
                        <YAxis stroke="#6b7280" fontSize={8} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0d1527', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff', fontSize: '9px', fontFamily: 'monospace' }}
                        />
                        <Line type="monotone" dataKey="activities" stroke="#10b981" strokeWidth={2} dot={{ r: 3, stroke: '#10b981', strokeWidth: 1, fill: '#0d1527' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}      {/* TAB: STAGES */}
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
          return a.lineName.localeCompare(b.lineName);
        });
 
        const kickoffStatus = kickoffStage?.status || 'pending';
        const kickoffRemarks = kickoffStage?.remarks || 'No remarks provided for this stage.';
        const kickoffLastUpdated = kickoffStage?.updated_at ? new Date(kickoffStage.updated_at).toLocaleString() : null;
        const kickoffUpdatedBy = kickoffStage?.updated_by ? getUserName(kickoffStage.updated_by) : null;
 
        const isUserAuthorized = role === 'admin' || role === 'manager' || role === 'team_leader';
 
        return (
          <div className="flex flex-col gap-6">
            {/* Engineering Canvas board container */}
            <div className="bg-[#eff6ff] p-6 md:p-8 rounded-2xl border-2 border-[#93c5fd] relative overflow-x-hidden overflow-y-scroll max-h-[85vh] scroll-container-light shadow-lg">

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
                        className="px-4 py-2 text-xs font-bold bg-[#eff6ff] text-[#2563eb] border-2 border-[#93c5fd] rounded-xl hover:bg-[#dbeafe] transition-all flex items-center gap-2 shadow-sm"
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
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSubTasks}
                        disabled={subTaskSaveLoading}
                        className="px-4 py-2 text-xs font-bold bg-[#2563eb] text-white border-2 border-[#2563eb] rounded-xl hover:bg-[#1d4ed8] transition-all flex items-center gap-2"
                      >
                        {subTaskSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Back'}
                      </button>
                    </div>
                  </div>

                  {/* Overall Progress Gauge */}
                  {(() => {
                    const subTasks = subTasksData.subTasks || [];
                    let total = 0;
                    let completed = 0;
                    subTasks.forEach((st: any) => {
                      if (st.subPoints && st.subPoints.length > 0) {
                        st.subPoints.forEach((sp: any) => {
                          total++;
                          if (sp.status === 'complete' || sp.status === 'not_applicable') completed++;
                        });
                      } else {
                        total++;
                        if (st.status === 'complete' || st.status === 'not_applicable') completed++;
                      }
                    });
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div className="bg-white border-2 border-[#93c5fd] p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm">
                        <div className="flex justify-between items-center text-[10px] text-[#64748b] font-bold">
                          <span>OVERALL PROGRESS</span>
                          <span className="text-[#2563eb]">{completed}/{total} COMPLETE ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-[#dbeafe] rounded-full overflow-hidden relative border border-[#93c5fd]/50">
                          <div 
                            className="h-full bg-gradient-to-r from-[#2563eb] to-[#3b82f6] rounded-full transition-all duration-500 shadow-inner"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Checklist items */}
                  <div className="flex items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest px-4 pb-1.5 border-b-2 border-[#93c5fd]/30 mt-2">
                    <div className="flex-1 min-w-[250px]">ACTIVITY / CHECKPOINT</div>
                    <div className="w-[180px] text-center hidden md:block">TARGET DATE</div>
                    <div className="w-[280px] text-center hidden sm:block">STATUS</div>
                    <div className="w-[80px] text-center">LOGS</div>
                  </div>
                  <div className="flex flex-col max-h-[60vh] overflow-y-auto scroll-container">
                    {subTasksData.subTasks.map((task: any, index: number) => {
                      const hasSubPoints = task.subPoints && task.subPoints.length > 0;
                      const isCompleted = task.subPoints && task.subPoints.length > 0 
                        ? task.subPoints.every((sp: any) => sp.status === 'complete' || sp.status === 'not_applicable')
                        : (task.status === 'complete' || task.status === 'not_applicable');

                      const isAllowedToComplete = user?.role === 'team_leader' || user?.role === 'team_member';

                      return (
                        <div key={index} className="border-b border-[#93c5fd]/20 hover:bg-[#93c5fd]/5 transition-all py-2.5 px-4 flex flex-col gap-1.5 group">
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
                            {/* ACTIVITY / CHECKPOINT */}
                              <div className="flex items-center gap-3 min-w-[250px] flex-1">
                                {hasSubPoints ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTasks(prev => ({ ...prev, [index]: expandedTasks[index] === false ? true : false }))}
                                    className="text-[12px] font-mono text-[#2563eb] hover:text-[#1d4ed8] font-bold w-4 h-4 flex items-center justify-center border border-[#93c5fd] rounded bg-white shadow-sm transition-colors"
                                  >
                                    {expandedTasks[index] !== false ? '[-]' : '[+]'}
                                  </button>
                                ) : (
                                  <div className="w-4 h-4" />
                                )}
                                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {index + 1}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1 relative">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={task.title}
                                      onChange={(e) => {
                                        const updated = { ...subTasksData };
                                        updated.subTasks[index].title = e.target.value;
                                        setSubTasksData(updated);
                                      }}
                                      className={`bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2563eb]/50 outline-none rounded px-1.5 py-0.5 -ml-1.5 font-mono text-sm w-full transition-colors ${
                                        isCompleted
                                          ? (task.status === 'not_applicable' ? 'text-gray-400' : 'text-[#10b981] font-bold')
                                          : 'text-[#0f172a] font-bold'
                                      }`}
                                    />
                                    {(user?.role === 'manager' || user?.role === 'team_leader') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm('Are you sure you want to delete this item?')) {
                                            const updated = { ...subTasksData };
                                            updated.subTasks.splice(index, 1);
                                            setSubTasksData(updated);
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        title="Delete Item"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
                                  </div>
                                  {(task.completedBy || task.untickedBy) && (
                                    <span className="text-[9px] text-gray-500 mt-0.5 font-bold">
                                      {task.completedBy ? `// COMPLETED BY: ${task.completedBy}` : `// UNTICKED BY: ${task.untickedBy}`}
                                      {task.completedDate ? ` • ${task.completedDate.split(',')[0]}` : (task.untickedDate ? ` • ${task.untickedDate.split(',')[0]}` : '')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            
                            {/* TARGET DATE */}
                            <div className="w-full md:w-[180px] flex md:justify-center shrink-0">
                              <input
                                type="date"
                                value={task.targetDate || ''}
                                onChange={(e) => handleUpdateCheckPointTargetDate(index, e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-[#0f172a] outline-none focus:border-[#2563eb] font-mono shadow-sm w-full md:w-auto"
                              />
                            </div>

                            {/* STATUS */}
                            <div className="w-full sm:w-[280px] flex sm:justify-center shrink-0">
                              {!hasSubPoints && (
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckPointStatus(index, 'complete')}
                                    className={`px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                      task.status === 'complete' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-500 shadow-sm'
                                        : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300 hover:text-emerald-500'
                                    }`}
                                  >
                                    ✓ Complete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckPointStatus(index, 'in_progress')}
                                    className={`px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                      task.status === 'in_progress' 
                                        ? 'bg-blue-50 text-blue-600 border-blue-500 shadow-sm'
                                        : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                                    }`}
                                  >
                                    ◷ In Progress
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckPointStatus(index, 'not_applicable')}
                                    className={`px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                      task.status === 'not_applicable' 
                                        ? 'bg-gray-100 text-gray-500 border-gray-400 shadow-sm'
                                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-500'
                                    }`}
                                  >
                                    ⊖ N/A
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* LOGS & DELETE */}
                            <div className="w-auto sm:w-[80px] flex items-center justify-center shrink-0 ml-auto sm:ml-0 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTaskIndexForLogs(index);
                                  setIsTaskLogsOpen(true);
                                }}
                                className="relative flex flex-col items-center gap-1 text-gray-500 hover:text-[#2563eb] transition-colors p-1"
                              >
                                <span className="text-[18px]">📋</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest">Logs</span>
                                {(task.logs && task.logs.length > 0) ? (
                                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#2563eb] text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm">
                                    {task.logs.length}
                                  </span>
                                ) : (
                                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-gray-200 text-gray-500 rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm">
                                    0
                                  </span>
                                )}
                              </button>
                              {/* Delete button */}
                              {((selectedStageForSubTasks.stage_name === 'Project Kickoff Meeting' && index >= 2) || 
                                (selectedStageForSubTasks.stage_name.endsWith('Project Data Collection') && index >= 8) ||
                                (!selectedStageForSubTasks.stage_name.includes('Project Kickoff Meeting') && !selectedStageForSubTasks.stage_name.endsWith('Project Data Collection'))) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(confirm('Delete this task?')) {
                                      const updated = { ...subTasksData };
                                      updated.subTasks.splice(index, 1);
                                      setSubTasksData(updated);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition"
                                  title="Delete Task"
                                >
                                  ❌
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Sub-Points Section */}
                          {hasSubPoints && expandedTasks[index] !== false && (
                            <div className="border-l-2 border-[#93c5fd] pl-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 mt-2 ml-3">
                              {task.subPoints && task.subPoints.map((subPoint: any, spIndex: number) => {
                                return (
                                  <div key={spIndex} className="flex flex-col justify-between gap-2 p-2 border border-[#e2e8f0] bg-[#f8fafc] rounded-xl hover:shadow-md transition-shadow group/sub">
                                    <div className="flex justify-between items-start gap-2">
                                      <input
                                        type="text"
                                        value={subPoint.title}
                                        onChange={(e) => {
                                          const updated = { ...subTasksData };
                                          updated.subTasks[index].subPoints[spIndex].title = e.target.value;
                                          setSubTasksData(updated);
                                        }}
                                        className={`bg-transparent border border-transparent hover:border-gray-200 focus:border-[#2563eb]/50 outline-none rounded px-1 py-0.5 -ml-1 text-[10px] font-mono w-full transition-colors ${
                                          subPoint.status === 'complete'
                                            ? 'text-[#10b981] font-bold'
                                            : subPoint.status === 'not_applicable'
                                            ? 'text-gray-500'
                                            : 'text-[#0f172a] font-bold'
                                        }`}
                                      />
                                      {isAllowedToComplete && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm('Are you sure you want to delete this sub-item?')) {
                                              const updated = { ...subTasksData };
                                              updated.subTasks[index].subPoints.splice(spIndex, 1);
                                              setSubTasksData(updated);
                                            }
                                          }}
                                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all opacity-0 group-hover/sub:opacity-100 flex-shrink-0"
                                          title="Delete Sub-Item"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubPointStatus(index, spIndex, 'complete')}
                                        className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                          subPoint.status === 'complete'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-500'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300 hover:text-emerald-500'
                                        }`}
                                      >
                                        ✓ Complete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubPointStatus(index, spIndex, 'in_progress')}
                                        className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                          subPoint.status === 'in_progress'
                                            ? 'bg-blue-50 text-blue-600 border-blue-500'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                                        }`}
                                      >
                                        ◷ In Progress
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubPointStatus(index, spIndex, 'not_applicable')}
                                        className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 flex-1 justify-center ${
                                          subPoint.status === 'not_applicable'
                                            ? 'bg-gray-100 text-gray-500 border-gray-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-500'
                                        }`}
                                      >
                                        ⊖ N/A
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add sub-point button */}
                          {(!hasSubPoints || expandedTasks[index] !== false) && (
                            <div className="flex gap-2 mt-3 ml-7">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTaskIndexForAddSubPoint(index);
                                  setNewSubItemData({ name: '', targetDate: '' });
                                  setIsAddSubItemModalOpen(true);
                                }}
                                className="w-6 h-6 rounded bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] border border-[#bfdbfe] font-bold flex items-center justify-center transition-all shadow-sm"
                                title="Add Sub Item"
                              >
                                +
                              </button>
                            </div>
                          )}
                            </div>
                          );
                    })}
                  </div>

                  {/* Add New Task */}
                  <div className="bg-white border-2 border-[#93c5fd] rounded-xl p-4 shadow-sm">
                    <label className="text-[10px] text-[#64748b] font-bold uppercase tracking-wide block mb-2">Add New Task</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Type task description..."
                        value={subTaskInput}
                        onChange={(e) => setSubTaskInput(e.target.value)}
                        className="flex-1 bg-[#eff6ff] border-2 border-[#93c5fd] rounded-xl text-xs px-3 py-2 text-[#0f172a] outline-none focus:border-[#2563eb] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!subTaskInput.trim()) return;
                          const updated = { ...subTasksData };
                          const isDataCollectionType = !selectedStageForSubTasks.stage_name.includes('Kickoff');
                          const customTaskName = subTaskInput.trim();
                          const needsSubPoints = isDataCollectionType && [
                            'Sequence Sheet', 'JIG IO List', 'GA Drawing / Images'
                          ].includes(customTaskName);

                          const newTask: any = {
                            title: customTaskName,
                            status: 'pending',
                            completed: false,
                            targetDate: '',
                            completedDate: '',
                            completedBy: '',
                            untickedBy: '',
                            untickedDate: '',
                            untickedReason: ''
                          };
                          if (needsSubPoints) newTask.subPoints = [];

                          updated.subTasks.push(newTask);
                          setSubTasksData(updated);
                          setSubTaskInput('');
                        }}
                        className="w-10 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xl flex items-center justify-center transition-all shadow-md"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      disabled={subTaskSaveLoading}
                      onClick={handleSaveSubTasks}
                      className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl tracking-wide transition-all shadow-md"
                    >
                      {subTaskSaveLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Checklist'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSubTasksModalOpen(false);
                        setSelectedStageForSubTasks(null);
                        setSubTasksData(null);
                      }}
                      className="flex-1 bg-white border-2 border-[#93c5fd] hover:bg-[#eff6ff] text-[#64748b] hover:text-[#0f172a] font-bold py-3 px-4 rounded-xl transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                ) : (
                <div className="flex flex-col items-center">
                {/* FLOWCHART VIEW */}

 
                  {/* Horizontal row of columns for parallel lines */}
                  <div className="flex flex-row gap-4 overflow-x-scroll pb-4 scroll-container-light w-full items-start px-2">
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
                                <span className="font-semibold text-xs text-[#0f172a] truncate text-center" title={line.lineName}>
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
                                      className="px-1.5 py-0.5 bg-[#eff6ff] border border-[#93c5fd] hover:bg-[#dbeafe] rounded-lg text-[#2563eb] transition-all text-[8px] uppercase tracking-wide font-bold"
                                      title="Rename Line"
                                    >
                                      Rename
                                    </button>
                                    {line.lineName !== 'Main Line' && (
                                      <button
                                        onClick={() => {
                                          setLineToDelete(line.lineName);
                                          setIsDeleteLineOpen(true);
                                        }}
                                        className="px-1.5 py-0.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-red-600 transition-all text-[8px] uppercase tracking-wide font-bold"
                                        title="Delete Line"
                                      >
                                        Delete
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
                              const lastUpdated = stage.updated_at ? new Date(stage.updated_at).toLocaleString() : null;
                              const updatedBy = stage.updated_by ? getUserName(stage.updated_by) : null;

                              const isCompleted = status === 'completed';
                              const isInProgress = status === 'in_progress';
                              const isDataCollection = stage.displayName === 'Project Data Collection';

                              return (
                                <React.Fragment key={stage.id}>
                                  <div 
                                    onClick={() => {
                                      if (isUserAuthorized || role === 'team_member') {
                                        handleOpenSubTasksModal(stage);
                                      }
                                    }}
                                    className={`relative group bg-white border-2 hover:shadow-lg transition-all duration-300 rounded-2xl p-2.5 flex flex-col gap-2 justify-between w-full ${
                                      (isUserAuthorized || role === 'team_member') ? 'cursor-pointer' : ''
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
                                          {(stageIdx + 2).toString().padStart(2, '0')}
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
                                          <div className="bg-[#eff6ff] border border-[#93c5fd] rounded-xl p-2.5 flex flex-col gap-1.5 mt-1">
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

      {/* TAB: TASKS (For Manager and TL) */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-6">
          {/* TASKS STATS */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Total Tasks</span>
              <span className="text-2xl font-bold text-[#2563eb] font-mono leading-none">{tasks.length}</span>
            </div>
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Pending Tasks</span>
              <span className="text-2xl font-bold text-[#f59e0b] font-mono leading-none">{tasks.filter(t => t.status !== 'closed' && t.status !== 'approved_by_manager').length}</span>
            </div>
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Completed Tasks</span>
              <span className="text-2xl font-bold text-[#10b981] font-mono leading-none">{tasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length}</span>
            </div>
          </div>
          {/* PENDING MANAGER APPROVALS ROW (Visible only to Manager) */}
          {role === 'manager' && tasks.filter(t => t.status === 'approved_by_tl').length > 0 && (
            <div 
              className="relative bg-[#090f1d]/85 border border-amber-500/30 p-5 rounded-xl flex flex-col gap-4 shadow-lg overflow-hidden"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.03), rgba(245, 158, 11, 0.03) 10px, transparent 10px, transparent 20px)' }}
            >
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-400" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400" />

              <h2 className="font-bold text-xs font-mono text-amber-400 flex items-center gap-2 uppercase tracking-widest">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                // PENDING MANAGER VERIFICATION ({tasks.filter(t => t.status === 'approved_by_tl').length}) //
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {tasks.filter(t => t.status === 'approved_by_tl').map(task => (
                  <div key={task.id} className="relative bg-[#0d1527] border border-white/5 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                    <div>
                      <h4 className="font-bold text-white tracking-wide uppercase">{task.title}</h4>
                      <p className="text-gray-400 mt-1 leading-relaxed text-[11px]">{task.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2.5 text-gray-500 text-[9px] uppercase tracking-wider">
                        <span>OWNER: <strong className="text-[#00f0ff] font-bold">{getUserName(task.assigned_to)}</strong></span>
                        <span>TL_REV: <strong className="text-purple-400 font-bold">{getUserName(project.assigned_team_leader_id)}</strong></span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleManagerReview(task.id, 'approve')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      >
                        Approve & Close
                      </button>
                      <button
                        onClick={() => handleManagerReview(task.id, 'rework')}
                        className="bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95"
                      >
                        Send Back Rework
                      </button>
                      <button
                        onClick={() => handleManagerReview(task.id, 'reject')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95"
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
              className="relative bg-[#090f1d]/85 border border-purple-500/30 p-5 rounded-xl flex flex-col gap-4 shadow-lg overflow-hidden"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(139, 92, 246, 0.03), rgba(139, 92, 246, 0.03) 10px, transparent 10px, transparent 20px)' }}
            >
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-purple-400" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-purple-400" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-purple-400" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-purple-400" />

              <h2 className="font-bold text-xs font-mono text-purple-400 flex items-center gap-2 uppercase tracking-widest">
                <AlertOctagon className="w-4 h-4 text-purple-400 animate-pulse" />
                // PENDING LEADER VERIFICATION ({tasks.filter(t => t.status === 'completed_by_member').length}) //
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {tasks.filter(t => t.status === 'completed_by_member').map(task => (
                  <div key={task.id} className="relative bg-[#0d1527] border border-white/5 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                    <div>
                      <h4 className="font-bold text-white tracking-wide uppercase">{task.title}</h4>
                      <p className="text-gray-400 mt-1 leading-relaxed text-[11px]">{task.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2.5 text-gray-500 text-[9px] uppercase tracking-wider">
                        <span>OWNER: <strong className="text-[#00f0ff] font-bold">{getUserName(task.assigned_to)}</strong></span>
                        <span>WORKFLOW: <strong className="text-purple-400 font-bold">{task.assigned_by_role === 'manager' ? 'A (MANAGER TASK)' : 'B (TL TASK)'}</strong></span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'approve')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'rework')}
                        className="bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95"
                      >
                        Rework
                      </button>
                      <button
                        onClick={() => handleTeamLeaderReview(task.id, 'reject')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95"
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
          <div className="relative bg-[#090f1d]/80 border border-white/10 p-4 rounded-xl flex flex-wrap gap-5 items-center text-xs font-mono">
            <span className="font-bold text-[#00f0ff] uppercase tracking-widest">// FILTER CONSOLE //</span>
            
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">STATUS</label>
              <select 
                value={taskStatusFilter} 
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="bg-[#0d1527] border border-white/10 rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-white outline-none focus:border-[#00f0ff]/50 focus:shadow-[0_0_8px_rgba(0,240,255,0.1)] transition-all duration-200"
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
              <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">PRIORITY</label>
              <select 
                value={taskPriorityFilter} 
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="bg-[#0d1527] border border-white/10 rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-white outline-none focus:border-[#00f0ff]/50 focus:shadow-[0_0_8px_rgba(0,240,255,0.1)] transition-all duration-200"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">ASSIGNEE</label>
              <select 
                value={taskAssigneeFilter} 
                onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                className="bg-[#0d1527] border border-white/10 rounded-lg text-[10.5px] font-mono px-3 py-1.5 text-white outline-none focus:border-[#00f0ff]/50 focus:shadow-[0_0_8px_rgba(0,240,255,0.1)] transition-all duration-200"
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
          <div className="relative bg-[#090f1d]/60 border border-white/10 p-5 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.02)] overflow-hidden">
            {/* L-brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#00f0ff]/40 rounded-tl" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#00f0ff]/40 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#00f0ff]/40 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#00f0ff]/40 rounded-br" />

            <h2 className="font-bold text-xs text-white font-mono tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1 h-3 bg-[#00f0ff] inline-block rounded-full" />
              // TASKS DATA LEDGER //
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3.5 px-4">// TASK TITLE</th>
                    <th className="py-3.5 px-4">ASSIGNEE</th>
                    <th className="py-3.5 px-4">ASSIGNER</th>
                    <th className="py-3.5 px-4">PRIORITY</th>
                    <th className="py-3.5 px-4">DUE DATE</th>
                    <th className="py-3.5 px-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {filteredTasks.map(task => (
                    <tr 
                      key={task.id} 
                      onClick={() => {
                        setSelectedTask(task);
                        setIsTaskDetailsOpen(true);
                      }}
                      className="hover:bg-[#00f0ff]/5 transition-all duration-200 cursor-pointer text-[10.5px]"
                    >
                      <td className="py-4 px-4 font-bold text-white max-w-xs truncate uppercase tracking-wide group-hover:text-[#00f0ff]">{task.title}</td>
                      <td className="py-4 px-4 text-gray-300 font-semibold">{getUserName(task.assigned_to)}</td>
                      <td className="py-4 px-4 text-gray-400">{getUserName(task.assigned_by) || getUserName(project?.created_by)}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getPriorityColorClass(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-400">{task.target_date || '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getStatusColorClass(task.status)}`}>
                          {task.status === 'closed' ? 'APPROVED' : task.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500 italic">// NO MAPPED DATA MATCHING SEARCH FILTERS //</td>
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
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Total Tasks</span>
              <span className="text-2xl font-bold text-[#2563eb] font-mono leading-none">{tasks.length}</span>
            </div>
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Pending Tasks</span>
              <span className="text-2xl font-bold text-[#f59e0b] font-mono leading-none">{tasks.filter(t => t.status !== 'closed' && t.status !== 'approved_by_manager').length}</span>
            </div>
            <div className="bg-[#eff6ff] border-2 border-[#93c5fd] px-6 py-4 rounded-xl text-center shadow-sm">
              <span className="block text-[10px] text-[#64748b] font-bold tracking-widest uppercase mb-1">Completed Tasks</span>
              <span className="text-2xl font-bold text-[#10b981] font-mono leading-none">{tasks.filter(t => t.status === 'closed' || t.status === 'approved_by_manager').length}</span>
            </div>
          </div>
          <h2 className="text-sm font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
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
                  className="relative bg-[#090f1d]/80 border border-white/5 hover:border-[#00f0ff]/30 p-5 rounded-xl flex flex-wrap justify-between items-center gap-4 transition-all duration-300 group shadow-md shadow-black/20 cursor-pointer"
                >
                  {/* Micro L-brackets */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/5 group-hover:border-[#00f0ff]/55 rounded-tl transition" />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-white/5 group-hover:border-[#00f0ff]/55 rounded-tr transition" />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-white/5 group-hover:border-[#00f0ff]/55 rounded-bl transition" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/5 group-hover:border-[#00f0ff]/55 rounded-br transition" />

                  <div className="flex-1 min-w-0 font-mono">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getPriorityColorClass(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">TARGET_TX_DEADLINE: {task.target_date || '-'}</span>
                    </div>
                    <h3 className="font-bold text-xs text-white mt-2 group-hover:text-[#00f0ff] uppercase tracking-wider transition-colors truncate">{task.title}</h3>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status */}
                    <div className="font-mono">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border ${getStatusColorClass(task.status)}`}>
                        {task.status === 'closed' ? 'APPROVED' : task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#00f0ff] group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              );
            })}
            {memberFilteredTasks.length === 0 && (
              <div className="relative bg-[#090f1d]/40 border border-dashed border-white/10 p-8 rounded-xl text-center">
                <p className="text-gray-500 italic font-mono text-xs">// NO PENDING ASSIGNED TASKS IN OPERATIONS BUFFER //</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <div className="flex flex-col gap-6">
          <h2 className="text-sm font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-emerald-500 inline-block rounded-full animate-pulse" />
            // PROJECT LOGGED ACHIEVEMENTS //
          </h2>

          <div className="flex flex-col gap-4">
            {achievements.map(ach => (
              <div key={ach.id} className="relative bg-[#090f1d]/85 border border-emerald-500/20 hover:border-emerald-500/40 p-5 rounded-xl flex flex-col gap-3 text-xs transition-all duration-300 shadow-md shadow-black/30 overflow-hidden group">
                {/* Emerald L-brackets */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500/30 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500/30 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-500/30 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-500/30 rounded-br" />
                
                {/* Header */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider group-hover:text-emerald-400 transition-colors">{ach.title}</h3>
                    <span className="text-[9px] text-gray-500 mt-1 block font-mono uppercase tracking-wider">
                      TX_SYS_LOGGED: <strong className="text-gray-300 font-bold">{getUserName(ach.submitted_by)}</strong> ON {new Date(ach.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold font-mono uppercase border tracking-wider transition ${
                    ach.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    ach.approval_status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                  }`}>
                    {ach.approval_status}
                  </span>
                </div>

                {/* Details */}
                <p className="text-gray-300 leading-relaxed text-xs font-mono">{ach.details}</p>

                {ach.attachment_url && (
                  <div className="mt-1 flex items-center gap-1.5 text-blue-400 font-mono text-[9px] uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attachment: {ach.attachment_url}</span>
                  </div>
                )}

                {/* Manager remarks */}
                {ach.manager_remarks && (
                  <div className="relative bg-black/55 border border-white/10 p-3 rounded-lg mt-2 max-w-md font-mono text-[10px]">
                    <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-white/30" />
                    <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-white/30" />
                    <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-white/30" />
                    <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-white/30" />

                    <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest">// MANAGER FEEDBACK SYS //</span>
                    <p className="text-white mt-1 leading-normal italic font-semibold">&quot;{ach.manager_remarks}&quot;</p>
                    <span className="text-[8px] text-gray-500 mt-1 block uppercase">REVIEWER: {getUserName(ach.reviewed_by)}</span>
                  </div>
                )}

                {/* Manager Review Action triggers */}
                {role === 'manager' && ach.approval_status === 'pending' && (
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
            <h2 className="text-sm font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
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
                  className={`relative bg-[#090f1d]/85 border p-5 rounded-xl flex flex-col gap-3.5 text-xs transition-all duration-300 shadow-md shadow-black/30 overflow-hidden ${
                    isResolved ? 'border-emerald-500/25 hover:border-emerald-500/40' : 'border-red-500/25 hover:border-red-500/40'
                  }`}
                >
                  {/* Status specific L-brackets */}
                  <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l rounded-tl ${isResolved ? 'border-emerald-500/35' : 'border-red-500/35'}`} />
                  <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r rounded-tr ${isResolved ? 'border-emerald-500/35' : 'border-red-500/35'}`} />
                  <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l rounded-bl ${isResolved ? 'border-emerald-500/35' : 'border-red-500/35'}`} />
                  <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r rounded-br ${isResolved ? 'border-emerald-500/35' : 'border-red-500/35'}`} />

                  {/* Header */}
                  <div className="flex justify-between items-center gap-4 border-b border-white/5 pb-2.5">
                    <div>
                      <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">{iss.title}</h3>
                      <span className="text-[9px] text-gray-500 mt-1 block font-mono uppercase tracking-wider">
                        TX_SYS_LOGGED: <strong className="text-gray-300 font-bold">{getUserName(iss.raised_by)}</strong> ON {new Date(iss.raised_at).toLocaleDateString()}
                      </span>
                    </div>
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold font-mono uppercase border tracking-wider transition ${
                      isResolved 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse'
                    }`}>
                      {iss.status}
                    </span>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#0d1527] p-3 rounded-lg border border-white/5 font-mono text-[9.5px]">
                    <div>
                      <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">Reported By</span>
                      <span className="text-white font-bold block mt-0.5 uppercase">{iss.reported_by_name || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">Occurrence Date</span>
                      <span className="text-white font-bold block mt-0.5">{iss.occurrence_date ? new Date(iss.occurrence_date).toLocaleDateString() : '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">Responsible Person</span>
                      <span className="text-white font-bold block mt-0.5 uppercase">{getUserName(iss.responsible_person_id)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">Location (P/L/S)</span>
                      <span className="text-white font-bold block mt-0.5 uppercase text-[#00f0ff]">
                        {iss.plant || '-'}{iss.line ? ` / ${iss.line}` : ''}{iss.station ? ` / ${iss.station}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Long text fields */}
                  <div className="flex flex-col gap-3 font-mono">
                    <div>
                      <span className="block text-[8.5px] text-red-400/70 uppercase tracking-widest">// Issue Description</span>
                      <p className="text-gray-300 leading-relaxed text-xs mt-0.5 font-medium">{iss.description}</p>
                    </div>
                    <div>
                      <span className="block text-[8.5px] text-red-400/70 uppercase tracking-widest">// Condition for Occurrence</span>
                      <p className="text-gray-300 leading-relaxed text-xs mt-0.5 font-medium">{iss.occurrence_condition || '-'}</p>
                    </div>
                    <div>
                      <span className="block text-[8.5px] text-red-400/70 uppercase tracking-widest">// Temporary Action Taken</span>
                      <p className="text-gray-300 leading-relaxed text-xs mt-0.5 font-medium">{iss.temporary_action || '-'}</p>
                    </div>
                    <div>
                      <span className="block text-[8.5px] text-red-400/70 uppercase tracking-widest">// Permanent Countermeasure / Lesson learned</span>
                      <p className="text-gray-300 leading-relaxed text-xs mt-0.5 font-medium">{iss.permanent_countermeasure || '-'}</p>
                    </div>
                  </div>

                  {iss.attachment_url && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-blue-400 font-mono text-[9px] uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Attachment: {iss.attachment_url}</span>
                    </div>
                  )}

                  {/* Resolution remarks details */}
                  {iss.resolution_remarks && (
                    <div className="relative bg-emerald-950/10 border border-emerald-500/20 p-3.5 rounded-lg mt-2 max-w-md font-mono text-[10px]">
                      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-emerald-500/30" />
                      <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-emerald-500/30" />
                      <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-emerald-500/30" />
                      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-emerald-500/30" />

                      <span className="block text-[8px] text-emerald-400 font-bold uppercase tracking-widest">// RESOLVED SYSTEM COUNTERMEASURE //</span>
                      <p className="text-white mt-1 leading-normal italic font-semibold">&quot;{iss.resolution_remarks}&quot;</p>
                      <span className="text-[8px] text-gray-500 mt-1 block uppercase">RESOLVED DATE: {iss.occurrence_date ? new Date(iss.occurrence_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  )}

                  {/* Resolve Issue Action Button (For Manager & TL when open) */}
                  {!isResolved && (role === 'manager' || role === 'team_leader') && (
                    <div className="border-t border-white/5 pt-3.5 mt-2 flex justify-start">
                      <button
                        onClick={() => {
                          setSelectedIssueId(iss.id);
                          setIsResolveIssueOpen(true);
                        }}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-mono font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      >
                        Mark as Resolved
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
            {issues.length === 0 && (
              <div className="relative bg-[#090f1d]/40 border border-dashed border-white/10 p-8 rounded-xl text-center">
                <p className="text-gray-500 italic font-mono text-xs">// NO INCIDENT LOGS DETECTED ON OPERATIONS GRIDS //</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ACTIVITY LOG */}
      {activeTab === 'activity-log' && (
        <div className="relative bg-[#090f1d]/60 border border-white/10 p-6 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.02)] overflow-hidden">
          {/* L-brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#00f0ff]/50 rounded-tl" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#00f0ff]/50 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#00f0ff]/50 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#00f0ff]/50 rounded-br" />

          <h2 className="text-sm font-bold text-white mb-6 font-mono tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#00f0ff] inline-block rounded-full animate-pulse" />
            // TELEMETRY CHRONOLOGICAL SYSTEM LOGS //
          </h2>

          <div className="overflow-x-auto max-h-[480px] scroll-container">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 font-bold uppercase tracking-wider text-[9px] sticky top-0 bg-[#090f1d] z-10 py-3">
                  <th className="py-3 px-4">// TIMESTAMP</th>
                  <th className="py-3 px-4">SYS_ACTOR</th>
                  <th className="py-3 px-4">SYS_ACTION</th>
                  <th className="py-3 px-4">TX_PAYLOAD_DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#00f0ff]/2 transition-all duration-200 align-top text-[10.5px]">
                    <td className="py-3.5 px-4 text-emerald-400 font-bold whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap uppercase">
                      {getUserName(log.user_id)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25 uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 max-w-sm overflow-hidden text-ellipsis leading-relaxed uppercase text-[9.5px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-500 italic">// SYSTEM LOGSTREAM IS VACANT //</td>
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

            <form onSubmit={handleAssignTask} className="flex flex-col gap-3.5">
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">TASK TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Implement layout"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  className="w-full bg-[#0d1527] border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-[#00f0ff]/50 transition-all"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">DESCRIPTION</label>
                <textarea
                  placeholder="Task details and expectations..."
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
              {role === 'manager' && (
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
                    <thead className="bg-[#eff6ff] text-[#2563eb] sticky top-0 z-10 shadow-sm border-b-2 border-[#93c5fd]">
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
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-[#eff6ff]">
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
                        remarkClasses = 'bg-[#eff6ff] text-[#1e3a8a] border-[#93c5fd]';
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

      </div>
  );
}

