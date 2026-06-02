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
        const target = `/dashboard/${user.role?.replace('_', '-') || 'team-member'}`;
        router.replace(target);
        setTimeout(() => { if (window.location.pathname === '/') window.location.href = target; }, 500);
      } else {
        router.replace('/login');
        setTimeout(() => { if (window.location.pathname === '/') window.location.href = '/login'; }, 500);
      }
    }
  }, [loading, session, user, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e] gap-4">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      <p className="text-gray-400 font-medium">Redirecting you to the system...</p>
    </div>
  );
}
