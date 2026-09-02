import React, { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with dynamic credentials
const getSupabaseClient = () => {
  const supabaseUrl = localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = localStorage.getItem('supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    // Initialize Supabase client
    const client = getSupabaseClient();
    if (!client) {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    
    setSupabase(client);
    
    // Check for existing session on mount
    checkSession(client);

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session.user);
        setIsAuthenticated(true);
        setAuthError(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(session.user);
        setIsAuthenticated(true);
      } else if (event === 'USER_UPDATED') {
        setUser(session.user);
      }
      
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async (client = supabase) => {
    if (!client) return;
    
    try {
      setIsLoadingAuth(true);
      const { data: { user: currentUser }, error } = await client.auth.getUser();
      
      if (currentUser && !error) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('Session check failed:', error);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsAuthenticated(false);
    }
  };

  const login = async (email, password) => {
    if (!supabase) {
      return { success: false, error: new Error('Supabase not configured') };
    }
    
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      setAuthError({
        type: 'login_failed',
        message: error.message || 'Failed to login'
      });
      return { success: false, error };
    }
  };

  const register = async (email, password) => {
    if (!supabase) {
      return { success: false, error: new Error('Supabase not configured') };
    }
    
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      setAuthError({
        type: 'registration_failed',
        message: error.message || 'Failed to register'
      });
      return { success: false, error };
    }
  };

  const forgotPassword = async (email) => {
    if (!supabase) {
      return { success: false, error: new Error('Supabase not configured') };
    }
    
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Password reset failed:', error);
      setAuthError({
        type: 'password_reset_failed',
        message: error.message || 'Failed to reset password'
      });
      return { success: false, error };
    }
  };

  const logout = async (shouldRedirect = true) => {
    if (!supabase) return;
    
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      authChecked,
      login,
      register,
      forgotPassword,
      logout,
      navigateToLogin,
      checkSession
    }}>
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
