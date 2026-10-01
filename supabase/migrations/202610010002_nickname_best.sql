begin;
create table if not exists public.ranked_nickname_best (
 season text not null,
 name_key text not null,
 nickname text not null check(char_length(nickname) between 1 and 16),
 passed integer not null check(passed between 0 and 5),
 total integer not null check(total between 0 and 5000),
 achieved_at timestamptz not null default now(),
 primary key(season,name_key)
);
alter table public.ranked_nickname_best enable row level security;
revoke all on public.ranked_nickname_best from public,anon,authenticated;
grant all on public.ranked_nickname_best to service_role;
-- Keep historical tables intact and migrate the best score for each name.
insert into public.ranked_nickname_best(season,name_key,nickname,passed,total,achieved_at)
select distinct on(season,lower(btrim(normalize(nickname,NFKC))))
 season,lower(btrim(normalize(nickname,NFKC))),btrim(normalize(nickname,NFKC)),passed,total,achieved_at
from public.ranked_best
order by season,lower(btrim(normalize(nickname,NFKC))),passed desc,total desc,achieved_at asc,user_id
on conflict(season,name_key) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,achieved_at=excluded.achieved_at
where (excluded.passed,excluded.total)>(ranked_nickname_best.passed,ranked_nickname_best.total);
create or replace function public.submit_ranked_result(p_user uuid,p_nickname text,p_passed integer,p_total integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare clean_name text := btrim(normalize(p_nickname,NFKC));
begin
 if p_user is null or clean_name is null or char_length(clean_name) not between 1 and 16
 or p_passed is null or p_passed not between 0 and 5 or p_total is null or p_total not between 0 and 5000 then raise exception 'Invalid result'; end if;
 insert into public.ranked_nickname_best(season,name_key,nickname,passed,total)
 values('v1',lower(clean_name),clean_name,p_passed,p_total)
 on conflict(season,name_key) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,achieved_at=now()
 where (excluded.passed,excluded.total)>(ranked_nickname_best.passed,ranked_nickname_best.total);
 return true;
end;
$$;
revoke all on function public.submit_ranked_result(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_ranked_result(uuid,text,integer,integer) to service_role;
commit;
