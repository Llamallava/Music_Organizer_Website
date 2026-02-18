create extension if not exists "pgcrypto";

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  next_code text;
  has_gen_random_bytes boolean;
begin
  has_gen_random_bytes := to_regprocedure('gen_random_bytes(integer)') is not null;

  loop
    if has_gen_random_bytes then
      next_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    else
      next_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    end if;

    exit when not exists (
      select 1
      from public.profiles
      where friend_code = next_code
    );
  end loop;

  return next_code;
end;
$$;
