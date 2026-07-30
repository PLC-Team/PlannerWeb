'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useUser from '@/lib/hooks/useUser';
import NotificationsBell from './NotificationsBell';
import { Search, ChevronDown, User, Layers, ShieldAlert, Cpu, Menu } from 'lucide-react';

const formatDisplayName = (name: string | null) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

interface TopbarProps {
  onSearch?: (term: string) => void;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

export default function Topbar({ onSearch, isMobileMenuOpen, setIsMobileMenuOpen }: TopbarProps) {
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

  // On mobile, the Topbar spans full width. On desktop, it's pushed right by the sidebar.
  // We use w-full left-0 lg:w-[calc(100%-280px)] lg:left-[280px] assuming default uncollapsed sidebar for desktop.
  // Since we don't have isCollapsed state here, we'll just use lg:left-[280px] w-full lg:w-auto.
  return (
    <header className="navbar h-20 fixed right-0 top-0 z-40 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-[#0F172A]/60 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all duration-300">
      
      {/* Topbar Left - Hamburger, Breadcrumbs & Search Bar */}
      <div className="flex items-center gap-3 md:gap-6 flex-1 max-w-xl">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition"
        >
          <Menu className="w-5 h-5" />
        </button>


        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xs md:max-w-sm hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-[#111827] border border-blue-500/15 rounded-xl pl-11 pr-4 md:pr-16 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition duration-300"
          />
          <span className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded bg-slate-800/80 text-[8px] font-mono font-extrabold text-[#64748B] border border-white/5 uppercase select-none pointer-events-none">
            Ctrl+K
          </span>
        </form>
      </div>

      {/* Topbar Right - Actions, Notifications, Profile Info */}
      <div className="flex items-center gap-3 md:gap-6">
        

        {/* Notifications Bell */}
        <NotificationsBell />
      </div>
    </header>
  );
}
