import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const AuthContext = createContext();

/** Load the app profile row (role, display_name, ...) for a Supabase auth user. */
async function loadProfile(authUser) {
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('app_users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (profile) {
    return {
      ...profile,
      email: profile.email || authUser.email,
      full_name: profile.full_name || profile.display_name || authUser.email,
      auth_user_id: authUser.id,
    };
  }

  // Fall back to matching by email (covers pre-provisioned / invited accounts).
  if (authUser.email) {
    const { data: byEmail } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', authUser.email.toLowerCase())
      .maybeSingle();

    if (byEmail) {
      if (!byEmail.auth_user_id) {
        await supabase
          .from('app_users')
          .update({ auth_user_id: authUser.id })
          .eq('id', byEmail.id);
      }
      return {
        ...byEmail,
        email: byEmail.email || authUser.email,
        full_name: byEmail.full_name || byEmail.display_name || authUser.email,
        auth_user_id: authUser.id,
      };
    }
  }

  return {
    id: authUser.id,
    auth_user_id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.email,
    display_name: authUser.user_metadata?.full_name || '',
    role: 'public',
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const mounted = useRef(true);

  const applySession = useCallback(async (session) => {
    const authUser = session?.user || null;

    if (!authUser) {
      if (!mounted.current) return;
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      const profile = await loadProfile(authUser);
      if (!mounted.current) return;
      setUser(profile);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('Failed to load profile:', error);
      if (!mounted.current) return;
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      if (mounted.current) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    const { data } = await supabase.auth.getSession();
    await applySession(data?.session || null);
  }, [applySession]);

  useEffect(() => {
    mounted.current = true;

    if (!isSupabaseConfigured()) {
      setAuthError({ type: 'unknown', message: 'Supabase is not configured' });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return () => {
        mounted.current = false;
      };
    }

    checkUserAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted.current = false;
      subscription?.unsubscribe();
    };
  }, [applySession, checkUserAuth]);

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await applySession(data.session);
      return { success: true };
    } catch (error) {
      setAuthError({ type: 'login_failed', message: error.message || 'Failed to login' });
      return { success: false, error };
    }
  };

  const register = async (email, password, fullName = '') => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      if (data.session) await applySession(data.session);
      return { success: true, needsConfirmation: !data.session };
    } catch (error) {
      setAuthError({ type: 'registration_failed', message: error.message || 'Failed to register' });
      return { success: false, error };
    }
  };

  const forgotPassword = async (email) => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      setAuthError({ type: 'password_reset_failed', message: error.message || 'Failed to reset password' });
      return { success: false, error };
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        authChecked,
        publicMode: false,
        login,
        register,
        forgotPassword,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkSession: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
