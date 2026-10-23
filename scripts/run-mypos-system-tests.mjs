import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

// Normal runs never use merchant credentials, .env files or real payments.
// --live-card is a separate, explicitly approved interactive 35 ISK session.
// Clone schema only from the running local stack; own every resource we remove.
const project = resolve(import.meta.dirname, "..");
const liveCard = process.argv.includes("--live-card");
assert(!(liveCard && process.argv.includes("--full")), "Choose simulated tests or the interactive card session");
if (liveCard) assert(process.env.MYPOS_REST_CREDENTIAL_FILE, "The interactive card session requires the private merchant credential file");
const source = "supabase_db_Road";
const suffix = Date.now().toString();
const database = `road_mypos_test_system_${suffix}`;
const restContainer = `road-mypos-test-rest-${suffix}`;
const docker = (args, options = {}) => {
  try {
    return execFileSync("docker", args, { cwd: project, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
  } catch (error) {
    // Never serialize command arguments: local connection URIs/JWTs are private.
    const diagnostic = String(error.stderr ?? "").split("\n").find((line) => line.startsWith("ERROR:"));
    throw new Error(`Local Docker ${args[0]} failed${diagnostic ? `: ${diagnostic}` : ""}`);
  }
};
const inspect = (name) => JSON.parse(docker(["inspect", name]))[0];
const sql = (statement, db = database) => docker([
  "exec", "-i", source, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", db, "-At",
], { input: statement });
const workingState = () => sql(`select json_build_array(
  to_regclass('public.job_payment_requests')::text,
  to_regclass('public.customer_payment_intakes')::text,
  to_regclass('public.job_payment_pages')::text,
  (select count(*) from supabase_migrations.schema_migrations
    where version in ('20261020223002','20261021201000','20261023171927')),
  (select md5(string_agg(pg_get_functiondef(p.oid), '' order by p.proname))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('submit_customer_intake_v3','prepare_customer_payment_intake','search_iceland_addresses'))
)::text;`, "postgres").trim();

let created = false, started = false;
const before = workingState();
try {
  console.info("Creating a disposable local payment test database (schema only).");
  const schema = docker(["exec", source, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only"]);
  docker(["exec", source, "createdb", "-U", "postgres", database]);
  created = true;
  sql(schema);
  const referenceData = docker(["exec", source, "pg_dump", "-U", "postgres", "-d", "postgres", "--data-only", "--table=public.capabilities", "--column-inserts"]);
  sql(referenceData);
  // The bucket is configuration data created by an existing migration, not file
  // contents. A schema-only clone must explicitly restore that configuration.
  sql(`insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('job-photos','job-photos',false,10485760,
      array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
    on conflict(id) do nothing;`);
  for (const [table, migration] of [
    ["job_payment_requests", "20261020223002_add_mypos_payment_requests.sql"],
    ["customer_payment_intakes", "20261021201000_add_customer_payment_checkout.sql"],
  ]) {
    if (sql(`select to_regclass('public.${table}') is null;`).trim() === "t") {
      sql(readFileSync(resolve(project, "supabase/migrations", migration), "utf8"));
    }
  }
  sql(readFileSync(resolve(project, "supabase/migrations/20261023171927_support_typed_customer_locations.sql"), "utf8"));
  sql(readFileSync(resolve(project, "supabase/seed.sql"), "utf8"));

  const rest = inspect("supabase_rest_Road");
  const existingUri = rest.Config.Env.find((entry) => entry.startsWith("PGRST_DB_URI="));
  assert(existingUri, "The local PostgREST database connection must be configured");
  const restUri = new URL(existingUri.slice("PGRST_DB_URI=".length));
  assert.equal(restUri.pathname, "/postgres");
  assert.equal(restUri.hostname, source);
  restUri.pathname = `/${database}`;
  const network = Object.keys(rest.NetworkSettings.Networks)[0];
  const jwtSecret = randomBytes(32).toString("hex");
  const jwt = (role) => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ role, iss: "road-isolated-test", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    return `${header}.${payload}.${createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url")}`;
  };
  docker(["run", "--rm", "-d", "--name", restContainer, "--network", network,
    "-p", "127.0.0.1::3000", "-e", `PGRST_DB_URI=${restUri.href}`,
    "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_EXTRA_SEARCH_PATH=public,extensions",
    "-e", "PGRST_DB_ANON_ROLE=anon", "-e", "PGRST_DB_CONFIG=false",
    "-e", `PGRST_JWT_SECRET=${jwtSecret}`, rest.Config.Image,
  ]);
  started = true;
  const restPort = inspect(restContainer).NetworkSettings.Ports["3000/tcp"][0].HostPort;
  const restUrl = `http://127.0.0.1:${restPort}`;
  const serviceKey = jwt("service_role");
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(restUrl, { headers: { Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* The disposable API is still starting. */ }
    await setTimeout(200);
  }
  assert(ready, "The isolated PostgREST service did not become ready");

  const db = inspect(source);
  const password = db.Config.Env.find((entry) => entry.startsWith("POSTGRES_PASSWORD="))?.slice("POSTGRES_PASSWORD=".length);
  assert(password, "The local database password must be configured");
  const port = db.NetworkSettings.Ports["5432/tcp"][0].HostPort;
  const databaseUrl = new URL(`postgresql://postgres@127.0.0.1:${port}/${database}`);
  databaseUrl.password = password;
  const env = { ...process.env, MYPOS_CARD_SESSION_APPROVAL: "", MYPOS_REST_CREDENTIAL_FILE: "", MYPOS_REST_CLIENT_ID: "", MYPOS_REST_CLIENT_SECRET: "",
    MYPOS_LEGACY_ENABLED: "false", MYPOS_LIVE_PAYMENTS_ENABLED: "false", MYPOS_COLLECTION_ENABLED: "false",
    MYPOS_TEST_DATABASE_URL: databaseUrl.href,
    MYPOS_TEST_REST_URL: restUrl, MYPOS_TEST_REST_KEY: serviceKey, MYPOS_TEST_ANON_KEY: jwt("anon") };
  const full = process.argv.includes("--full");
  if (liveCard) {
    env.MYPOS_CARD_SESSION_APPROVAL = "35-350-10";
    env.MYPOS_REST_CREDENTIAL_FILE = process.env.MYPOS_REST_CREDENTIAL_FILE;
  }
  const args = [resolve(project, "node_modules/vitest/vitest.mjs"), "run",
    ...(liveCard ? ["scripts/mypos-card-session.test.mjs", "--reporter=verbose"]
      : full ? ["--coverage"] : ["scripts/mypos-system.test.mjs", "scripts/mypos-concurrency.test.mjs"]),
  ];
  console.info(liveCard ? "Starting the separate user-controlled 35 ISK checkout session. Normal customer collection remains disabled."
    : "Running application integration tests with a local HTTP payment simulator and real PostgreSQL/PostgREST.");
  execFileSync(process.execPath, args, { cwd: project, env, stdio: "inherit" });

  const tests = readdirSync(resolve(project, "supabase/tests")).filter((file) => file.endsWith(".sql")).sort();
  console.info("Running the complete SQL assertion suite in the disposable database.");
  let assertions = 0;
  for (const test of tests) {
    const tap = sql(readFileSync(resolve(project, "supabase/tests", test), "utf8"));
    assert(!/^not ok /m.test(tap), `${test} failed:\n${tap}`);
    const plan = [...tap.matchAll(/^1\.\.(\d+)$/gm)].at(-1);
    assert(plan && Number(plan[1]) > 0, `${test} did not produce a TAP plan`);
    assertions += Number(plan[1]);
    console.info(`${test}: ${plan[1]} assertions passed`);
  }
  console.info(`${assertions} SQL assertions passed in ${tests.length} files.`);
  assert.equal(workingState(), before, "Working payment schema or migration history changed");
  console.info("Verified: the working database payment schema and migration history are unchanged.");
} finally {
  if (started) docker(["stop", restContainer], { stdio: "ignore" });
  if (created) docker(["exec", source, "dropdb", "--force", "-U", "postgres", database], { stdio: "ignore" });
  console.info("Disposable payment test resources removed.");
}
