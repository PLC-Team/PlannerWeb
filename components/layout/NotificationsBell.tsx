'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Notification } from '@/types';
import { Bell, Check, Clock, Trash2, MailOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationsBell() {
  const { user } = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time notifications inserts for this user
    if (!user) return;
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    await handleMarkAsRead(notif.id);
    setIsOpen(false);
    
    // Redirect if it points to a specific project
    if (notif.related_project_id) {
      router.push(`/projects/${notif.related_project_id}`);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn-icon rounded-full flex items-center justify-center relative w-10 h-10 border border-white/5 bg-white/5 text-gray-400 hover:text-white transition ${
          unreadCount > 0 ? 'text-amber-400 hover:text-amber-300' : ''
        }`}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[9px] rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#07090e]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 glass rounded-xl overflow-hidden shadow-2xl z-50 border border-white/5 animated-fade flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="px-4 py-3 bg-white/5 border-bottom border-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-white font-heading">Notifications</h3>
              <span className="text-[10px] text-gray-400">{unreadCount} unread messages</span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto scroll-container flex-1">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center gap-2 text-center">
                <MailOpen className="w-8 h-8 text-gray-400" />
                <p className="text-xs text-gray-400">All caught up! No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 cursor-pointer hover:bg-white/5 transition flex items-start gap-3 text-left ${
                      !notif.is_read ? 'bg-blue-600/5' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold text-xs truncate ${!notif.is_read ? 'text-white' : 'text-gray-300'}`}>
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-gray-500 flex items-center gap-1 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDateLabel(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
