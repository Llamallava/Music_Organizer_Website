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
        'artist_name', old.artist_name
      )
    );

    return old;
  end if;

  return null;
end;
$$;

delete from public.notification_events notification
where notification.event_type = 'recommendation_received'
  and not exists (
    select 1
    from public.song_recommendations recommendation
    where recommendation.id::text = notification.payload->>'recommendation_id'
      and recommendation.receiver_user_id = notification.user_id
  );
