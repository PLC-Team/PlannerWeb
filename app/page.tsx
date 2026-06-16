'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useUser from '@/lib/hooks/useUser';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, session, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (session && user) {
        const target = `/dashboard/home`;
        window.location.href = target;
      } else {
        window.location.href = '/login';
      }
    }
  }, [loading, session, user]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e] gap-4">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      <p className="text-gray-400 font-medium">Redirecting you to the system...</p>
    </div>
  );
}
