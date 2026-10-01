begin;
alter table public.ranked_nickname_best add column if not exists cumulative integer check(cumulative between 0 and 5000);
-- Only first-stage records have a recoverable total. Other old scores stay unknown.
update public.ranked_nickname_best set cumulative=total where season='stage-v2' and passed=1 and cumulative is null;
create or replace function public.submit_ranked_stage_total(p_user uuid,p_nickname text,p_passed integer,p_total integer,p_cumulative integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare clean_name text := btrim(normalize(p_nickname,NFKC));
begin
 if p_user is null or clean_name is null or char_length(clean_name) not between 1 and 16
 or p_passed is null or p_passed not between 1 and 5 or p_total is null or p_total not between 0 and 1000
 or (p_cumulative is not null and (p_cumulative<p_total or p_cumulative>(p_passed-1)*1000+p_total)) then raise exception 'Invalid result'; end if;
 insert into public.ranked_nickname_best(season,name_key,nickname,passed,total,cumulative)
 values('stage-v2',lower(clean_name),clean_name,p_passed,p_total,p_cumulative)
 on conflict(season,name_key) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,cumulative=excluded.cumulative,achieved_at=now()
 where (excluded.passed,excluded.total)>(ranked_nickname_best.passed,ranked_nickname_best.total);
 return true;
end;
$$;
revoke all on function public.submit_ranked_stage_total(uuid,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_ranked_stage_total(uuid,text,integer,integer,integer) to service_role;
-- Older deployed clients/functions remain valid; never attach a previous run's total to a new score.
create or replace function public.submit_ranked_stage(p_user uuid,p_nickname text,p_passed integer,p_total integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return public.submit_ranked_stage_total(p_user,p_nickname,p_passed,p_total,case when p_passed=1 then p_total else null end);
end;
$$;
commit;
