create or replace function public.claim_whatsapp_outbound_message(
  p_message_id uuid,
  p_payload_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.whatsapp_outbound_messages message
  set
    state = 'sending',
    attempt_count = message.attempt_count + 1,
    last_attempt_at = now(),
    failure_code = null,
    updated_at = now()
  where message.id = p_message_id
    and message.payload_sha256 = p_payload_sha256
    and (
      message.state = 'queued'
      or (
        message.state = 'failed'
        and message.meta_message_id is null
        and message.accepted_at is null
      )
    )
  returning message.id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_whatsapp_outbound_message(uuid, text)
from public, anon, authenticated;

grant execute on function public.claim_whatsapp_outbound_message(uuid, text)
to service_role;
