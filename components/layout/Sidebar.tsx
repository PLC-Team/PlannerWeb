'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useUser from '@/lib/hooks/useUser';
import { 
  Users, 
  GitMerge, 
  Database, 
  Folder, 
  LogOut, 
  Sparkles, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Key,
  Home
} from 'lucide-react';

interface SidebarProps {
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

export default function Sidebar({ isMobileMenuOpen = false, setIsMobileMenuOpen }: SidebarProps) {
  const { user, signOut } = useUser();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync state with body class and local storage
  useEffect(() => {
    const savedCollapseState = localStorage.getItem('sidebar-collapsed') === 'true';
    setIsCollapsed(savedCollapseState);
    if (savedCollapseState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    if (setIsMobileMenuOpen) setIsMobileMenuOpen(false);
  }, [pathname, setIsMobileMenuOpen]);

  if (!user) return null;

  const role = user.role;

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
    if (nextState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  const getMenuLinks = () => {
    switch (role) {
      case 'admin':
        return [
          { name: 'User Management', href: '/dashboard/admin?tab=users', icon: Users },
          { name: 'Hierarchy Management', href: '/dashboard/admin?tab=hierarchy', icon: GitMerge },
          { name: 'System Activity Log', href: '/dashboard/admin?tab=logs', icon: Database },
        ];

      case 'manager':
      case 'team_leader':
      case 'team_member':
        return [
          { name: 'Home', href: '/dashboard/home', icon: Home },
          { name: 'Projects', href: `/dashboard/${role.replace('_', '-')}`, icon: Folder },
          ...(role === 'team_leader' ? [{ name: 'My Team', href: '/dashboard/my-team', icon: Users }] : []),
          { name: 'Reporting Hierarchy', href: '/dashboard/hierarchy', icon: GitMerge },
          { name: 'Daily Work Report', href: '/dashboard/daily-report', icon: Sparkles },
        ];
      default:
        return [];
    }
  };

  const links = getMenuLinks();

  const getRoleColorClass = (roleStr: string) => {
    switch (roleStr) {
      case 'admin': return 'bg-red-500/10 text-red-400 border border-red-500/20';

      case 'manager': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'team_leader': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'team_member': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const formatRole = (roleStr: string) => {
    return roleStr.replace('_', ' ').toUpperCase();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]"
          onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`sidebar bg-gradient-to-b from-[#060B16] to-[#0F172A] flex flex-col justify-between h-screen fixed left-0 top-0 z-50 p-6 border-r border-white/5 transition-transform duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[280px]'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div>
          {/* Brand Logo & Collapse Toggle */}
          <div className={`flex items-center gap-3 mb-8 ${isCollapsed ? 'flex-col justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 glow-logo flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="font-extrabold text-lg tracking-tight text-white font-heading leading-tight">
                    WorkSync
                </h1>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Project Management
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="text-gray-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition flex-shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User profile details */}
        {!isCollapsed && (
          <div className="glass-inner p-3 rounded-xl flex items-center gap-2 mb-4 relative overflow-hidden">
            {/* Online indicator dot */}
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" title="System Online" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center font-bold text-white uppercase text-xs">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white truncate leading-tight">
                {user.name}
              </h4>
              <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md mt-1.5 ${getRoleColorClass(user.role)}`}>
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        )}

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-1.5">
          {!isCollapsed && (
            <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-2 px-3">
              Navigation Menu
            </span>
          )}
          <ul>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href.split('?')[0]);
              return (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className={`nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition group ${
                      isActive
                        ? 'font-semibold text-blue-400 bg-white/5'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? link.name : ''}
                  >
                    <Icon className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                    {!isCollapsed && <span>{link.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Sidebar Footer / Logout */}
      <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
        <Link
          href="/update-password"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-blue-500/10 hover:text-blue-400 transition w-full text-left ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Change Password' : ''}
        >
          <Key className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Change Password</span>}
        </Link>
        <button
          onClick={signOut}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition w-full text-left ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Sign Out' : ''}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
