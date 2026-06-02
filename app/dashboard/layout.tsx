'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import useUser from '@/lib/hooks/useUser';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, fetchError } = useUser() as any;

  if (loading || fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e] gap-4">
        {fetchError ? (
          <div className="text-red-500 font-mono text-sm max-w-xl text-center">
            <h3 className="font-bold mb-2">Failed to load profile</h3>
            <p>{fetchError}</p>
          </div>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-gray-400 font-medium">Loading your profile...</p>
          </>
        )}
      </div>
    );
  }

  if (!user) return null; // Let AuthContext handle redirect

  return (
    <div className="app-layout min-h-screen bg-[#07090e] flex text-gray-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="main-content flex-1 ml-[280px] min-h-screen flex flex-col relative">
        {/* Topbar Actions */}
        <Topbar />

        {/* Dynamic Panel Viewport */}
        <main className="flex-1 mt-20 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
