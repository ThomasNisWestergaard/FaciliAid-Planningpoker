create table if not exists sessions (
  id bigint generated always as identity primary key,
  session_code text not null unique,
  title text not null,
  host_token text not null,
  current_round_number integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id bigint generated always as identity primary key,
  session_id bigint not null references sessions(id) on delete cascade,
  participant_token text not null unique,
  name text not null,
  avatar text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now()
);

create table if not exists rounds (
  id bigint generated always as identity primary key,
  session_id bigint not null references sessions(id) on delete cascade,
  round_number integer not null,
  issue_title text null,
  is_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(session_id, round_number)
);

create table if not exists votes (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  participant_id bigint not null references participants(id) on delete cascade,
  value text not null,
  voted_at timestamptz not null default now(),
  unique(round_id, participant_id)
);

create index if not exists idx_sessions_code on sessions(session_code);
create index if not exists idx_participants_session on participants(session_id);
create index if not exists idx_rounds_session on rounds(session_id);
create index if not exists idx_votes_round on votes(round_id);

alter table sessions enable row level security;
alter table participants enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;

drop policy if exists "deny all sessions" on sessions;
drop policy if exists "deny all participants" on participants;
drop policy if exists "deny all rounds" on rounds;
drop policy if exists "deny all votes" on votes;

create policy "deny all sessions" on sessions for all using (false) with check (false);
create policy "deny all participants" on participants for all using (false) with check (false);
create policy "deny all rounds" on rounds for all using (false) with check (false);
create policy "deny all votes" on votes for all using (false) with check (false);
