# SCM App

Supply chain management app running on **React + Vite**, **Supabase** (database, auth, storage) and deployed on **Vercel**. There is no Base44 dependency.

## Stack

| Concern | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind, shadcn/ui |
| Data + Auth + Storage | Supabase |
| Hosting | Vercel |

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Database Setup

Apply the schema in `supabase/migrations/002_scm_schema.sql`.

**Option A — Supabase dashboard (simplest)**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/002_scm_schema.sql`.
3. Click **Run**.

**Option B — Supabase CLI**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The migration creates all tables, `updated_date` triggers, role helper functions, row level security policies, the signup trigger that provisions a profile row, and the public `uploads` storage bucket.

### Granting the first admin

Every new signup gets the `public` role. Promote your own account once, from the SQL editor:

```sql
update public.app_users
set role = 'super_admin'
where email = 'you@example.com';
```

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repository.
3. Vercel reads `vercel.json`, so build settings are detected automatically:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add the environment variables under **Settings → Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |

5. Deploy.

`vercel.json` includes an SPA rewrite so client-side routes such as `/pengiriman` resolve correctly on refresh.

### Supabase auth redirect URLs

In Supabase → **Authentication → URL Configuration**, set:

- **Site URL**: your Vercel production URL
- **Redirect URLs**: your Vercel URL plus `http://localhost:5173` for local development

This makes password reset and OAuth redirects work in both environments.

## Project Structure

```
src/
  api/dataClient.js     # Supabase-backed data layer (entities, auth, storage, users)
  lib/AuthContext.jsx   # Authentication + profile/role state
  lib/supabaseClient.js # Supabase client
  components/           # UI and feature components
  pages/                # Routed pages
supabase/migrations/    # Database schema
vercel.json             # Vercel build + SPA rewrites
```

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run preview    # preview the production build
npm run lint       # lint
```
