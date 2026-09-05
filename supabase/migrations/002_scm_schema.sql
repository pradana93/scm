-- ============================================================
-- SCM APP SCHEMA (Base44 -> Supabase)
-- Field names intentionally match the frontend exactly.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Helper: updated_date trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- app_users (profile + role, linked to auth.users)
-- ------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  display_name text,
  job_title text,
  role text not null default 'public' check (role in ('user','admin','super_admin','public')),
  last_active_at text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.user_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  requested_role text not null default 'user' check (requested_role in ('user','admin','super_admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Master data
-- ------------------------------------------------------------
create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pemilik text,
  eta text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  satuan text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pic text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.master_packing_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qty_max numeric,
  koli numeric,
  satuan text,
  keterangan text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.feature_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  "group" text,
  allowed_roles jsonb not null default '[]'::jsonb,
  view_roles jsonb default '[]'::jsonb,
  edit_roles jsonb default '[]'::jsonb,
  delete_roles jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Stock
-- ------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  unit text,
  min_stock numeric default 0,
  category text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  type text not null default 'masuk' check (type in ('masuk','keluar')),
  quantity numeric not null default 0,
  unit text,
  note text,
  reference text,
  date date,
  warehouse text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Shipments
-- ------------------------------------------------------------
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  outlet_name text,
  tonnage numeric default 0,
  ro_tonnage numeric,
  status text default 'menunggu_antrian',
  fleet text,
  delivery_date date,
  warehouse text default 'Gudang Jakarta',
  checker_name text,
  crew_count integer default 0,
  timestamp_dalam_proses text,
  timestamp_proses_picking text,
  timestamp_proses_packing text,
  timestamp_proses_loading text,
  timestamp_proses_picking_end text,
  timestamp_proses_packing_end text,
  timestamp_proses_loading_end text,
  timestamp_sudah_dikirim text,
  actual_arrival_date date,
  picking_pic text,
  picking_do_count numeric,
  picking_notes text,
  picking_crew_count numeric,
  ro_received_by text,
  packing_checker_name text,
  packing_crew_count numeric,
  packing_total_koli numeric,
  packing_tonnage_status text,
  loading_pic text,
  loading_crew_count numeric,
  loading_koli numeric,
  loading_koli_status text,
  proof_picking_url text,
  proof_packing_url text,
  license_plate text,
  proof_file_url text,
  accuracy text,
  complaint_reason text,
  complaint_type jsonb default '[]'::jsonb,
  complaint_category jsonb default '[]'::jsonb,
  rescheduled_from_date date,
  reschedule_reason text,
  reschedule_note text,
  do_number text,
  document_type text default 'delivery_order',
  do_items jsonb default '[]'::jsonb,
  packing_list_data jsonb default '[]'::jsonb,
  packing_log jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists shipments_delivery_date_idx on public.shipments (delivery_date);

-- ------------------------------------------------------------
-- Production
-- ------------------------------------------------------------
create table if not exists public.production_requests (
  id uuid primary key default gen_random_uuid(),
  request_date date,
  warehouse text default 'Gudang Jakarta',
  item_name text,
  unit text,
  requested_quantity numeric,
  current_stock numeric,
  note text,
  status text default 'open',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  plan_date date,
  item_name text,
  planned_quantity numeric,
  unit text,
  warehouse text default 'Gudang Jakarta',
  note text,
  status text default 'menunggu_proses',
  status_history jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.production_processes (
  id uuid primary key default gen_random_uuid(),
  plan_id text,
  request_id text,
  plan_date date,
  item_name text,
  unit text,
  warehouse text,
  round_quantity numeric,
  crew_count integer default 0,
  note text,
  status text default 'dalam_proses',
  timestamp_start text,
  timestamp_end text,
  actual_date date,
  actual_quantity numeric,
  reject_quantity numeric,
  reject_unit text,
  actual_note text,
  pic_name text,
  freezing_start_ts text,
  freezing_end_ts text,
  freezing_duration numeric,
  freezing_actual_quantity numeric,
  status_history jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Receipts
-- ------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  arrival_date date,
  warehouse text,
  sender_name text,
  status text default 'rencana',
  note text,
  items jsonb default '[]'::jsonb,
  status_history jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.receipt_processes (
  id uuid primary key default gen_random_uuid(),
  receipt_id text,
  arrival_date date,
  warehouse text,
  sender_name text,
  stock_keeper_name text,
  crew_count integer default 0,
  receive_start_ts text,
  receive_end_ts text,
  receive_duration numeric,
  match_status text,
  surat_jalan_url text,
  received_items jsonb default '[]'::jsonb,
  note text,
  status text default 'dalam_proses',
  status_history jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.receipt_verifications (
  id uuid primary key default gen_random_uuid(),
  process_id text,
  receipt_id text,
  verified_by text,
  verified_date date,
  match_status text,
  surat_jalan_url text,
  items jsonb default '[]'::jsonb,
  complete_note text,
  status text default 'menunggu_verifikasi',
  status_history jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_date triggers
-- ------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'app_users','user_requests','outlets','items','vendors','warehouses',
    'master_packing_items','feature_permissions','stock_items','stock_movements',
    'shipments','production_requests','productions','production_processes',
    'receipts','receipt_processes','receipt_verifications'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_date_%1$s on public.%1$I', t);
    execute format(
      'create trigger set_updated_date_%1$s before update on public.%1$I
       for each row execute function public.set_updated_date()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Role helpers (security definer to avoid RLS recursion)
-- ------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.app_users where auth_user_id = auth.uid() limit 1),
    'public'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('user','admin','super_admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin','super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin';
$$;

-- ------------------------------------------------------------
-- Auto-provision profile on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (auth_user_id, email, full_name, display_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'public'
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'app_users','user_requests','outlets','items','vendors','warehouses',
    'master_packing_items','feature_permissions','stock_items','stock_movements',
    'shipments','production_requests','productions','production_processes',
    'receipts','receipt_processes','receipt_verifications'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- app_users
drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
  for select to authenticated using (true);

drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists app_users_insert on public.app_users;
create policy app_users_insert on public.app_users
  for insert to authenticated with check (public.is_admin());

drop policy if exists app_users_delete on public.app_users;
create policy app_users_delete on public.app_users
  for delete to authenticated
  using (public.is_super_admin() or auth_user_id = auth.uid());

-- user_requests: any authenticated user may request access
drop policy if exists user_requests_insert on public.user_requests;
create policy user_requests_insert on public.user_requests
  for insert to authenticated with check (true);

drop policy if exists user_requests_select on public.user_requests;
create policy user_requests_select on public.user_requests
  for select to authenticated using (public.is_admin());

drop policy if exists user_requests_update on public.user_requests;
create policy user_requests_update on public.user_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_requests_delete on public.user_requests;
create policy user_requests_delete on public.user_requests
  for delete to authenticated using (public.is_admin());

-- Master data + operational tables: read for any authenticated user,
-- writes for staff, deletes for admins. Mirrors the original Base44 RLS intent.
do $$
declare
  t text;
  tables text[] := array[
    'outlets','items','vendors','warehouses','master_packing_items',
    'stock_items','stock_movements','shipments',
    'production_requests','productions','production_processes',
    'receipts','receipt_processes','receipt_verifications'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_staff())', t);

    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);

    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end;
$$;

-- feature_permissions: readable by all, writable by super admin only
drop policy if exists feature_permissions_select on public.feature_permissions;
create policy feature_permissions_select on public.feature_permissions
  for select to authenticated using (true);

drop policy if exists feature_permissions_write on public.feature_permissions;
create policy feature_permissions_write on public.feature_permissions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ------------------------------------------------------------
-- Storage bucket for uploads (proof files, surat jalan, packing)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

drop policy if exists uploads_read on storage.objects;
create policy uploads_read on storage.objects
  for select using (bucket_id = 'uploads');

drop policy if exists uploads_insert on storage.objects;
create policy uploads_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');

drop policy if exists uploads_update on storage.objects;
create policy uploads_update on storage.objects
  for update to authenticated using (bucket_id = 'uploads');

drop policy if exists uploads_delete on storage.objects;
create policy uploads_delete on storage.objects
  for delete to authenticated using (bucket_id = 'uploads');
