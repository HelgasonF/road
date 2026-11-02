import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in integration check against an explicitly isolated local test database.
// Never point this at the app's live/local working database.
const connectionString = process.env.MYPOS_TEST_DATABASE_URL;
const clients = [];
const jobId = "aa000000-0000-4000-8000-000000000020";
const checkoutJobId = "aa000000-0000-4000-8000-000000000021";
const staffId = "00000000-0000-4000-8000-000000000001";
const replacementJobIds = [];

describe.skipIf(!connectionString)("PostgreSQL payment reservation concurrency", () => {
  beforeAll(async () => {
    const url = new URL(connectionString);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/road_mypos_test_[a-z0-9_]+$/.test(url.pathname)) {
      throw new Error("Use an isolated local road_mypos_test_* database");
    }
    for (let i = 0; i < 3; i++) {
      const client = new pg.Client({ connectionString });
      await client.connect();
      clients.push(client);
    }
    await clients[0].query("insert into public.jobs(id, customer_name, customer_phone, latitude, longitude, location_label, location_source, created_by) values ($1, 'Concurrency Test', '+3545550101', 64.14, -21.9, 'Reykjavík', 'manual', $2)", [jobId, staffId]);
    await clients[0].query("insert into public.jobs(id, customer_name, customer_phone, latitude, longitude, location_label, location_source, created_by) values ($1, 'Checkout Concurrency Test', '+3545550101', 64.14, -21.9, 'Reykjavík', 'manual', $2)", [checkoutJobId, staffId]);
    await clients[0].query("insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by) values($1,$2,now()+interval '1 hour',$3)", [checkoutJobId, "b".repeat(64), staffId]);
  });

  afterAll(async () => {
    try {
      // Delete only the exact disposable fixture created by this test.
      if (clients[0]) await clients[0].query("delete from public.jobs where id = any($1::uuid[])", [[jobId, checkoutJobId, ...replacementJobIds]]);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("lets one of two concurrent creators claim each purpose", async () => {
    for (const purpose of ["initial_fee", "service"]) {
      const sql = "select public.reserve_job_payment_request($1, $2, 'sandbox', 'concurrency-merchant', 'rest_v1_1', 5000, $3) as result";
      const responses = await Promise.all(clients.slice(1).map((client) => client.query(sql, [jobId, purpose, staffId])));
      expect(responses.map((result) => result.rows[0].result.claimed).sort()).toEqual([false, true]);
      expect(responses[0].rows[0].result.request.id).toBe(responses[1].rows[0].result.request.id);
    }
    const count = await clients[0].query("select count(*)::integer as count from public.job_payment_requests where job_id = $1", [jobId]);
    expect(count.rows[0].count).toBe(2);
  });
  it("atomically freezes one draft and claims one initial request across concurrent form checkouts", async () => {
    const details = { customerName: "Checkout Customer", customerPhone: "+3545550101", vehicleRegistration: "AB123", vehicleMake: "Ford", rentalCompany: null, peopleCount: 1, requiredCapability: "jump_start", latitude: 64.14, longitude: -21.9, locationLabel: "Reykjavík", locationSource: "map_pin", customerNotes: "Battery needs assistance." };
    const sql = "select public.prepare_customer_payment_intake($1,$2::jsonb,'en','sandbox','concurrency-merchant','rest_v1_1',5000) as result";
    const results = await Promise.all(clients.slice(1).map((client) => client.query(sql, ["b".repeat(64), JSON.stringify(details)])));
    expect(results.map((result) => result.rows[0].result.claimed).sort()).toEqual([false, true]);
    expect(results[0].rows[0].result.request.id).toBe(results[1].rows[0].result.request.id);
    const count = await clients[0].query("select count(*)::integer as count from public.customer_payment_intakes where job_id = $1", [checkoutJobId]);
    expect(count.rows[0].count).toBe(1);
  });
  it("lets exactly one concurrent retry reclaim a definitively failed attempt", async () => {
    const first = (await clients[0].query("select id,reference from public.job_payment_requests where job_id=$1 and purpose='initial_fee'", [jobId])).rows[0];
    await clients[0].query("select public.finish_job_payment_creation_v2($1,$2,null,null,'creation_failed','payment_provider_rejected','{\"httpStatus\":400,\"providerCode\":\"4\"}')", [first.id,first.reference]);
    const sql = "select public.reserve_job_payment_request($1,'initial_fee','sandbox','concurrency-merchant','rest_v1_1',5000,$2) as result";
    const results = await Promise.all(clients.slice(1).map((client) => client.query(sql,[jobId,staffId])));
    expect(results.map((result) => result.rows[0].result.claimed).sort()).toEqual([false,true]);
    expect(results[0].rows[0].result.request.reference).toBe(results[1].rows[0].result.request.reference);
    expect(results[0].rows[0].result.request.reference).not.toBe(first.reference);
    expect(results[0].rows[0].result.request.id).toBe(first.id);
  });
  it.each(["payment-first", "replacement-first"])("serializes a Paid observation and replacement without losing payment (%s)", async (order) => {
    const ownedJobId = randomUUID();
    replacementJobIds.push(ownedJobId);
    await clients[0].query("insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,created_by) values($1,'Replacement race','+3545550101',64.14,-21.9,'Pickup','manual',$2)",[ownedJobId,staffId]);
    const old = (await clients[0].query("select public.prepare_service_payment_page($1,27000,'Original towing','sandbox','concurrency-merchant','rest_v1_1',$2,$3,now()+interval '1 hour') as result",[ownedJobId,staffId,randomUUID().replaceAll('-','').repeat(2)])).rows[0].result.request;
    const code = `BRACE${randomUUID().replaceAll('-','')}`;
    await clients[0].query("select public.finish_job_payment_creation($1,$2,$3,'pending',null)",[old.id,code,`https://demo.mypos.eu/pr/${code}`]);
    const observation = "select public.record_job_payment_status($1,$2,27000,'ISK',$3,$4,$5,clock_timestamp())";
    await clients[0].query(observation,[old.id,code,old.reference,'1','pending']);
    const replaceSql = "select public.replace_service_payment_page($1,$2,32000,'Revised towing','sandbox','concurrency-merchant','rest_v1_1',$3,$4,now()+interval '1 hour') as result";
    const parameters = [ownedJobId,old.id,staffId,randomUUID().replaceAll('-','').repeat(2)];
    const first = clients[1], second = clients[2];
    await first.query('begin');
    try {
      if(order === 'payment-first') {
        await first.query(observation,[old.id,code,old.reference,'4','paid']);
        const competing = second.query(replaceSql,parameters).then(result=>({result}),error=>({error}));
        await first.query('commit');
        expect((await competing).error?.message).toBe('payment_already_paid');
      } else {
        const successor = (await first.query(replaceSql,parameters)).rows[0].result.request;
        const competing = second.query(observation,[old.id,code,old.reference,'4','paid']);
        await first.query('commit');
        await competing;
        const page = (await clients[0].query('select expires_at <= clock_timestamp() as expired from public.job_payment_pages where payment_request_id=$1',[successor.id])).rows[0];
        expect(page.expired).toBe(true);
      }
    } catch(error) { await first.query('rollback'); throw error; }
    expect((await clients[0].query('select status from public.job_payment_requests where id=$1',[old.id])).rows[0].status).toBe('paid');
    expect((await clients[0].query("select count(*)::int as count from public.job_payment_requests where job_id=$1 and purpose='service' and superseded_at is null",[ownedJobId])).rows[0].count).toBe(1);
  });
});
