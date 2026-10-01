create table public.ranked_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 run_id uuid not null,
 revision integer not null,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.ranked_best (
 user_id uuid not null references auth.users(id) on delete cascade,
 season text not null,
 nickname text not null check (char_length(nickname) between 1 and 16),
 passed integer not null check (passed between 0 and 5),
 total integer not null check (total between 0 and 5000),
 achieved_at timestamptz not null default now(),
 primary key(user_id,season)
);
alter table public.ranked_sessions enable row level security;
alter table public.ranked_best enable row level security;
revoke all on public.ranked_sessions, public.ranked_best from anon, authenticated;
grant all on public.ranked_sessions, public.ranked_best to service_role;
create index ranked_best_order on public.ranked_best(season,passed desc,total desc,achieved_at);
-- Only the authenticated Edge Function can commit calculated server state.
create or replace function public.commit_ranked_state(p_user uuid,p_expected integer,p_run uuid,p_state jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_row public.ranked_sessions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into current_row from public.ranked_sessions where user_id=p_user for update;
 if p_expected is null then
  if current_row.updated_at>now()-interval '15 seconds' then raise exception '請稍候再開始新挑戰'; end if;
 else
  if current_row.user_id is null or current_row.revision<>p_expected or current_row.run_id<>p_run then return false; end if;
 end if;
 insert into public.ranked_sessions(user_id,run_id,revision,state,updated_at)
 values(p_user,(p_state->>'runId')::uuid,(p_state->>'revision')::integer,p_state,now())
 on conflict(user_id) do update set run_id=excluded.run_id,revision=excluded.revision,state=excluded.state,updated_at=excluded.updated_at;
 if p_state->>'phase'='result' then
  insert into public.ranked_best(user_id,season,nickname,passed,total)
  values(p_user,p_state->>'season',p_state->>'nickname',(p_state->>'passed')::integer,(p_state->>'total')::integer)
  on conflict(user_id,season) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,achieved_at=now()
  where (excluded.passed,excluded.total)>(ranked_best.passed,ranked_best.total);
 end if;
 return true;
end;
$$;
revoke all on function public.commit_ranked_state(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_ranked_state(uuid,integer,uuid,jsonb) to service_role;
