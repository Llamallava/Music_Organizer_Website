alter table public.song_recommendations
add column if not exists recommendation_type text not null default 'song';

alter table public.song_recommendations
drop constraint if exists song_recommendations_recommendation_type_check;

alter table public.song_recommendations
add constraint song_recommendations_recommendation_type_check
check (recommendation_type in ('song', 'album'));

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
        'recommendation_id', new.id,
        'recommendation_type', new.recommendation_type
      )
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from public.notification_events notification
    where notification.user_id = old.receiver_user_id
      and notification.event_type = 'recommendation_received'
      and notification.payload->>'recommendation_id' = old.id::text;

    insert into public.notification_events (user_id, event_type, payload)
    values (
      old.sender_user_id,
      'recommendation_listened',
      jsonb_build_object(
        'listener_user_id', old.receiver_user_id,
        'song_name', old.song_name,
        'artist_name', old.artist_name,
        'recommendation_type', old.recommendation_type
      )
    );

    return old;
  end if;

  return null;
end;
$$;

update public.notification_events
set payload = jsonb_set(payload, '{recommendation_type}', '"song"'::jsonb, true)
where event_type in ('recommendation_received', 'recommendation_listened')
  and not (payload ? 'recommendation_type');
