'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Save, 
  X,
  Loader2,
  CheckCircle,
  FileText,
  Download,
  Users
} from 'lucide-react';

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  project_code: string;
  time_in: string;
  time_out: string;
  work_details: string;
}

export default function DailyWorkReportPage() {
  const { user, loading: userLoading } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data for form
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  
  // TL Monitoring State
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([]);
  const [viewedUserId, setViewedUserId] = useState<string>('');
  const [viewedUserName, setViewedUserName] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // CSV Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvStart, setCsvStart] = useState('');
  const [csvEnd, setCsvEnd] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    id: '', // Empty if new
    projectCode: '',
    timeIn: '09:00',
    timeOut: '17:00',
    workDetails: ''
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Initialize viewedUserId
  useEffect(() => {
    if (user && !viewedUserId) {
      setViewedUserId(user.id);
      setViewedUserName(user.name);
    }
  }, [user, viewedUserId]);

  // Load user dependencies (Projects & Team Members)
  useEffect(() => {
    if (!user) return;

    const fetchDependencies = async () => {
      try {
        if (user.role === 'manager') {
          // Fetch all Team Leaders and Team Members under this manager
          const { data: hierarchy } = await supabase
            .from('hierarchy')
            .select(`
              team_leader_id,
              team_member_id,
              leader:users!hierarchy_team_leader_id_fkey(name),
              member:users!hierarchy_team_member_id_fkey(name)
            `)
            .eq('manager_id', user.id);
            
          if (hierarchy) {
            const members = hierarchy.flatMap((h: any) => {
              const res = [];
              if (h.team_leader_id) res.push({ id: h.team_leader_id, name: (h.leader as any)?.name ? `${(h.leader as any).name} (TL)` : 'Unknown TL' });
              if (h.team_member_id) res.push({ id: h.team_member_id, name: (h.member as any)?.name ? `${(h.member as any).name} (Member)` : 'Unknown Member' });
              return res;
            });
            const uniqueMembers = Array.from(new Map(members.map((item: any) => [item.id, item])).values()) as {id: string, name: string}[];
            setTeamMembers(uniqueMembers);
          }
        } else if (user.role === 'team_leader') {
          // Fetch Team Members
          const { data: hierarchy } = await supabase
            .from('hierarchy')
            .select('team_member_id, users!hierarchy_team_member_id_fkey(name)')
            .eq('team_leader_id', user.id);
            
          if (hierarchy) {
            const members = hierarchy
              .filter((h: any) => h.team_member_id)
              .map((h: any) => ({
                id: h.team_member_id,
                name: (h.users as any)?.name || 'Unknown'
              }));
            // Deduplicate if needed
            const uniqueMembers = Array.from(new Map(members.map((item: any) => [item.id, item])).values()) as {id: string, name: string}[];
            setTeamMembers(uniqueMembers);
          }
        }

        // Fetch Projects
        if (user.role === 'team_member') {
          const { data: pm } = await supabase
            .from('project_members')
            .select('projects(project_code)')
            .eq('team_member_id', user.id);
            
          if (pm) {
            const codes = pm.map((p: any) => p.projects?.project_code).filter(Boolean);
            setAssignedProjects(Array.from(new Set(codes)));
          }
        } else if (user.role === 'team_leader') {
          const { data: p } = await supabase
            .from('projects')
            .select('project_code')
            .eq('assigned_team_leader_id', user.id);
            
          if (p) {
            const codes = p.map((proj: any) => proj.project_code).filter(Boolean);
            setAssignedProjects(Array.from(new Set(codes)));
          }
        }
      } catch (err) {
        console.error("Error fetching dependencies:", err);
      }
    };

    fetchDependencies();
  }, [user]);

  // Load Reports for current month based on viewedUserId
  useEffect(() => {
    if (!viewedUserId) return;

    const fetchReports = async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('daily_work_reports')
          .select('*')
          .eq('user_id', viewedUserId)
          .gte('report_date', startOfMonth)
          .lte('report_date', endOfMonth);

        if (error) throw error;
        setReports(data || []);
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [viewedUserId, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const elapsedDays = isCurrentMonth ? today.getDate() : (today.getTime() < new Date(year, month, 1).getTime() ? 0 : daysInMonth);

  const stats = useMemo(() => {
    let submitted = 0;
    let leave = 0;
    let holidays = 0;
    let weekOffs = 0;
    
    reports.forEach(r => {
      if (r.project_code === 'Leave') leave++;
      else if (r.project_code === 'Holiday') holidays++;
      else if (r.project_code === 'Week-Off') weekOffs++;
      else submitted++;
    });

    const pending = Math.max(0, elapsedDays - (submitted + leave + holidays + weekOffs));
    return { submitted, pending, leave, holidays };
  }, [reports, elapsedDays]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isReadOnly = viewedUserId !== user?.id;

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    // Don't allow future dates
    if (clickedDate > new Date()) {
      alert("You cannot interact with future dates.");
      return;
    }

    const dateStr = clickedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const existingReport = reports.find(r => r.report_date === dateStr);

    if (isReadOnly && !existingReport) {
      // Prevent TL from opening an empty modal for a team member
      return;
    }

    setSelectedDate(clickedDate);
    setErrorMsg('');

    if (existingReport) {
      setFormData({
        id: existingReport.id,
        projectCode: existingReport.project_code,
        timeIn: existingReport.time_in.substring(0, 5),
        timeOut: existingReport.time_out.substring(0, 5),
        workDetails: existingReport.work_details
      });
    } else {
      setFormData({
        id: '',
        projectCode: assignedProjects.length > 0 ? assignedProjects[0] : '',
        timeIn: '09:00',
        timeOut: '17:00',
        workDetails: ''
      });
    }
    
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !selectedDate || isReadOnly) return;
    
    const isExempt = ['Leave', 'Holiday', 'Week-Off'].includes(formData.projectCode);

    if (!formData.projectCode || (!isExempt && (!formData.timeIn || !formData.timeOut || !formData.workDetails))) {
      setErrorMsg('All applicable fields are mandatory.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    const dateStr = selectedDate.toLocaleDateString('en-CA');

    try {
      const payload = {
        user_id: user.id,
        report_date: dateStr,
        project_code: formData.projectCode,
        time_in: isExempt ? '00:00' : formData.timeIn,
        time_out: isExempt ? '00:00' : formData.timeOut,
        work_details: isExempt ? 'N/A' : formData.workDetails,
        updated_at: new Date().toISOString()
      };

      let newReport = null;

      if (formData.id) {
        // Update
        const { data, error } = await supabase
          .from('daily_work_reports')
          .update(payload)
          .eq('id', formData.id)
          .select()
          .single();
        if (error) throw error;
        newReport = data;
        setReports(prev => prev.map(r => r.id === formData.id ? data : r));
      } else {
        // Insert
        const { data, error } = await supabase
          .from('daily_work_reports')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        newReport = data;
        setReports(prev => [...prev, data]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while saving the report.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = async () => {
    if (!csvStart || !csvEnd || !viewedUserId) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('daily_work_reports')
        .select('*')
        .eq('user_id', viewedUserId)
        .gte('report_date', csvStart)
        .lte('report_date', csvEnd)
        .order('report_date', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert("No reports found for this date range.");
        setIsExporting(false);
        return;
      }

      const headers = ['Date', 'Project Code', 'Time In', 'Time Out', 'Work Details'];
      const csvContent = [
        headers.join(','),
        ...data.map((row: any) => {
          return [
            row.report_date,
            `"${row.project_code}"`,
            row.time_in.substring(0, 5),
            row.time_out.substring(0, 5),
            `"${row.work_details.replace(/"/g, '""')}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Work_Report_${viewedUserName}_${csvStart}_to_${csvEnd}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsCsvModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (user?.role !== 'team_leader' && user?.role !== 'team_member' && user?.role !== 'manager') {
    return (
      <div className="p-8 text-center text-gray-400">
        You do not have permission to view this module.
      </div>
    );
  }

  // Generate calendar grid
  const calendarCells = [];
  // Empty slots for start of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="min-h-0 border border-white/5 bg-[#0a0f1a]/50 rounded-lg opacity-50" />);
  }
  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = new Date(year, month, day).toLocaleDateString('en-CA');
    const existingReport = reports.find(r => r.report_date === dateStr);
    const hasReport = !!existingReport;
    const isToday = new Date().toLocaleDateString('en-CA') === dateStr;
    const isFuture = new Date(year, month, day) > new Date();

    const canInteract = !isFuture && (!isReadOnly || hasReport);

    let cardStyle = '';
    let statusIcon = null;
    
    if (hasReport && existingReport) {
      if (existingReport.project_code === 'Leave') {
        cardStyle = 'border-l-4 border-l-blue-500 bg-blue-500/5 border-white/5';
      } else if (existingReport.project_code === 'Holiday') {
        cardStyle = 'border-l-4 border-l-purple-500 bg-purple-500/5 border-white/5';
      } else if (existingReport.project_code === 'Week-Off') {
        cardStyle = 'border-l-4 border-l-gray-600 bg-gray-500/5 border-white/5 opacity-60';
      } else {
        cardStyle = 'border-l-4 border-l-emerald-500 bg-emerald-500/5 border-white/5';
        statusIcon = <span title="Submitted"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /></span>;
      }
    } else if (!isFuture && !isToday && canInteract) {
      // Missing report
      cardStyle = 'border-l-4 border-l-orange-500 bg-orange-500/5 border-white/5';
    } else {
      cardStyle = isToday ? 'bg-blue-900/10 border border-blue-500/30' : 'bg-[#0f172a] border border-white/5';
    }

    calendarCells.push(
      <div 
        key={`day-${day}`} 
        onClick={() => canInteract && handleDayClick(day)}
        className={`rounded-lg p-2.5 transition-all duration-200 relative group flex flex-col overflow-hidden h-full
          ${!canInteract ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}
          ${cardStyle}
        `}
      >
        <div className="flex justify-between items-start mb-1.5">
          <span className={`text-[13px] font-bold ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
            {String(day).padStart(2, '0')}
          </span>
          {statusIcon}
        </div>
        
        {hasReport && existingReport ? (
          <div className="flex flex-col gap-1 mt-auto">
            <div className="text-[11px] font-bold text-gray-100 truncate">{existingReport.project_code}</div>
            {!['Leave', 'Holiday', 'Week-Off'].includes(existingReport.project_code) && (
              <div className="text-[10px] font-medium text-gray-400 truncate">{existingReport.time_in.substring(0, 5)} - {existingReport.time_out.substring(0, 5)}</div>
            )}
          </div>
        ) : !isFuture && !isReadOnly ? (
          <div className="text-[10px] text-gray-500 font-medium mt-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            + Add Report
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-4 mx-auto flex flex-col h-[calc(100vh-80px)] gap-4 pb-4">
      {/* Enterprise Compact Header */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-transparent p-2 border-b border-white/5">
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            Daily Work Report
          </h1>
          {['team_leader', 'manager'].includes(user?.role || '') && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
              <Users className="w-4 h-4 text-gray-400" />
              <select
                value={viewedUserId}
                onChange={(e) => {
                  setViewedUserId(e.target.value);
                  if (e.target.value === user.id) {
                    setViewedUserName(user.name);
                  } else {
                    const member = teamMembers.find(m => m.id === e.target.value);
                    if (member) setViewedUserName(member.name);
                  }
                }}
                className="bg-transparent text-sm text-gray-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value={user.id} className="bg-[#0f172a]">Myself</option>
                {teamMembers.length > 0 && <optgroup label="My Team" className="bg-[#0f172a]">
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </optgroup>}
              </select>
            </div>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-6 text-xs font-semibold border-x border-white/10 px-6 uppercase tracking-wider">
          <div className="flex items-center gap-2" title="Submitted"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div><span className="text-gray-300">{stats.submitted}</span></div>
          <div className="flex items-center gap-2" title="Pending"><div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div><span className="text-gray-300">{stats.pending}</span></div>
          <div className="flex items-center gap-2" title="Leave"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div><span className="text-gray-300">{stats.leave}</span></div>
          <div className="flex items-center gap-2" title="Holidays"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div><span className="text-gray-300">{stats.holidays}</span></div>
        </div>
        
        <div className="flex items-center gap-4 flex-1 justify-end">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-28 text-center font-semibold text-white text-sm">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => {
              const y = year;
              const m = String(month + 1).padStart(2, '0');
              const d = new Date(y, month + 1, 0).getDate();
              setCsvStart(`${y}-${m}-01`);
              setCsvEnd(`${y}-${m}-${d}`);
              setIsCsvModalOpen(true);
            }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col flex-1 min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2 flex-shrink-0">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 gap-2 flex-1 min-h-0">
              {calendarCells}
            </div>
          </>
        )}
      </div>

      {/* Daily Report Modal Form */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-transparent">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  {isReadOnly ? 'View Work Report' : formData.id ? 'Edit Work Report' : 'Submit Work Report'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  For {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircleIcon className="w-4 h-4 flex-shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee Name</label>
                  <input 
                    type="text" 
                    value={viewedUserName} 
                    disabled 
                    className="w-full bg-[#0a0f1a] border border-white/5 text-gray-300 px-4 py-2.5 rounded-xl text-sm cursor-not-allowed"
                  />
                </div>

                {/* Project Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Code {(!isReadOnly) && <span className="text-red-400">*</span>}</label>
                  <select 
                    value={formData.projectCode}
                    onChange={(e) => setFormData({...formData, projectCode: e.target.value})}
                    disabled={isReadOnly}
                    className={`w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                  >
                    <option value="" disabled>Select a Project</option>
                    <optgroup label="General Options">
                      <option value="Leave">Leave</option>
                      <option value="Holiday">Holiday</option>
                      <option value="Week-Off">Week-Off</option>
                    </optgroup>
                    <optgroup label="Assigned Projects">
                      {assignedProjects.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {!['Leave', 'Holiday', 'Week-Off'].includes(formData.projectCode) && (
                <div className="grid grid-cols-2 gap-5">
                  {/* Time In */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Time In {(!isReadOnly) && <span className="text-red-400">*</span>}
                    </label>
                    <input 
                      type="time" 
                      value={formData.timeIn}
                      onChange={(e) => setFormData({...formData, timeIn: e.target.value})}
                      disabled={isReadOnly}
                      className={`w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none [color-scheme:dark] transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                    />
                  </div>

                  {/* Time Out */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Time Out {(!isReadOnly) && <span className="text-red-400">*</span>}
                    </label>
                    <input 
                      type="time" 
                      value={formData.timeOut}
                      onChange={(e) => setFormData({...formData, timeOut: e.target.value})}
                      disabled={isReadOnly}
                      className={`w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none [color-scheme:dark] transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                    />
                  </div>
                </div>
              )}

              {/* Work Details */}
              {!['Leave', 'Holiday', 'Week-Off'].includes(formData.projectCode) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Work Details {(!isReadOnly) && <span className="text-red-400">*</span>}</label>
                  <textarea 
                    value={formData.workDetails}
                    onChange={(e) => setFormData({...formData, workDetails: e.target.value})}
                    rows={5}
                    disabled={isReadOnly}
                    placeholder="Enter a detailed description of the work performed today..."
                    className={`w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-3 rounded-xl text-sm outline-none resize-none custom-scrollbar transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                  ></textarea>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-[#0f172a] rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {isReadOnly ? 'Close' : 'Cancel'}
              </button>
              {!isReadOnly && (
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : formData.id ? 'Update Report' : 'Submit Report'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CSV Export Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                Export to CSV
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Start Date</label>
                <input 
                  type="date" 
                  value={csvStart}
                  onChange={(e) => setCsvStart(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">End Date</label>
                <input 
                  type="date" 
                  value={csvEnd}
                  onChange={(e) => setCsvEnd(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-[#0a0f1a] rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleExportCSV}
                disabled={isExporting || !csvStart || !csvEnd}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Missing inline icon components used above
function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  )
}

function AlertCircleIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
    </svg>
  )
}
