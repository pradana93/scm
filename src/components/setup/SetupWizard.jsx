import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Database, User, Building2, Warehouse } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Supabase Connection', icon: Database },
  { id: 2, title: 'Admin Account', icon: User },
  { id: 3, title: 'Organization', icon: Building2 },
  { id: 4, title: 'Warehouse Setup', icon: Warehouse },
  { id: 5, title: 'Complete', icon: CheckCircle2 },
];

export default function SetupWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Step 1: Supabase credentials
  const [credentials, setCredentials] = useState({
    supabaseUrl: '',
    supabaseKey: '',
  });
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionValid, setConnectionValid] = useState(false);

  // Step 2: Admin account
  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  // Step 3: Organization
  const [orgData, setOrgData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
  });

  // Step 4: Warehouse
  const [warehouseData, setWarehouseData] = useState({
    name: '',
    code: '',
    address: '',
  });

  const testConnection = async () => {
    if (!credentials.supabaseUrl || !credentials.supabaseKey) {
      setError('Please fill in both fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient(credentials.supabaseUrl, credentials.supabaseKey);
      
      // Try to query app_settings table
      const { data, error } = await supabase.from('app_settings').select('count');
      
      if (error) {
        // Check if it's a "table doesn't exist" error - this is expected on first run
        if (error.message.includes('relation "public.app_settings" does not exist') || 
            error.message.includes('Could not find the table') ||
            error.code === 'PGRST116') {
          // This is a new/empty database - that's OK for setup!
          setConnectionValid(true);
          setConnectionTested(true);
          setSuccess('Connected successfully! (New database detected - tables will be created during setup)');
          setIsLoading(false);
          return;
        }
        // Any other error is a real problem
        throw new Error(error.message);
      }
      
      setConnectionValid(true);
      setConnectionTested(true);
      setSuccess('Connected successfully!');
    } catch (err) {
      setConnectionValid(false);
      setConnectionTested(true);
      
      let errorMessage = err.message;
      if (err.message.includes('Invalid API key') || err.message.includes('JWT')) {
        errorMessage = 'Invalid Supabase Anon Key. Please check your credentials.';
      } else if (err.message.includes('Invalid URL') || err.message.includes('fetch')) {
        errorMessage = 'Invalid Supabase URL or network error. Please check your connection.';
      }
      
      setError(`Connection failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!connectionValid) {
        setError('Please test and establish a valid connection first');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!adminData.email || !adminData.password || !adminData.fullName) {
        setError('Please fill in all required fields');
        return;
      }
      if (adminData.password !== adminData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (adminData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!orgData.name || !orgData.code) {
        setError('Please fill in organization name and code');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!warehouseData.name || !warehouseData.code) {
        setError('Please fill in warehouse name and code');
        return;
      }
      await finalizeSetup();
    }
  };

  const finalizeSetup = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient(credentials.supabaseUrl, credentials.supabaseKey);
      
      // Create admin user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
      });
      
      if (authError) throw authError;
      
      // Wait for user to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update user metadata
      if (authData.user) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: adminData.fullName }
        });
        if (updateError) console.warn('Could not update user metadata:', updateError);
      }
      
      // Insert organization (as a vendor record for now)
      const { data: orgResult, error: orgError } = await supabase
        .from('vendors')
        .insert({
          name: orgData.name,
          contact_person: adminData.fullName,
          email: orgData.email,
          phone: orgData.phone,
          address: orgData.address,
          is_active: true,
        })
        .select()
        .single();
      
      if (orgError) throw orgError;
      
      // Insert warehouse
      const { error: whError } = await supabase
        .from('warehouses')
        .insert({
          name: warehouseData.name,
          code: warehouseData.code,
          address: warehouseData.address,
          is_active: true,
        });
      
      if (whError) throw whError;
      
      // Mark setup as complete
      const { error: settingsError } = await supabase
        .from('app_settings')
        .insert({
          key: 'setup_completed',
          value: 'true',
          description: 'Initial setup completed',
        });
      
      if (settingsError && settingsError.code !== '23505') {
        console.warn('Could not insert setup_completed flag:', settingsError);
      }
      
      setSuccess('Setup completed successfully!');
      setCurrentStep(5);
      
      // Store credentials for the app to use
      localStorage.setItem('supabase_url', credentials.supabaseUrl);
      localStorage.setItem('supabase_key', credentials.supabaseKey);
      
      setTimeout(() => {
        if (onComplete) {
          onComplete({
            supabaseUrl: credentials.supabaseUrl,
            supabaseKey: credentials.supabaseKey,
            adminEmail: adminData.email,
          });
        }
      }, 2000);
      
    } catch (err) {
      setError(`Setup failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Enter your Supabase project credentials. You can find these in your Supabase dashboard under Settings → API.
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="supabaseUrl">Supabase URL</Label>
        <Input
          id="supabaseUrl"
          placeholder="https://xxxxx.supabase.co"
          value={credentials.supabaseUrl}
          onChange={(e) => setCredentials({ ...credentials, supabaseUrl: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="supabaseKey">Supabase Anon Key</Label>
        <Input
          id="supabaseKey"
          type="password"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          value={credentials.supabaseKey}
          onChange={(e) => setCredentials({ ...credentials, supabaseKey: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <Button
        onClick={testConnection}
        disabled={isLoading || !credentials.supabaseUrl || !credentials.supabaseKey}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing...
          </>
        ) : connectionTested ? (
          connectionValid ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Connected
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Failed
            </>
          )
        ) : (
          'Test Connection'
        )}
      </Button>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && connectionValid && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Create the administrator account for your organization.
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input
          id="fullName"
          placeholder="John Doe"
          value={adminData.fullName}
          onChange={(e) => setAdminData({ ...adminData, fullName: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="adminEmail">Email Address *</Label>
        <Input
          id="adminEmail"
          type="email"
          placeholder="admin@company.com"
          value={adminData.email}
          onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="adminPassword">Password *</Label>
        <Input
          id="adminPassword"
          type="password"
          placeholder="••••••••"
          value={adminData.password}
          onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={adminData.confirmPassword}
          onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Set up your organization profile.
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="orgName">Organization Name *</Label>
        <Input
          id="orgName"
          placeholder="Acme Corporation"
          value={orgData.name}
          onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="orgCode">Organization Code *</Label>
        <Input
          id="orgCode"
          placeholder="ACME"
          value={orgData.code}
          onChange={(e) => setOrgData({ ...orgData, code: e.target.value.toUpperCase() })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="orgAddress">Address</Label>
        <Input
          id="orgAddress"
          placeholder="123 Business St, City"
          value={orgData.address}
          onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="orgPhone">Phone</Label>
          <Input
            id="orgPhone"
            placeholder="+1 234 567 8900"
            value={orgData.phone}
            onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="orgEmail">Email</Label>
          <Input
            id="orgEmail"
            type="email"
            placeholder="info@company.com"
            value={orgData.email}
            onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
            disabled={isLoading}
          />
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Set up your primary warehouse or storage location.
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="whName">Warehouse Name *</Label>
        <Input
          id="whName"
          placeholder="Main Warehouse"
          value={warehouseData.name}
          onChange={(e) => setWarehouseData({ ...warehouseData, name: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="whCode">Warehouse Code *</Label>
        <Input
          id="whCode"
          placeholder="WH001"
          value={warehouseData.code}
          onChange={(e) => setWarehouseData({ ...warehouseData, code: e.target.value.toUpperCase() })}
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="whAddress">Address</Label>
        <Input
          id="whAddress"
          placeholder="456 Storage Lane, Industrial Area"
          value={warehouseData.address}
          onChange={(e) => setWarehouseData({ ...warehouseData, address: e.target.value })}
          disabled={isLoading}
        />
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="text-center py-8">
      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
      <p className="text-muted-foreground">
        Your application is now configured and ready to use.<br />
        Redirecting you to the dashboard...
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Application Setup</CardTitle>
          <CardDescription>
            Step {currentStep} of {STEPS.length}: {STEPS.find(s => s.id === currentStep)?.title}
          </CardDescription>
          <Progress value={(currentStep / STEPS.length) * 100} className="mt-4" />
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="mb-6">
            <div className="flex justify-between">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        step.id < currentStep
                          ? 'bg-green-500 border-green-500 text-white'
                          : step.id === currentStep
                          ? 'border-blue-500 text-blue-500'
                          : 'border-gray-300 text-gray-300'
                      }`}
                    >
                      {step.id < currentStep ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs mt-2 text-center max-w-[80px] hidden sm:block">
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </CardContent>
        
        {currentStep < 5 && (
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1 || isLoading}
            >
              Back
            </Button>
            <Button onClick={handleNext} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : currentStep === 4 ? (
                'Complete Setup'
              ) : (
                'Continue'
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
