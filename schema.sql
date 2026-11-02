-- Supabase SQL Editor에서 실행하세요. RLS는 관리자만 쓰기를 허용합니다.
create extension if not exists pgcrypto;
create table if not exists public.restaurants (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(trim(name)) between 1 and 60),
 category text not null check (category in ('한식','중식','일식','양식','분식','기타')),
 price integer not null check (price between 1 and 1000000),
 created_at timestamptz not null default now()
);
create table if not exists public.restaurant_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.restaurants enable row level security;
alter table public.restaurant_admins enable row level security;
revoke all on public.restaurants from anon, authenticated;
revoke all on public.restaurant_admins from anon, authenticated;
grant select on public.restaurants to anon, authenticated;
grant insert, delete on public.restaurants to authenticated;
grant select on public.restaurant_admins to authenticated;
drop policy if exists restaurants_read on public.restaurants;
create policy restaurants_read on public.restaurants for select to anon, authenticated using (true);
drop policy if exists restaurants_insert_admin on public.restaurants;
create policy restaurants_insert_admin on public.restaurants for insert to authenticated with check (exists(select 1 from public.restaurant_admins where user_id = (select auth.uid())));
drop policy if exists restaurants_delete_admin on public.restaurants;
create policy restaurants_delete_admin on public.restaurants for delete to authenticated using (exists(select 1 from public.restaurant_admins where user_id = (select auth.uid())));
drop policy if exists admin_self_read on public.restaurant_admins;
create policy admin_self_read on public.restaurant_admins for select to authenticated using (user_id = (select auth.uid()));
-- 관리자 계정 생성 후 Supabase Authentication > Users에서 UUID 확인
-- 아래 SQL의 UUID를 교체해 별도로 실행하세요:
-- insert into public.restaurant_admins(user_id) values ('관리자-UUID');
