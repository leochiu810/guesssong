-- Adds result-only recording; existing best scores and player identities remain.
create or replace function public.submit_ranked_result(p_user uuid,p_nickname text,p_passed integer,p_total integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_nickname is null or char_length(p_nickname) not between 1 and 16
    or p_passed is null or p_passed not between 0 and 5
    or p_total is null or p_total not between 0 and 5000 then
  raise exception 'Invalid result';
 end if;
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
