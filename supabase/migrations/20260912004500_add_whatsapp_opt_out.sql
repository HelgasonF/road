create table public.whatsapp_contact_preferences (
  recipient_phone text primary key
    check (recipient_phone ~ '^[1-9][0-9]{6,14}$'),
  status text not null
    check (status in ('allowed', 'opted_out')),
  opted_out_at timestamptz,
  opted_in_at timestamptz,
  source_inbound_message_id uuid not null unique
    references public.whatsapp_inbound_messages (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_contact_preference_state_check check (
    (status = 'opted_out' and opted_out_at is not null)
    or (status = 'allowed' and opted_in_at is not null)
  )
);

comment on table public.whatsapp_contact_preferences is
  'Latest explicit WhatsApp STOP/START preference derived from a signed inbound message.';

alter table public.whatsapp_contact_preferences enable row level security;

revoke all on table public.whatsapp_contact_preferences from public, anon, authenticated;
grant select on table public.whatsapp_contact_preferences to authenticated;
grant select, insert, update on table public.whatsapp_contact_preferences to service_role;

create policy "Staff can read WhatsApp contact preferences"
on public.whatsapp_contact_preferences
for select to authenticated
using ((select public.is_staff()));

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
    source_inbound_message_id
  ) values (
    new.sender_phone,
    next_status,
    case when next_status = 'opted_out' then new.received_at else null end,
    case when next_status = 'allowed' then new.received_at else null end,
    new.id
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
    updated_at = now();

  return new;
end;
$$;

create trigger apply_whatsapp_contact_preference_after_insert
after insert on public.whatsapp_inbound_messages
for each row execute function public.apply_whatsapp_contact_preference();

create or replace function public.prevent_opted_out_whatsapp_send()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state in ('queued', 'sending')
    and exists (
      select 1
      from public.whatsapp_contact_preferences preference
      where preference.recipient_phone = new.recipient_phone
        and preference.status = 'opted_out'
    )
  then
    raise exception 'Recipient has opted out of WhatsApp messages' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_opted_out_whatsapp_send_before_write
before insert or update on public.whatsapp_outbound_messages
for each row execute function public.prevent_opted_out_whatsapp_send();

revoke all on function public.apply_whatsapp_contact_preference() from public, anon, authenticated;
revoke all on function public.prevent_opted_out_whatsapp_send() from public, anon, authenticated;
