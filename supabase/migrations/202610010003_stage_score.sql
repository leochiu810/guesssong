-- Requires ranked_nickname_best from migration 202610010002.
-- Old cumulative scores remain in season v1; they cannot be converted reliably.
begin;
create or replace function public.submit_ranked_stage(p_user uuid,p_nickname text,p_passed integer,p_total integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare clean_name text := btrim(normalize(p_nickname,NFKC));
begin
 if p_user is null or clean_name is null or char_length(clean_name) not between 1 and 16
 or p_passed is null or p_passed not between 1 and 5 or p_total is null or p_total not between 0 and 1000 then raise exception 'Invalid result'; end if;
 insert into public.ranked_nickname_best(season,name_key,nickname,passed,total)
 values('stage-v2',lower(clean_name),clean_name,p_passed,p_total)
 on conflict(season,name_key) do update set nickname=excluded.nickname,passed=excluded.passed,total=excluded.total,achieved_at=now()
 where (excluded.passed,excluded.total)>(ranked_nickname_best.passed,ranked_nickname_best.total);
 return true;
end;
$$;
revoke all on function public.submit_ranked_stage(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_ranked_stage(uuid,text,integer,integer) to service_role;
commit;
