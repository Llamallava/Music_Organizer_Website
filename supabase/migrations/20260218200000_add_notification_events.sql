create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notification_events_type_check check (
    event_type in ('recommendation_received', 'recommendation_listened')
  )
);

create index if not exists notification_events_user_id_created_at_idx
on public.notification_events (user_id, created_at desc);

create index if not exists notification_events_user_id_read_at_idx
on public.notification_events (user_id, read_at);

alter table public.notification_events enable row level security;

create policy "notification_events_select_own"
on public.notification_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "notification_events_update_own"
on public.notification_events
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_song_recommendation_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notification_events (user_id, event_type, payload)
    values (
      new.receiver_user_id,
      'recommendation_received',
      jsonb_build_object(
        'sender_user_id', new.sender_user_id,
        'song_name', new.song_name,
        'artist_name', new.artist_name,
        'recommendation_id', new.id
      )
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.notification_events (user_id, event_type, payload)
    values (
      old.sender_user_id,
      'recommendation_listened',
      jsonb_build_object(
        'listener_user_id', old.receiver_user_id,
        'song_name', old.song_name,
        'artist_name', old.artist_name
      )
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists song_recommendations_emit_notifications on public.song_recommendations;
create trigger song_recommendations_emit_notifications
after insert or delete on public.song_recommendations
for each row execute function public.handle_song_recommendation_notifications();
