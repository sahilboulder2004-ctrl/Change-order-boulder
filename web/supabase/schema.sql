-- Change Order Tracker — schema (v2)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → your project → SQL Editor → New query
-- Apply schema.sql first, then seed.sql for dummy data.

-- ─── PROJECTS ───────────────────────────────────────────────────
create table if not exists public.projects (
  id                text primary key,
  prefix            text not null,
  name              text not null,
  original_contract numeric default 0,
  current_contract  numeric default 0,
  start_date        date,
  contract_type     text check (contract_type in ('labour','turnkey')),
  sort_order        integer default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- For existing installs, also add the columns idempotently.
alter table public.projects
  add column if not exists start_date date,
  add column if not exists contract_type text check (contract_type in ('labour','turnkey'));

-- ─── CHANGE ORDERS ──────────────────────────────────────────────
create table if not exists public.change_orders (
  id              text primary key,
  num             text not null,
  title           text not null,
  type            text,
  category        text,
  priority        text,
  project         text references public.projects(id) on delete set null,
  status          text,
  submitted_by    text,
  reviewed_by     text,
  submitted_date  date,
  reviewed_date   date,
  executed_date   date,
  due_date        date,
  requested_amt   numeric default 0,
  approved_amt    numeric default 0,
  schedule_impact integer default 0,
  description     text,
  justification   text,
  linked_rfi      text,
  linked_spec     text,
  linked_drawing  text,
  assignees       jsonb default '[]'::jsonb,
  photos          jsonb default '[]'::jsonb,
  attachments     jsonb default '[]'::jsonb,
  comments        jsonb default '[]'::jsonb,
  line_items      jsonb default '[]'::jsonb,
  owner_markup    numeric default 0,
  gc_markup       numeric default 0,
  is_sub_co       boolean default false,
  sub_cos         jsonb default '[]'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists change_orders_project_idx on public.change_orders (project);
create index if not exists change_orders_status_idx  on public.change_orders (status);
create index if not exists change_orders_due_idx     on public.change_orders (due_date);

-- ─── SUB COs ────────────────────────────────────────────────────
create table if not exists public.sub_cos (
  id             text primary key,
  parent_co      text references public.change_orders(id) on delete cascade,
  num            text not null,
  sub            text,
  sub_name       text,
  title          text,
  submitted_date date,
  approved_date  date,
  requested_amt  numeric default 0,
  approved_amt   numeric default 0,
  status         text,
  comments       text,
  attachments    jsonb default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  created_by     uuid references auth.users(id) on delete set null
);

-- ─── updated_at trigger ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists proj_touch on public.projects;
create trigger proj_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists co_touch on public.change_orders;
create trigger co_touch before update on public.change_orders
  for each row execute function public.touch_updated_at();

drop trigger if exists sco_touch on public.sub_cos;
create trigger sco_touch before update on public.sub_cos
  for each row execute function public.touch_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Currently the app runs without login, so anon is allowed full access.
-- For production: drop the anon policies and keep only the authenticated ones.
alter table public.projects      enable row level security;
alter table public.change_orders enable row level security;
alter table public.sub_cos       enable row level security;

-- projects
drop policy if exists "projects_all_anon" on public.projects;
create policy "projects_all_anon" on public.projects
  for all to anon using (true) with check (true);

drop policy if exists "projects_all_auth" on public.projects;
create policy "projects_all_auth" on public.projects
  for all to authenticated using (true) with check (true);

-- change_orders
drop policy if exists "co_all_anon" on public.change_orders;
create policy "co_all_anon" on public.change_orders
  for all to anon using (true) with check (true);

drop policy if exists "co_all_auth" on public.change_orders;
create policy "co_all_auth" on public.change_orders
  for all to authenticated using (true) with check (true);

-- sub_cos
drop policy if exists "sco_all_anon" on public.sub_cos;
create policy "sco_all_anon" on public.sub_cos
  for all to anon using (true) with check (true);

drop policy if exists "sco_all_auth" on public.sub_cos;
create policy "sco_all_auth" on public.sub_cos
  for all to authenticated using (true) with check (true);

-- ─── STORAGE (private bucket for attachments + photos) ──────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('co-files', 'co-files', false, 10485760, null)
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit;

drop policy if exists "co_files_select" on storage.objects;
create policy "co_files_select" on storage.objects for select using (bucket_id = 'co-files');

drop policy if exists "co_files_insert" on storage.objects;
create policy "co_files_insert" on storage.objects for insert with check (bucket_id = 'co-files');

drop policy if exists "co_files_update" on storage.objects;
create policy "co_files_update" on storage.objects for update
  using (bucket_id = 'co-files') with check (bucket_id = 'co-files');

drop policy if exists "co_files_delete" on storage.objects;
create policy "co_files_delete" on storage.objects for delete
  using (bucket_id = 'co-files');

-- ─── AUDIT LOG ──────────────────────────────────────────────────
create table if not exists public.audit_log (
  id         bigserial primary key,
  table_name text not null,
  row_id     text not null,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz default now(),
  old_data   jsonb,
  new_data   jsonb,
  diff       jsonb
);

create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, changed_at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_diff jsonb := null;
  v_id text := coalesce((v_new->>'id'), (v_old->>'id'));
  k text;
begin
  if tg_op = 'UPDATE' then
    v_diff := '{}'::jsonb;
    for k in select jsonb_object_keys(v_new) loop
      if v_new->k is distinct from v_old->k and k not in ('updated_at') then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return new; end if;
  end if;
  insert into public.audit_log(table_name, row_id, action, changed_by, old_data, new_data, diff)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_old, v_new, v_diff);
  return coalesce(new, old);
end $$;

drop trigger if exists co_audit on public.change_orders;
create trigger co_audit after insert or update or delete on public.change_orders
  for each row execute function public.audit_trigger();

drop trigger if exists sco_audit on public.sub_cos;
create trigger sco_audit after insert or update or delete on public.sub_cos
  for each row execute function public.audit_trigger();

alter table public.audit_log enable row level security;

drop policy if exists "audit_select_anon" on public.audit_log;
create policy "audit_select_anon" on public.audit_log for select to anon using (true);

drop policy if exists "audit_select_auth" on public.audit_log;
create policy "audit_select_auth" on public.audit_log for select to authenticated using (true);

-- ─── PROFILES ───────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'pm' check (role in ('pm','super','apm','owner','arch','sub','admin')),
  company    text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());
