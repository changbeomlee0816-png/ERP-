-- ============================================================
-- FlexERP — Supabase 스키마 (단일 회사 · 여러 사용자)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.
-- 문서형 저장: 전체 ERP 상태를 하나의 JSONB 행으로 보관하고
-- Realtime 으로 여러 사용자에게 변경을 실시간 전파합니다.
-- ============================================================

-- 1) 상태 테이블 --------------------------------------------------
create table if not exists public.erp_state (
  id          text primary key default 'main',
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id)
);

-- updated_at 자동 갱신 트리거
create or replace function public.touch_erp_state()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_erp_state on public.erp_state;
create trigger trg_touch_erp_state
  before update on public.erp_state
  for each row execute function public.touch_erp_state();

-- 2) Row Level Security ------------------------------------------
-- 로그인한 사용자(authenticated)만 회사 데이터를 읽고 쓸 수 있습니다.
alter table public.erp_state enable row level security;

drop policy if exists "erp_state read"   on public.erp_state;
drop policy if exists "erp_state insert" on public.erp_state;
drop policy if exists "erp_state update" on public.erp_state;
drop policy if exists "erp_state delete" on public.erp_state;

create policy "erp_state read"
  on public.erp_state for select
  to authenticated using (true);

create policy "erp_state insert"
  on public.erp_state for insert
  to authenticated with check (true);

create policy "erp_state update"
  on public.erp_state for update
  to authenticated using (true) with check (true);

create policy "erp_state delete"
  on public.erp_state for delete
  to authenticated using (true);

-- 3) Realtime 전파 -----------------------------------------------
-- 다른 사용자가 저장하면 즉시 화면에 반영되도록 publication 에 등록합니다.
alter table public.erp_state replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'erp_state'
  ) then
    alter publication supabase_realtime add table public.erp_state;
  end if;
end $$;
