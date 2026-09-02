import { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import SetupWizard from '@/components/setup/SetupWizard';

const SetupContext = createContext(null);

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
}

export function SetupProvider({ children }) {
  const [isSetupComplete, setIsSetupComplete] = useState(null); // null = loading
  const [supabaseClient, setSupabaseClient] = useState(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    // Check if credentials are stored in localStorage
    const supabaseUrl = localStorage.getItem('supabase_url');
    const supabaseKey = localStorage.getItem('supabase_key');

    if (!supabaseUrl || !supabaseKey) {
      setIsSetupComplete(false);
      return;
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    setSupabaseClient(supabase);

    // Check if setup is marked as complete in database
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'setup_completed')
        .single();

      if (error || data?.value !== 'true') {
        setIsSetupComplete(false);
      } else {
        setIsSetupComplete(true);
      }
    } catch (err) {
      console.error('Error checking setup status:', err);
      setIsSetupComplete(false);
    }
  };

  const handleSetupComplete = async (setupData) => {
    const supabase = createClient(setupData.supabaseUrl, setupData.supabaseKey);
    setSupabaseClient(supabase);
    setIsSetupComplete(true);
  };

  if (isSetupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <SetupContext.Provider value={{ supabaseClient }}>
      {children}
    </SetupContext.Provider>
  );
}
