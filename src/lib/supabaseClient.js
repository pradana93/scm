import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// These values should be set in your environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '');
};

// Helper function to get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Helper function to sign out
export const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Helper function to sign in with email/password
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Helper function to sign up with email/password
export const signUpWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Helper function to reset password
export const resetPassword = async (email) => {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

export default supabase;
