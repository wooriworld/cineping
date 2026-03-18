-- ── 테이블 생성 ──────────────────────────────────────────────────

create table movies (
  id uuid default gen_random_uuid() primary key,
  title text not null unique,
  "naverMovieId" text default '',
  poster text default '',
  "createdAt" timestamptz default now()
);

create table schedules (
  id uuid default gen_random_uuid() primary key,
  "movieId" uuid references movies(id) on delete cascade,
  chain text,
  theater text,
  date text,
  "startTime" text,
  "endTime" text,
  "screenType" text,
  "bookingUrl" text,
  "lastUpdatedAt" timestamptz
);

create table users (
  uid text primary key,
  "telegramChatId" text,
  watchlist text[] default '{}',
  "alertConditions" jsonb
);

-- ── 인덱스 ───────────────────────────────────────────────────────

create index schedules_movie_id_idx on schedules ("movieId");
create index schedules_date_idx on schedules (date);

-- ── RLS 비활성화 (내부 관리 툴) ──────────────────────────────────

alter table movies disable row level security;
alter table schedules disable row level security;
alter table users disable row level security;
