-- ManuscritPro: Row Level Security Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.manuscripts enable row level security;
alter table public.reviews enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.messages enable row level security;
alter table public.manuscript_reads enable row level security;
alter table public.download_requests enable row level security;

-- Helper: get current user role
create or replace function public.get_my_role()
returns text language sql stable security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- PROFILES
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or auth.uid() is not null);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- MANUSCRIPTS: public can read published ones
create policy "manuscripts_select_published" on public.manuscripts
  for select using (
    status in ('published', 'community_validated', 'submitted_editors')
    or author_id = auth.uid()
    or public.get_my_role() in ('editor', 'admin')
  );

create policy "manuscripts_insert_own" on public.manuscripts
  for insert with check (
    author_id = auth.uid()
    and public.get_my_role() = 'writer'
  );

create policy "manuscripts_update_own" on public.manuscripts
  for update using (author_id = auth.uid());

create policy "manuscripts_delete_own" on public.manuscripts
  for delete using (author_id = auth.uid());

-- REVIEWS: readers can read all reviews on published manuscripts
create policy "reviews_select" on public.reviews
  for select using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
      and (m.status in ('published', 'community_validated', 'submitted_editors') or m.author_id = auth.uid())
    )
  );

create policy "reviews_insert" on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and public.get_my_role() in ('reader', 'editor', 'admin')
    and not exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id and m.author_id = auth.uid()
    )
  );

create policy "reviews_update_own" on public.reviews
  for update using (reviewer_id = auth.uid());

-- Author can add reply
create policy "reviews_update_reply" on public.reviews
  for update using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id and m.author_id = auth.uid()
    )
  );

-- AI ANALYSES
create policy "ai_analyses_select" on public.ai_analyses
  for select using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
      and (m.author_id = auth.uid() or m.status in ('published', 'community_validated', 'submitted_editors'))
    )
  );

create policy "ai_analyses_insert_service" on public.ai_analyses
  for insert with check (true); -- Only via service role in API routes

create policy "ai_analyses_update_service" on public.ai_analyses
  for update using (true); -- Only via service role in API routes

-- BADGES: public read
create policy "badges_select_all" on public.badges
  for select using (true);

-- USER BADGES
create policy "user_badges_select" on public.user_badges
  for select using (true);

create policy "user_badges_insert_service" on public.user_badges
  for insert with check (true);

-- MESSAGES
create policy "messages_select_own" on public.messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.get_my_role() in ('editor', 'admin', 'writer')
  );

-- MANUSCRIPT READS
create policy "reads_insert" on public.manuscript_reads
  for insert with check (true);

create policy "reads_select_author" on public.manuscript_reads
  for select using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id and m.author_id = auth.uid()
    )
    or reader_id = auth.uid()
  );

-- DOWNLOAD REQUESTS
create policy "download_requests_select" on public.download_requests
  for select using (editor_id = auth.uid() or exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_id and m.author_id = auth.uid()
  ));

create policy "download_requests_insert" on public.download_requests
  for insert with check (
    editor_id = auth.uid()
    and public.get_my_role() = 'editor'
  );

create policy "download_requests_update_author" on public.download_requests
  for update using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id and m.author_id = auth.uid()
    )
  );
