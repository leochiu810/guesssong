-- Abort without modifying scores if existing nicknames conflict.
begin;
create table if not exists public.ranked_names (
 name_key text primary key,
 user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.ranked_names enable row level security;
revoke all on public.ranked_names from public,anon,authenticated;
grant all on public.ranked_names to service_role;
do $$ begin
 if exists(select 1 from public.ranked_best group by lower(btrim(normalize(nickname,NFKC))) having count(distinct user_id)>1) then
  raise exception 'Existing duplicate nicknames: resolve duplicates before applying this migration';
 end if;
end $$;
insert into public.ranked_names(name_key,user_id)
select distinct lower(btrim(normalize(nickname,NFKC))),user_id from public.ranked_best
on conflict(name_key) do nothing;
create or replace function public.claim_ranked_name(p_user uuid,p_nickname text)
returns boolean language plpgsql security definer set search_path='' as $$
declare name_value text := btrim(normalize(p_nickname,NFKC)); owner_id uuid;
begin
 if name_value is null or char_length(name_value) not between 1 and 16 then raise exception 'Invalid nickname'; end if;
 insert into public.ranked_names(name_key,user_id) values(lower(name_value),p_user) on conflict(name_key) do nothing;
 select user_id into owner_id from public.ranked_names where name_key=lower(name_value);
 if owner_id is distinct from p_user then raise exception 'NICKNAME_TAKEN'; end if;
 return true;
end;
$$;
revoke all on function public.claim_ranked_name(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_ranked_name(uuid,text) to service_role;
-- Adds result-only recording; existing best scores and player identities remain.
create or replace function public.submit_ranked_result(p_user uuid,p_nickname text,p_passed integer,p_total integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_nickname is null or char_length(p_nickname) not between 1 and 16
    or p_passed is null or p_passed not between 0 and 5
    or p_total is null or p_total not between 0 and 5000 then
  raise exception 'Invalid result';
 end if;
 perform public.claim_ranked_name(p_user,p_nickname);
 insert into public.ranked_best(user_id,season,nickname,passed,total)
 values(p_user,'v1',p_nickname,p_passed,p_total)
 on conflict(user_id,season) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,achieved_at=now()
 where (excluded.passed,excluded.total)>(ranked_best.passed,ranked_best.total);
 return true;
end;
$$;
revoke all on function public.submit_ranked_result(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_ranked_result(uuid,text,integer,integer) to service_role;
-- Old session table is retained for compatibility, but the new function never writes it.

commit;
