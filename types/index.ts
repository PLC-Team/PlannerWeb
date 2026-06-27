export type UserRole = 'admin' | 'manager' | 'team_leader' | 'team_member';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed_by_member'
  | 'approved_by_tl'
  | 'approved_by_manager'
  | 'rejected'
  | 'rework_required'
  | 'closed';
export type AchievementStatus = 'pending' | 'approved' | 'rejected';
export type IssueCategory = 'delay' | 'technical' | 'resource' | 'quality' | 'safety' | 'customer' | 'other';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface User {
  id: string;
  employee_id?: string | null;
  name: string;
  email: string;
  role: UserRole;
  designation: string | null;
  created_at: string;
}

export interface Hierarchy {
  id: string;
  manager_id: string;
  team_leader_id: string;
  team_member_id: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string;
  description: string | null;
  assigned_team_leader_id: string | null;
  created_by: string | null;
  status: ProjectStatus;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  team_member_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  assigned_by: string | null;
  assigned_to: string | null;
  assigned_by_role: 'manager' | 'team_leader' | null;
  priority: TaskPriority;
  start_date: string | null;
  target_date: string | null;
  status: TaskStatus;
  progress_percent: number;
  remarks: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}


export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  comment: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  project_id: string;
  project_code: string | null;
  title: string;
  details: string;
  submitted_by: string | null;
  submitted_at: string;
  attachment_url: string | null;
  approval_status: AchievementStatus;
  manager_remarks: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface Issue {
  id: string;
  project_id: string;
  project_code: string | null;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  raised_by: string | null;
  raised_at: string;
  attachment_url: string | null;
  status: IssueStatus;
  resolution_remarks: string | null;
  resolved_at: string | null;
  // New logging/lesson-learned fields
  reported_by_name: string | null;
  plant: string | null;
  line: string | null;
  station: string | null;
  occurrence_date: string | null;
  responsible_person_id: string | null;
  occurrence_condition: string | null;
  temporary_action: string | null;
  permanent_countermeasure: string | null;
}

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

export type TrainingRequestStatus = 
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'trainer_assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';
export type TrainingRequestPriority = 'low' | 'medium' | 'high';

export interface TrainingRequest {
  id: string;
  topic: string;
  description: string;
  priority: TrainingRequestPriority | null;
  remarks: string | null;
  requested_by: string;
  manager_id: string | null;
  status: TrainingRequestStatus;
  scheduled_date: string | null;
  trainer_name: string | null;
  trainer_id: string | null;
  training_duration: string | null;
  training_mode: 'online' | 'offline' | null;
  manager_remarks: string | null;
  request_type: 'request' | 'planned';
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string | null;
  task_id: string | null;
  user_id: string | null;
  action: string;
  details: any; // JSONB
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  related_task_id: string | null;
  related_project_id: string | null;
  created_at: string;
}

export interface PunchPoint {
  id: string;
  project_id: string;
  sr_no: number;
  line: string;
  station_no: string;
  concern: string;
  issue_raised_date: string | null;
  target_date: string | null;
  status: 'Open' | 'WIP' | 'Closed' | 'NA';
  closed_by: string | null;
  remark: string;
  created_at: string;
}
