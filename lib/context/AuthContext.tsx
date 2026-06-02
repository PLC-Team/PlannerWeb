'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../supabase/client';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  fetchError: null,
  signOut: async () => {},
  refreshUserProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (uid: string, email: string, metadata?: any): Promise<User | null> => {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timed out")), 5000)
    );
    
    const queryPromise = supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single()
      .then((res: any) => {
        const { data, error } = res;
        if (error) {
          console.error('Error fetching user profile from public.users:', error);
          return null; // Return null to trigger fallback
        }
        return data as User;
      });

    try {
      const profile = await Promise.race([queryPromise, timeoutPromise]);
      if (profile) return profile as User;
      throw new Error("Profile not found in public.users");
    } catch (err: any) {
      console.warn('Profile fetch failed, using fallback metadata:', err.message);
      
      // If we have metadata (from session), use it as fallback to let the user log in!
      if (metadata) {
        return {
          id: uid,
          email: email,
          name: metadata.name || email.split('@')[0],
          role: metadata.role || 'team_member',
          designation: metadata.designation || '',
        } as User;
      }
      
      setFetchError(err.message || 'Unknown error');
      return null;
    }
  };

  const refreshUserProfile = async () => {
    if (!supabase) return;
    if (session?.user) {
      const profile = await fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
      if (profile) {
        setUser(profile);
      }
    }
  };

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      if (!supabase) {
        console.warn("Supabase client is not initialized during auth init.");
        if (active) setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
          if (active) setUser(profile);
        } else {
          if (active) setUser(null);
        }
      } catch (err) {
        console.error('Error in auth initialization:', err);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listen for auth changes
    let subscription: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event: any, newSession: any) => {
        if (!active) return;
        setSession(newSession);
        if (newSession?.user) {
          setLoading(true);
          try {
            const profile = await fetchProfile(newSession.user.id, newSession.user.email || '', newSession.user.user_metadata);
            if (active) setUser(profile);
          } catch (err) {
            console.error('Error fetching profile on auth change:', err);
            // Do not log the user out just because background refresh failed!
          } finally {
            if (active) setLoading(false);
          }
        } else {
          if (active) {
            setUser(null);
            setLoading(false);
          }
        }
      });
      subscription = data.subscription;
    }

    // 3. Auto-logout after 30 minutes of inactivity
    let inactivityTimer: NodeJS.Timeout | null = null;
    
    const performLogout = () => {
      if (supabase) {
        supabase.auth.signOut().then(() => {
          if (active) {
            setUser(null);
            setSession(null);
            window.location.href = '/login';
          }
        });
      }
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      // 30 minutes = 1800000 ms
      inactivityTimer = setTimeout(performLogout, 1800000);
    };

    // Initialize timer
    resetInactivityTimer();

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    activityEvents.forEach(evt => document.addEventListener(evt, handleActivity));

    return () => {
      active = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      activityEvents.forEach(evt => document.removeEventListener(evt, handleActivity));
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, []);

  // 3. Handle redirects based on auth and role
  useEffect(() => {
    if (loading) return;

    const isAuthRoute = pathname === '/login';
    const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/projects');

    if (fetchError) {
      return; // Stop redirect loop if we failed to fetch
    }

    if ((!session || !user) && isProtectedRoute) {
      // Redirect to login if accessing protected page and not logged in or profile missing
      router.replace('/login');
      setTimeout(() => { if (window.location.pathname !== '/login') window.location.href = '/login'; }, 500);
    } else if (session && user && isAuthRoute) {
      // Redirect to correct dashboard if logged in and accessing login page
      const dashboardPath = `/dashboard/${user.role?.replace('_', '-') || 'team-member'}`;
      router.replace(dashboardPath);
      setTimeout(() => { if (window.location.pathname === '/login') window.location.href = dashboardPath; }, 500);
    } else if (session && user && pathname === '/dashboard') {
      // Redirect from generic /dashboard to role dashboard
      const dashboardPath = `/dashboard/${user.role?.replace('_', '-') || 'team-member'}`;
      router.replace(dashboardPath);
      setTimeout(() => { if (window.location.pathname === '/dashboard') window.location.href = dashboardPath; }, 500);
    }
  }, [session, user, pathname, loading, router]);

  const signOut = async () => {
    if (!supabase) {
      setUser(null);
      setSession(null);
      router.replace('/login');
      return;
    }
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, fetchError, signOut, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useUser = () => useContext(AuthContext);
