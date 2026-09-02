# 🚀 Application Setup Guide

## Overview
This application now uses **Supabase** as its backend database and authentication provider. On first launch, you'll be guided through a setup wizard to configure your Supabase connection.

---

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. A **Supabase** account (free tier available at https://supabase.com)

---

## 🔧 Step-by-Step Setup

### 1. Create Your Supabase Project

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in:
   - **Organization**: Select or create one
   - **Project name**: e.g., "Warehouse Management"
   - **Database password**: Save this securely!
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes

### 2. Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 3. Apply Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **"New query"**
3. Copy the entire content from `/supabase/migrations/001_initial_schema.sql`
4. Paste and click **"Run"**
5. You should see "Success. No rows returned"

### 4. Run the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Complete the Setup Wizard

The app will automatically detect that no Supabase configuration exists and show the setup wizard:

#### Step 1: Supabase Connection
- Paste your **Project URL**
- Paste your **anon public** key
- Click **"Test Connection"** ✅

#### Step 2: Admin Account
- Enter your full name
- Enter admin email (this will be your login)
- Create a password (min 6 characters)
- Confirm password

#### Step 3: Organization Profile
- Organization name (e.g., "Acme Corp")
- Organization code (e.g., "ACME")
- Optional: address, phone, email

#### Step 4: Warehouse Setup
- Warehouse name (e.g., "Main Warehouse")
- Warehouse code (e.g., "WH001")
- Optional: address

#### Step 5: Complete! 🎉
- Your credentials are saved locally
- Database is initialized
- You'll be redirected to the login page

---

## 🔐 First Login

1. Use the **email** and **password** you created in Step 2
2. Click **Login**
3. You're in! 🚀

---

## 📁 File Structure

```
/workspace
├── src/
│   ├── components/
│   │   └── setup/
│   │       └── SetupWizard.jsx      # Setup wizard UI
│   ├── lib/
│   │   ├── SetupContext.jsx         # Setup state management
│   │   ├── SupabaseAuthContext.jsx  # Authentication
│   │   └── supabaseClient.js        # Supabase client config
│   └── main.jsx                      # App entry point
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Database schema
└── .env.example                      # Environment template
```

---

## 🗄️ Database Schema

The migration creates these tables:

| Table | Description |
|-------|-------------|
| `users` | Extended user profiles |
| `vendors` | Organizations/companies |
| `warehouses` | Storage locations |
| `outlets` | Retail outlets |
| `items` | Product catalog |
| `stock_items` | Inventory levels |
| `stock_movements` | Inventory transactions |
| `productions` | Production orders |
| `receipts` | Incoming goods |
| `shipments` | Outgoing shipments |
| `app_settings` | Application configuration |

All tables have **Row Level Security (RLS)** enabled for data protection.

---

## 🔑 How It Works

### Dynamic Configuration
- Credentials are stored in `localStorage` after setup
- No `.env` file required for local development
- App checks for setup completion on every load

### Authentication Flow
1. User signs up via Setup Wizard
2. Supabase Auth creates the user
3. User data is linked to organization
4. Session persists across refreshes

### Data Security
- Row Level Security (RLS) policies protect all tables
- Users can only access data from their organization
- Admin role has elevated permissions

---

## 🛠️ Troubleshooting

### "Connection failed" error
- Verify your Project URL is correct (should start with `https://`)
- Make sure you copied the **anon public** key, not the service_role key
- Check if you ran the SQL migration successfully

### "Table does not exist" error
- Go to Supabase SQL Editor
- Re-run the migration script from `/supabase/migrations/001_initial_schema.sql`

### Can't login after setup
- Check browser console for errors
- Verify the admin user was created in Supabase Dashboard → Authentication → Users
- Try resetting your password

### Setup wizard keeps appearing
- Clear browser cache and localStorage
- Check if `setup_completed` flag exists in `app_settings` table
- Re-run the final step of the wizard

---

## 🌐 Deployment

### Frontend (Vercel/Netlify)
1. Push code to GitHub
2. Connect repository to Vercel/Netlify
3. Deploy! (No env vars needed - credentials are in localStorage)

### Alternative: Environment Variables
For production, you may want to use environment variables:

```bash
# Create .env file
cp .env.example .env

# Edit .env with your Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Supabase dashboard for any issues
3. Review this guide step-by-step
4. Check Supabase documentation: https://supabase.com/docs

---

## 🎯 Next Steps

After setup:
- ✅ Add more warehouses/outlets
- ✅ Create item catalog
- ✅ Manage inventory
- ✅ Process receipts and shipments
- ✅ Track production
- ✅ Generate reports

Welcome to your new independent warehouse management system! 🎉
