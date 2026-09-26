export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

// Environment values pasted into a dashboard can carry a trailing newline.
// fetch trims header values, but the Realtime WebSocket sends the key in its
// URL, where the newline makes every connection fail authentication.
// Each variable is still read as a literal `process.env.NAME` so Next.js can
// inline the public ones into the browser bundle.
function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function supabaseUrl() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function supabasePublishableKey() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function supabaseSecretKey() {
  return clean(process.env.SUPABASE_SECRET_KEY) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function getSupabaseConfig() {
  const url = supabaseUrl();
  const publishableKey = supabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, publishableKey };
}

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl() && supabaseSecretKey());
}

export function getSupabaseAdminConfig() {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();

  if (!url || !secretKey) {
    throw new Error("Supabase server-side admin environment variables are not configured.");
  }

  return { url, secretKey };
}
