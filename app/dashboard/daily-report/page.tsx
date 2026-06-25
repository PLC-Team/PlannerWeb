'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { getAllProjectCodes } from '@/app/actions/projects';
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

const getMidnightDate = (dateVal: Date | string) => {
  const d = new Date(dateVal);
  if (typeof dateVal === 'string' && dateVal.length === 10) {
    const [y, m, day] = dateVal.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10), 0, 0, 0, 0);
  }
  d.setHours(0,0,0,0);
  return d;
}

const dayDiff = (date1: Date | string, date2: Date | string) => {
  const d1 = getMidnightDate(date1);
  const d2 = getMidnightDate(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  project_code: string;
  time_in: string;
  time_out: string;
  work_details: string;
  created_at: string;
}

export default function DailyWorkReportPage() {
  const { user, loading: userLoading } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data for form
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  
  // TL Monitoring State
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string, employee_id?: string}[]>([]);
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
  const [csvExportScope, setCsvExportScope] = useState<'selected' | 'all'>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('excel');
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
  }, [user?.id, user?.name, viewedUserId]);

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
              leader:users!hierarchy_team_leader_id_fkey(name, employee_id),
              member:users!hierarchy_team_member_id_fkey(name, employee_id)
            `)
            .eq('manager_id', user.id);
            
          if (hierarchy) {
            const members = hierarchy.flatMap((h: any) => {
              const res = [];
              if (h.team_leader_id) res.push({ id: h.team_leader_id, name: (h.leader as any)?.name || 'Unknown TL', employee_id: (h.leader as any)?.employee_id });
              if (h.team_member_id) res.push({ id: h.team_member_id, name: (h.member as any)?.name || 'Unknown Member', employee_id: (h.member as any)?.employee_id });
              return res;
            });
            const uniqueMembers = Array.from(new Map(members.map((item: any) => [item.id, item])).values()) as {id: string, name: string, employee_id?: string}[];
            setTeamMembers(uniqueMembers);
          }
        } else if (user.role === 'team_leader') {
          // Fetch Team Members
          const { data: hierarchy } = await supabase
            .from('hierarchy')
            .select('team_member_id, users!hierarchy_team_member_id_fkey(name, employee_id)')
            .eq('team_leader_id', user.id);
            
          if (hierarchy) {
            const members = hierarchy
              .filter((h: any) => h.team_member_id)
              .map((h: any) => ({
                id: h.team_member_id,
                name: (h.users as any)?.name || 'Unknown',
                employee_id: (h.users as any)?.employee_id
              }));
            // Deduplicate if needed
            const uniqueMembers = Array.from(new Map(members.map((item: any) => [item.id, item])).values()) as {id: string, name: string}[];
            setTeamMembers(uniqueMembers);
          }
        }

        // Fetch All Projects globally via Server Action
        const res = await getAllProjectCodes();
        if (res.success && res.codes) {
          setAssignedProjects(res.codes);
        }
      } catch (err) {
        console.error("Error fetching dependencies:", err);
      }
    };

    fetchDependencies();
  }, [user?.id, user?.role, user?.name]);

  // Load Reports for current month based on viewedUserId
  const fetchReports = async () => {
    if (!viewedUserId) return null;
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_work_reports')
      .select('*')
      .eq('user_id', viewedUserId)
      .gte('report_date', startOfMonth)
      .lte('report_date', endOfMonth);

    if (error) throw error;
    return data || [];
  };

  const { data: reportsData, mutate: reloadReports, error: reportsError } = useSWR(viewedUserId ? `daily-reports-${viewedUserId}-${year}-${month}` : null, fetchReports, {
    revalidateOnFocus: false,
    dedupingInterval: 10000
  });

  useEffect(() => {
    if (reportsData) {
      setReports(reportsData);
      setLoading(false);
    } else if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      setLoading(false);
    }
  }, [reportsData, reportsError]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const elapsedDays = isCurrentMonth ? today.getDate() : (today.getTime() < new Date(year, month, 1).getTime() ? 0 : daysInMonth);

  const stats = useMemo(() => {
    let onTime = 0;
    let delayed = 0;
    let leave = 0;
    let holidays = 0;
    let weekOffs = 0;
    let pending = 0;
    
    for (let day = 1; day <= elapsedDays; day++) {
      const dateStr = new Date(year, month, day).toLocaleDateString('en-CA');
      const report = reports.find(r => r.report_date === dateStr);
      
      if (report) {
        if (report.project_code === 'Leave') leave++;
        else if (report.project_code === 'Holiday') holidays++;
        else if (report.project_code === 'Week-Off') weekOffs++;
        else {
           if (dayDiff(report.created_at, report.report_date) > 2) {
             delayed++;
           } else {
             onTime++;
           }
        }
      } else {
        // Missing report
        if (dayDiff(new Date(), dateStr) > 2) {
          delayed++;
        } else {
          pending++;
        }
      }
    }
    return { onTime, delayed, pending, leave, holidays, weekOffs };
  }, [reports, elapsedDays, year, month]);

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

    const now = new Date();
    if (
      !isReadOnly &&
      clickedDate.getFullYear() === now.getFullYear() &&
      clickedDate.getMonth() === now.getMonth() &&
      clickedDate.getDate() === now.getDate() &&
      now.getHours() < 17
    ) {
      alert("You cannot submit or fill the work report for the current day before 5:00 PM.");
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
        projectCode: '',
        timeIn: '09:00',
        timeOut: '17:00',
        workDetails: ''
      });
    }
    
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !selectedDate || isReadOnly) return;
    
    const isTimeExempt = ['Leave', 'Holiday', 'Week-Off', 'Idle'].includes(formData.projectCode);
    const isWorkDetailsExempt = ['Leave', 'Holiday', 'Week-Off'].includes(formData.projectCode);

    if (!formData.projectCode || 
        (!isTimeExempt && (!formData.timeIn || !formData.timeOut)) || 
        (!isWorkDetailsExempt && !formData.workDetails.trim())) {
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
        time_in: isTimeExempt ? '00:00' : formData.timeIn,
        time_out: isTimeExempt ? '00:00' : formData.timeOut,
        work_details: isWorkDetailsExempt ? 'N/A' : formData.workDetails,
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

  const handleExportReport = async () => {
    if (!csvStart || !csvEnd || !viewedUserId) return;
    setIsExporting(true);
    try {
      // 1. Determine Scope (Users)
      let targetUsers: {id: string, name: string, employee_id?: string}[] = [];
      if (csvExportScope === 'all') {
        if (user) targetUsers = [{ id: user.id, name: user.name, employee_id: user.employee_id || undefined }];
        teamMembers.forEach(tm => {
          if (!targetUsers.find(u => u.id === tm.id)) {
            targetUsers.push({ id: tm.id, name: tm.name, employee_id: tm.employee_id || undefined });
          }
        });
      } else {
        if (viewedUserId === user?.id && user) {
          targetUsers = [{ id: user.id, name: user.name, employee_id: user.employee_id || undefined }];
        } else {
          const member = teamMembers.find(m => m.id === viewedUserId);
          if (member) targetUsers = [{ id: member.id, name: member.name, employee_id: member.employee_id || undefined }];
        }
      }

      // 2. Generate Date Range
      const startDate = new Date(csvStart);
      const endDate = new Date(csvEnd);
      const dateList: string[] = [];
      let d = new Date(startDate);
      while (d <= endDate) {
        dateList.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }

      // 3. Fetch Submitted Data
      const userIds = targetUsers.map(u => u.id);
      const { data: dbData, error } = await supabase
        .from('daily_work_reports')
        .select('*')
        .gte('report_date', csvStart)
        .lte('report_date', csvEnd)
        .in('user_id', userIds);

      if (error) throw error;

      // 4. Construct Cartesian Matrix
      let exportRows: any[] = [];
      let submittedCount = 0;
      let notSubmittedCount = 0;

      targetUsers.forEach(u => {
        dateList.forEach(dateStr => {
          const submittedReport = dbData?.find((r: any) => r.user_id === u.id && r.report_date === dateStr);
          
          if (submittedReport) {
            submittedCount++;
            let status = 'Submitted';
            exportRows.push({
              "Employee ID": u.employee_id || '',
              "Employee Name": u.name,
              "Date": dateStr,
              "Project Code": submittedReport.project_code,
              "Time In": submittedReport.time_in ? submittedReport.time_in.substring(0, 5) : '',
              "Time Out": submittedReport.time_out ? submittedReport.time_out.substring(0, 5) : '',
              "Work Details": submittedReport.work_details || '',
              "Report Status": status
            });
          } else {
            notSubmittedCount++;
            exportRows.push({
              "Employee ID": u.employee_id || '',
              "Employee Name": u.name,
              "Date": dateStr,
              "Project Code": "",
              "Time In": "",
              "Time Out": "",
              "Work Details": "",
              "Report Status": "Not Submitted"
            });
          }
        });
      });

      // 5. Sort by Employee ID (Ascending), then Date (Ascending)
      exportRows.sort((a, b) => {
        const idA = String(a["Employee ID"] || '');
        const idB = String(b["Employee ID"] || '');
        
        // Push missing Employee IDs to the bottom
        if (idA && !idB) return -1;
        if (!idA && idB) return 1;

        // Alphanumeric sort
        const idCompare = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        if (idCompare !== 0) return idCompare;
        
        const dateA = new Date(a["Date"]).getTime();
        const dateB = new Date(b["Date"]).getTime();
        return dateA - dateB;
      });

      // Add summary statistics at the end
      exportRows.push({}); 
      exportRows.push({ "Employee ID": "Summary Statistics" });
      exportRows.push({ "Employee ID": "Total Submitted", "Employee Name": submittedCount.toString() });
      exportRows.push({ "Employee ID": "Total Not Submitted", "Employee Name": notSubmittedCount.toString() });
      exportRows.push({ "Employee ID": "Total Records", "Employee Name": (submittedCount + notSubmittedCount).toString() });

      const fileName = csvExportScope === 'all' 
        ? `Work_Report_All_Team_${csvStart}_to_${csvEnd}`
        : `Work_Report_${viewedUserName}_${csvStart}_to_${csvEnd}`;

      if (exportFormat === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Reports");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        
        const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setIsCsvModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to export Report");
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

    let isDelayed = false;
    if (hasReport && existingReport) {
      if (!['Leave', 'Holiday', 'Week-Off'].includes(existingReport.project_code)) {
        isDelayed = dayDiff(existingReport.created_at, existingReport.report_date) > 2;
      }
    } else if (!isFuture) {
      isDelayed = dayDiff(new Date(), dateStr) > 2;
    }

    let cardStyle = '';
    let statusIcon = null;
    
    if (hasReport && existingReport) {
      if (existingReport.project_code === 'Leave') {
        cardStyle = 'border-l-4 border-l-blue-500 bg-blue-500/5 border-white/5';
      } else if (existingReport.project_code === 'Holiday') {
        cardStyle = 'border-l-4 border-l-purple-500 bg-purple-500/5 border-white/5';
      } else if (existingReport.project_code === 'Week-Off') {
        cardStyle = 'border-l-4 border-l-gray-600 bg-gray-500/5 border-white/5 opacity-60';
      } else if (existingReport.project_code === 'Idle') {
        cardStyle = 'border-l-4 border-l-yellow-500 bg-yellow-500/5 border-white/5';
      } else {
        if (isDelayed) {
          cardStyle = 'border-l-4 border-l-red-500 bg-red-500/5 border-white/5';
          statusIcon = <span title="Delayed"><CheckCircle className="w-3.5 h-3.5 text-red-500" /></span>;
        } else {
          cardStyle = 'border-l-4 border-l-emerald-500 bg-emerald-500/5 border-white/5';
          statusIcon = <span title="On Time"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /></span>;
        }
      }
    } else if (!isFuture && !isToday) {
      // Missing report
      if (isDelayed) {
        cardStyle = 'border-l-4 border-l-red-500 bg-red-500/5 border-white/5';
      } else {
        cardStyle = 'border-l-4 border-l-orange-500 bg-orange-500/5 border-white/5';
      }
    } else {
      cardStyle = isToday ? 'bg-blue-900/10 border border-blue-500/30' : 'bg-[#0f172a] border border-white/5';
    }

    calendarCells.push(
      <div 
        key={`day-${day}`} 
        onClick={() => canInteract && handleDayClick(day)}
        className={`rounded flex flex-col md:rounded-lg p-0.5 sm:p-1 md:p-2.5 transition-all duration-200 relative group overflow-hidden h-full min-h-[50px] md:min-h-[80px]
          ${!canInteract ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}
          ${cardStyle}
        `}
      >
        <div className="flex flex-col md:flex-row justify-center md:justify-between items-center md:items-start mb-0.5 md:mb-1 w-full">
          <span className={`text-[10px] sm:text-[11px] md:text-[13px] font-bold ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
            {String(day).padStart(2, '0')}
          </span>
          <div className="hidden md:block">{statusIcon}</div>
        </div>
        
        {hasReport && existingReport ? (
          <div className="flex flex-col gap-0 md:gap-1 mt-auto items-center md:items-start text-center md:text-left w-full h-full justify-end md:justify-start pb-0.5 md:pb-0">
            <div className="text-[8px] md:text-[11px] font-bold text-gray-100 truncate w-full px-0.5" title={existingReport.project_code}>{existingReport.project_code}</div>
            {!['Leave', 'Holiday', 'Week-Off', 'Idle'].includes(existingReport.project_code) && (
              <div className="text-[7px] md:text-[10px] font-medium text-gray-400 truncate w-full leading-tight hidden sm:block px-0.5">
                <span className="md:hidden block">{existingReport.time_in.substring(0, 5)}</span>
                <span className="hidden md:inline">{existingReport.time_in.substring(0, 5)} - {existingReport.time_out.substring(0, 5)}</span>
              </div>
            )}
          </div>
        ) : !isFuture && !isReadOnly ? (
          <div className="text-[10px] text-gray-500 font-medium mt-auto opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1">
            +
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-2 sm:px-4 mx-auto flex flex-col min-h-[calc(100vh-80px)] h-auto md:h-[calc(100vh-80px)] gap-2 md:gap-4 pb-4 overflow-x-hidden">
      {/* Enterprise Compact Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 bg-transparent p-1 md:p-2 border-b border-white/5 w-full">
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto flex-1">
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-1.5 md:gap-2 tracking-tight whitespace-nowrap">
            <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <span className="hidden sm:inline">Daily Work Report</span>
            <span className="sm:hidden">Work Report</span>
          </h1>
          {['team_leader', 'manager'].includes(user?.role || '') && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 md:pl-4 ml-1 md:ml-2">
              <Users className="w-3.5 h-3.5 text-gray-400" />
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
                className="bg-transparent text-xs md:text-sm text-gray-300 font-medium focus:outline-none cursor-pointer max-w-[100px] sm:max-w-[150px] truncate"
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
          <div className="flex items-center gap-2" title="On Time"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div><span className="text-gray-300">{stats.onTime}</span></div>
          <div className="flex items-center gap-2" title="Delayed"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div><span className="text-gray-300">{stats.delayed}</span></div>
          <div className="flex items-center gap-2" title="Pending"><div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div><span className="text-gray-300">{stats.pending}</span></div>
          <div className="flex items-center gap-2" title="Leave/Holiday"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div><span className="text-gray-300">{stats.leave + stats.holidays + stats.weekOffs}</span></div>
        </div>
        
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-auto md:flex-1">
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={prevMonth} className="p-2 md:p-1 hover:bg-white/5 rounded-full md:rounded text-gray-400 hover:text-white transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4 md:w-4 md:h-4" />
            </button>
            <span className="w-24 md:w-28 text-center font-semibold text-white text-xs md:text-sm whitespace-nowrap">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 md:p-1 hover:bg-white/5 rounded-full md:rounded text-gray-400 hover:text-white transition-colors flex-shrink-0">
              <ChevronRight className="w-4 h-4 md:w-4 md:h-4" />
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
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel rounded-lg md:rounded-2xl p-1 md:p-4 flex flex-col flex-1 min-h-[400px] md:min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 mb-1 md:mb-2 flex-shrink-0 w-full">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.substring(0, 1)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[minmax(min-content,1fr)] gap-0.5 sm:gap-1 md:gap-2 flex-1 min-h-0 w-full">
              {calendarCells}
            </div>
          </>
        )}
      </div>

      {/* Daily Report Modal Form */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-transparent">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  {isReadOnly ? 'View Work Report' : formData.id ? 'Edit Work Report' : 'Submit Work Report'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  For {selectedDate.toLocaleDateString('en-GB').replace(/\//g, ':')}
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
                      <option value="Idle">Idle</option>
                    </optgroup>
                    <optgroup label="Active Projects">
                      {assignedProjects.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {!['Leave', 'Holiday', 'Week-Off', 'Idle'].includes(formData.projectCode) && (
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

      {/* Export Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                Export Report
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              {['manager', 'team_leader'].includes(user?.role || '') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Export Scope</label>
                  <select
                    value={csvExportScope}
                    onChange={(e) => setCsvExportScope(e.target.value as 'selected' | 'all')}
                    className="w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 [color-scheme:dark] appearance-none"
                  >
                    <option value="all">All Team Members</option>
                    <option value="selected">Currently Selected Member ({viewedUserName})</option>
                  </select>
                </div>
              )}
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')}
                  className="w-full bg-[#0a0f1a] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 [color-scheme:dark] appearance-none"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
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
                onClick={handleExportReport}
                disabled={isExporting || !csvStart || !csvEnd}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Report
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
