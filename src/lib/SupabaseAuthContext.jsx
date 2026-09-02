import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, getCurrentUser, signOut, signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for existing session on mount
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

  const checkSession = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
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
    try {
      setAuthError(null);
      const data = await signInWithEmail(email, password);
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
    try {
      setAuthError(null);
      const data = await signUpWithEmail(email, password);
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
    try {
      setAuthError(null);
      await resetPassword(email);
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
    try {
      await signOut();
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
