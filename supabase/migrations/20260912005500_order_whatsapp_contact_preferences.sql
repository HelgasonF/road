alter table public.whatsapp_contact_preferences
add column effective_at timestamptz;

update public.whatsapp_contact_preferences preference
set effective_at = inbound.received_at
from public.whatsapp_inbound_messages inbound
where inbound.id = preference.source_inbound_message_id;

alter table public.whatsapp_contact_preferences
alter column effective_at set not null;

create or replace function public.apply_whatsapp_contact_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  next_status text;
begin
  normalized := lower(trim(regexp_replace(coalesce(new.text_body, ''), '[[:space:]]+', ' ', 'g')));

  if normalized in ('stop', 'stop all', 'unsubscribe', 'cancel', 'end', 'quit', 'hætta', 'haetta', 'stopp', 'afskrá', 'afskra') then
    next_status := 'opted_out';
  elsif normalized in ('start', 'subscribe', 'byrja', 'skrá', 'skra') then
    next_status := 'allowed';
  else
    return new;
  end if;

  insert into public.whatsapp_contact_preferences (
    recipient_phone,
    status,
    opted_out_at,
    opted_in_at,
    source_inbound_message_id,
    effective_at
  ) values (
    new.sender_phone,
    next_status,
    case when next_status = 'opted_out' then new.received_at else null end,
    case when next_status = 'allowed' then new.received_at else null end,
    new.id,
    new.received_at
  )
  on conflict (recipient_phone) do update
  set
    status = excluded.status,
    opted_out_at = case
      when excluded.status = 'opted_out' then excluded.opted_out_at
      else public.whatsapp_contact_preferences.opted_out_at
    end,
    opted_in_at = case
      when excluded.status = 'allowed' then excluded.opted_in_at
      else public.whatsapp_contact_preferences.opted_in_at
    end,
    source_inbound_message_id = excluded.source_inbound_message_id,
    effective_at = excluded.effective_at,
    updated_at = now()
  where excluded.effective_at >= public.whatsapp_contact_preferences.effective_at;

  return new;
end;
$$;
