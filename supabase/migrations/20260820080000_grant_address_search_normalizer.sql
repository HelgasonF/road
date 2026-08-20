-- The staff search RPC invokes this pure text normalizer as the caller.
-- It exposes no table data, but authenticated callers need EXECUTE permission.
grant execute on function public.normalize_icelandic_search(text) to authenticated;
