-- ManuscritPro: Core Schema
-- Run after enabling Supabase Auth

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'reader' check (role in ('writer', 'reader', 'editor', 'admin')),
  avatar_url text,
  bio text,
  stripe_customer_id text,
  subscription_status text default 'inactive' check (subscription_status in ('active', 'inactive', 'canceled', 'past_due')),
  total_reviews_given integer default 0,
  total_reads integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Manuscripts
create table if not exists public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  genre text not null check (genre in ('roman', 'polar', 'sf', 'fantasy', 'jeunesse', 'essai', 'poesie', 'biographie', 'autre')),
  summary text check (length(summary) <= 500),
  target_audience text,
  page_count integer check (page_count > 0),
  word_count integer,
  status text not null default 'draft' check (status in ('draft', 'ai_review', 'published', 'community_validated', 'submitted_editors')),
  visibility text not null default 'excerpt' check (visibility in ('excerpt', 'full')),
  pdf_storage_path text,
  excerpt_storage_path text,
  cover_storage_path text,
  average_rating numeric(3, 2) default 0,
  total_reviews integer default 0,
  total_reads integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  style_rating integer not null check (style_rating between 1 and 5),
  originality_rating integer not null check (originality_rating between 1 and 5),
  narrative_rating integer not null check (narrative_rating between 1 and 5),
  emotion_rating integer not null check (emotion_rating between 1 and 5),
  overall_rating numeric(3, 2) generated always as (
    (style_rating + originality_rating + narrative_rating + emotion_rating)::numeric / 4
  ) stored,
  strengths text not null check (length(strengths) >= 50),
  improvements text not null check (length(improvements) >= 50),
  author_reply text,
  author_reply_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (manuscript_id, reviewer_id)
);

-- AI Analyses
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null unique references public.manuscripts(id) on delete cascade,
  -- 8 dimension scores (0-10)
  style_score integer check (style_score between 0 and 10),
  grammar_score integer check (grammar_score between 0 and 10),
  narrative_score integer check (narrative_score between 0 and 10),
  coherence_score integer check (coherence_score between 0 and 10),
  characters_score integer check (characters_score between 0 and 10),
  dialogues_score integer check (dialogues_score between 0 and 10),
  originality_score integer check (originality_score between 0 and 10),
  target_fit_score integer check (target_fit_score between 0 and 10),
  overall_score numeric(4, 2),
  -- Feedback per dimension
  style_feedback text,
  grammar_feedback text,
  grammar_errors jsonb default '[]',
  narrative_feedback text,
  coherence_feedback text,
  characters_feedback text,
  dialogues_feedback text,
  originality_feedback text,
  target_fit_feedback text,
  -- Summary
  global_summary text,
  key_strengths text[] default '{}',
  key_improvements text[] default '{}',
  -- Report
  report_pdf_path text,
  -- Processing state
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  chunks_analyzed integer default 0,
  total_chunks integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Badges catalogue
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text not null,
  criteria_type text not null check (criteria_type in ('reviews_given', 'reads_done', 'manuscripts_published', 'avg_review_quality')),
  criteria_value integer not null,
  created_at timestamptz default now()
);

-- User badges (earned)
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  unique (user_id, badge_id)
);

-- Messages (editor ↔ author)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  manuscript_id uuid references public.manuscripts(id) on delete set null,
  subject text not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Manuscript read tracking (for analytics)
create table if not exists public.manuscript_reads (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  reader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Editor download requests (manuscript owner must approve)
create table if not exists public.download_requests (
  id uuid primary key default gen_random_uuid(),
  editor_id uuid not null references public.profiles(id) on delete cascade,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (editor_id, manuscript_id)
);

-- Triggers: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'reader')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: update manuscript average rating on review change
create or replace function public.update_manuscript_rating()
returns trigger language plpgsql
as $$
declare
  v_avg numeric;
  v_count integer;
begin
  select avg(overall_rating), count(*)
  into v_avg, v_count
  from public.reviews
  where manuscript_id = coalesce(new.manuscript_id, old.manuscript_id);

  update public.manuscripts
  set
    average_rating = coalesce(v_avg, 0),
    total_reviews = v_count,
    status = case
      when v_count >= 20 and coalesce(v_avg, 0) >= 4.0 then 'community_validated'
      else status
    end,
    updated_at = now()
  where id = coalesce(new.manuscript_id, old.manuscript_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute procedure public.update_manuscript_rating();

-- Trigger: increment reviewer's total_reviews_given
create or replace function public.handle_review_insert()
returns trigger language plpgsql
as $$
begin
  update public.profiles
  set total_reviews_given = total_reviews_given + 1
  where id = new.reviewer_id;

  -- Check and award badges
  perform public.check_and_award_badges(new.reviewer_id);

  return new;
end;
$$;

drop trigger if exists on_review_insert on public.reviews;
create trigger on_review_insert
  after insert on public.reviews
  for each row execute procedure public.handle_review_insert();

-- Badge award function
create or replace function public.check_and_award_badges(p_user_id uuid)
returns void language plpgsql security definer
as $$
declare
  v_reviews integer;
  v_badge record;
begin
  select total_reviews_given into v_reviews
  from public.profiles where id = p_user_id;

  for v_badge in
    select * from public.badges
    where criteria_type = 'reviews_given'
    and criteria_value <= v_reviews
    and id not in (select badge_id from public.user_badges where user_id = p_user_id)
  loop
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, v_badge.id)
    on conflict do nothing;
  end loop;
end;
$$;

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_manuscripts_updated_at before update on public.manuscripts
  for each row execute procedure public.set_updated_at();
create trigger set_reviews_updated_at before update on public.reviews
  for each row execute procedure public.set_updated_at();
create trigger set_ai_analyses_updated_at before update on public.ai_analyses
  for each row execute procedure public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Indexes
create index if not exists idx_manuscripts_author on public.manuscripts(author_id);
create index if not exists idx_manuscripts_status on public.manuscripts(status);
create index if not exists idx_manuscripts_genre on public.manuscripts(genre);
create index if not exists idx_manuscripts_rating on public.manuscripts(average_rating desc);
create index if not exists idx_reviews_manuscript on public.reviews(manuscript_id);
create index if not exists idx_reviews_reviewer on public.reviews(reviewer_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_reads_manuscript on public.manuscript_reads(manuscript_id);
