-- 燒了嗎：公開分享牆（Supabase）
-- 用法：
-- 1) Supabase 專案 → SQL Editor → New query
-- 2) 貼上本檔內容 → Run

-- 公開供品：只存圖片在 Storage 的路徑 + 讚數
create table if not exists public.public_offerings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  order_id text not null,
  img_id text not null,
  caption text,
  storage_path text not null,
  like_count bigint not null default 0,
  unique (device_id, order_id, img_id)
);

alter table public.public_offerings enable row level security;

-- 任何人可看公開牆
drop policy if exists "public_offerings_select" on public.public_offerings;
create policy "public_offerings_select"
on public.public_offerings for select
to anon
using (true);

-- 任何人可新增（以 device_id 代表本機身分；可被偽造但已足夠原型）
drop policy if exists "public_offerings_insert" on public.public_offerings;
create policy "public_offerings_insert"
on public.public_offerings for insert
to anon
with check (device_id is not null and length(device_id) > 0);

-- 允許更新（給 RPC increment_like 使用）
drop policy if exists "public_offerings_update_any" on public.public_offerings;
create policy "public_offerings_update_any"
on public.public_offerings for update
to anon
using (true)
with check (true);

-- 原型簡化：允許刪除（不做身分驗證）
-- 若你之後要更嚴格，可以改成 Supabase Auth 登入後用 auth.uid() 控制。
drop policy if exists "public_offerings_delete_any" on public.public_offerings;
create policy "public_offerings_delete_any"
on public.public_offerings for delete
to anon
using (true);

-- RPC：安全遞增讚數（避免競態）
create or replace function public.increment_like(offering_id uuid)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  update public.public_offerings
  set like_count = like_count + 1
  where id = offering_id
  returning like_count into v;
  return v;
end;
$$;

grant execute on function public.increment_like(uuid) to anon;

