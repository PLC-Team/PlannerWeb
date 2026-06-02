'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useUser from '@/lib/hooks/useUser';
import NotificationsBell from './NotificationsBell';
import { Search, ChevronDown, User, Layers, ShieldAlert, Cpu } from 'lucide-react';

interface TopbarProps {
  onSearch?: (term: string) => void;
}

export default function Topbar({ onSearch }: TopbarProps) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Setup Ctrl+K shortcut focus listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.getElementById('global-search-input');
        if (input) {
          input.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener for quick actions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!val.trim()) {
      router.push(`/dashboard/${user.role?.replace('_', '-')}`);
    }
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/dashboard/${user.role.replace('_', '-')}?search=${encodeURIComponent(searchTerm)}`);
    } else {
      router.push(`/dashboard/${user.role.replace('_', '-')}`);
    }
  };

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    return `SYS_LOC // ` + segments.map(s => s.toUpperCase().replace('-', '_')).join(' // ');
  };

  return (
    <header className="navbar glass h-20 w-[calc(100%-var(--sidebar-width))] fixed right-0 top-0 z-40 px-8 flex items-center justify-between border-b border-[var(--border-glass)] bg-[#090f1d]/75 backdrop-blur-md shadow-sm transition-all duration-300">
      
      {/* Topbar Left - Breadcrumbs & Search Bar */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <div className="hidden lg:flex flex-col text-left">
          <span className="font-mono text-[9px] font-extrabold text-[#06B6D4] tracking-widest leading-none">
            {getBreadcrumbs()}
          </span>
        </div>

        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search projects, tasks..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-[#111827] border border-blue-500/15 rounded-xl pl-11 pr-16 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition duration-300"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-1.5 py-0.5 rounded bg-slate-800/80 text-[8px] font-mono font-extrabold text-[#64748B] border border-white/5 uppercase select-none pointer-events-none">
            Ctrl+K
          </span>
        </form>
      </div>

      {/* Topbar Right - Actions, Notifications, Profile Info */}
      <div className="flex items-center gap-6">
        
        {/* Quick Actions Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="px-3 py-1.5 rounded-lg border border-blue-500/15 bg-white/2 hover:bg-white/5 hover:border-blue-500/30 transition text-xs font-semibold text-[#CBD5E1] flex items-center gap-1.5 active:scale-95"
          >
            <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" /> Quick Menu <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          
          {showQuickActions && (
            <div className="absolute right-0 top-9 w-48 glass rounded-xl border border-blue-500/20 shadow-2xl p-2 z-50 animated-fade flex flex-col gap-1 bg-[#090f1d]/95">
              <button
                onClick={() => { setShowQuickActions(false); router.push(`/dashboard/${user.role.replace('_', '-')}`); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-white/5 hover:text-[#06B6D4] flex items-center gap-2 transition"
              >
                <Layers className="w-3.5 h-3.5" /> Dashboard Home
              </button>
              <button
                onClick={() => { setShowQuickActions(false); router.push('/dashboard/hierarchy'); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-white/5 hover:text-[#06B6D4] flex items-center gap-2 transition"
              >
                <User className="w-3.5 h-3.5" /> Organization Tree
              </button>
              <button
                onClick={() => { setShowQuickActions(false); router.push('/diagnostics'); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-white/5 hover:text-[#06B6D4] flex items-center gap-2 transition"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> System Diagnostics
              </button>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <NotificationsBell />

        {/* User Quick Info */}
        <div className="flex items-center gap-3 pl-4 border-l border-blue-500/10">
          <div className="text-right">
            <span className="block text-xs font-bold text-[#F8FAFC] leading-tight">
              {user.name}
            </span>
            {user.designation && (
              <span className="text-[9px] text-[#64748B] font-extrabold uppercase block mt-0.5 tracking-wider truncate max-w-[120px]">
                {user.designation}
              </span>
            )}
          </div>
          <div className="relative">
            {/* Pulsing online status indicator overlay */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#090f1d] animate-pulse" title="Connected" />
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#06B6D4] flex items-center justify-center font-extrabold text-[#F8FAFC] text-xs shadow-md shadow-blue-500/15">
              {user.role.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
