# Supabase Integration Guide

## Overview
This project has been configured to support Supabase as an alternative backend to Base44. This guide will help you set up and migrate to Supabase.

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed

## Setup Steps

### 1. Create a Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details:
   - Project name
   - Database password (save this securely!)
   - Region (choose closest to your users)
4. Wait for the project to be created (~2 minutes)

### 2. Get Your API Credentials
1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables
1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Apply Database Schema
You have two options:

#### Option A: Using Supabase Dashboard (Recommended for beginners)
1. Go to your Supabase project → **SQL Editor**
2. Click "New Query"
3. Copy the entire content of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the editor
5. Click "Run" to execute the migration

#### Option B: Using Supabase CLI (Advanced)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### 5. Install Dependencies
The Supabase client is already installed. If you need to reinstall:
```bash
npm install @supabase/supabase-js
```

### 6. Update Frontend Authentication
To switch from Base44 Auth to Supabase Auth:

1. In `src/main.jsx`, change the AuthProvider import:
   ```jsx
   // Change FROM:
   import { AuthProvider } from '@/lib/AuthContext';
   
   // TO:
   import { AuthProvider } from '@/lib/SupabaseAuthContext';
   ```

2. Update components that use authentication to use the new context methods:
   - `login(email, password)` instead of Base44 login
   - `register(email, password)` for signup
   - `logout()` for sign out
   - `user` object from `useAuth()` hook

### 7. Test the Connection
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try to register a new user or login
3. Check the browser console for any errors
4. Verify users appear in Supabase Dashboard → **Authentication** → **Users**

## Database Tables Created

The migration creates these tables:
- `users` - User profiles (linked to auth.users)
- `vendors` - Supplier/vendor information
- `warehouses` - Warehouse locations
- `outlets` - Retail outlets/stores
- `items` - Product/item catalog
- `stock_items` - Current stock levels per location
- `stock_movements` - Stock transaction history
- `productions` - Production orders
- `receipts` - Purchase receipts
- `shipments` - Outbound shipments
- `app_settings` - Application configuration

## Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Allow authenticated users to read/write their own data
- Allow admins to manage all data
- Protect sensitive operations

## Next Steps

### Phase 1: Basic Setup ✅
- [x] Supabase client configured
- [x] Database schema created
- [x] Authentication context ready

### Phase 2: Migration Tasks
- [ ] Update all API calls from Base44 to Supabase
- [ ] Migrate existing data (if any)
- [ ] Test all features with Supabase backend
- [ ] Set up Supabase Edge Functions for complex logic

### Phase 3: Deployment
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Configure production environment variables
- [ ] Set up custom domain
- [ ] Enable database backups

## Troubleshooting

### "Invalid API key" error
- Double-check your `VITE_SUPABASE_ANON_KEY` in `.env`
- Ensure you're using the **anon/public** key, not the service role key
- Restart your dev server after changing `.env`

### "Row level security policy violation"
- Check that the user is authenticated
- Verify RLS policies match your use case
- Consider running tests as admin user initially

### Data not appearing
- Check browser console for errors
- Verify table names match exactly (PostgreSQL is case-sensitive)
- Ensure RLS policies allow the current user to access the data

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Best Practices](https://supabase.com/docs/guides/database/migrations)

## Support

For issues specific to this integration, check:
- `/src/lib/supabaseClient.js` - Supabase client configuration
- `/src/lib/SupabaseAuthContext.jsx` - Authentication context
- `/supabase/migrations/001_initial_schema.sql` - Database schema
