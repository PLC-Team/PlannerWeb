'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, session, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (session && user) {
        router.replace(`/dashboard/home`);
      } else {
        router.replace('/login');
      }
    }
    
    // Auto-fallback: if we're stuck here for more than 4 seconds, force to login
    const failsafe = setTimeout(() => {
      router.replace('/login');
    }, 4000);

    return () => clearTimeout(failsafe);
  }, [loading, session, user, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e] gap-4">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      <p className="text-gray-400 font-medium mb-4">Redirecting you to the system...</p>
      
      <a 
        href="/login"
        onClick={() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch(e) {}
        }}
        className="text-xs text-red-400/70 hover:text-red-400 mt-8 underline border border-red-500/20 px-3 py-1.5 rounded"
      >
        Stuck? Click here to force reset
      </a>
    </div>
  );
}
