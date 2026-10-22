// @vitest-environment node
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { customerIntakeSchema } from "../src/features/customer-intake/schemas";
import { createCheckoutService } from "../src/features/payments/checkout-service";
import { createCheckoutStore } from "../src/features/payments/checkout-store";
import { createPaymentStore } from "../src/features/payments/store";
import { MyPosProvider } from "../src/features/payments/mypos";
vi.mock("server-only", () => ({}));
const connection = vi.hoisted(() => ({ admin: undefined }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => {
        assert(connection.admin, "The isolated API must be configured before storage access");
        return connection.admin;
    } }));
const databaseUrl = process.env.MYPOS_TEST_DATABASE_URL;
const restUrl = process.env.MYPOS_TEST_REST_URL;
const serviceKey = process.env.MYPOS_TEST_REST_KEY;
const anonKey = process.env.MYPOS_TEST_ANON_KEY;
const staffId = "00000000-0000-4000-8000-000000000001";
describe.skipIf(!databaseUrl || !restUrl || !serviceKey || !anonKey)("payment system with real PostgreSQL, PostgREST and an HTTP simulator", () => {
    let db, server, simulatorUrl;
    let jobId, token, tokenHash, mode;
    const payments = new Map();
    const calls = [];
    let sequence = 0;
    const details = {
        customerName: "System Test Customer", customerPhone: "+3545550101", vehicleRegistration: "AB123",
        vehicleMake: "Ford", rentalCompany: "Test Rental", peopleCount: 2, requiredCapability: "jump_start",
        latitude: 64.14, longitude: -21.9, locationLabel: "Reykjavík", locationSource: "map_pin",
        customerNotes: "Battery needs assistance; this is a disposable test.",
    };
    const creates = () => calls.filter((call) => call.method === "POST" && call.path.endsWith("/payment-request")).length;
    const apiFetch = async (input, init) => {
        const url = new URL(String(input));
        assert(["sandbox-auth-api.mypos.com", "sandbox-transactions-api.mypos.com"].includes(url.hostname), "Simulator refuses production or unknown provider hosts");
        return fetch(`${simulatorUrl}${url.pathname}`, init);
    };
    const databaseFetch = async (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.origin, restUrl);
        assert(url.pathname.startsWith("/rest/v1/"));
        url.pathname = url.pathname.slice("/rest/v1".length);
        return fetch(url, init);
    };
    const service = () => createCheckoutService(new MyPosProvider({
        environment: "sandbox", clientId: "system-test-merchant", clientSecret: "system-test-secret", livePaymentsEnabled: false,
    }, apiFetch), createPaymentStore(), createCheckoutStore());
    const start = () => service().startInitial({ tokenHash, language: "is", amountIsk: 10490,
        details: Object.fromEntries(Object.entries(customerIntakeSchema.parse({ ...details, token })).filter(([key]) => key !== "token")),
    });
    const pending = async () => (await db.query("select intake_pending from public.jobs where id=$1", [jobId])).rows[0].intake_pending;
    const due = () => db.query("update public.job_payment_requests set next_check_at=now()-interval '1 second' where job_id=$1", [jobId]);
    const markRemote = (code, status) => {
        assert(code && payments.has(code));
        payments.get(code).status = status;
    };
    const serviceInput = (amountIsk = 27000) => ({
        jobId, amountIsk, description: "Jump-start assistance at Reykjavík", customerName: details.customerName,
        createdBy: staffId, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    beforeAll(async () => {
        const url = new URL(databaseUrl);
        assert(["127.0.0.1", "localhost"].includes(url.hostname) && /^\/road_mypos_test_[a-z0-9_]+$/.test(url.pathname));
        assert(["127.0.0.1", "localhost"].includes(new URL(restUrl).hostname));
        assert.equal(JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString()).iss, "road-isolated-test");
        db = new pg.Client({ connectionString: databaseUrl });
        await db.connect();
        connection.admin = createClient(restUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: databaseFetch },
        });
        server = createServer(async (request, response) => {
            const path = new URL(request.url, "http://localhost").pathname;
            const method = request.method ?? "GET";
            calls.push({ method, path });
            const send = (body, status = 200) => {
                response.writeHead(status, { "Content-Type": "application/json" });
                response.end(JSON.stringify(body));
            };
            try {
                if (path === "/oauth/token" && method === "POST") {
                    const chunks = [];
                    for await (const chunk of request)
                        chunks.push(chunk);
                    assert.equal(Buffer.concat(chunks).toString(), "grant_type=client_credentials");
                    assert.equal(request.headers.authorization, `Basic ${Buffer.from("system-test-merchant:system-test-secret").toString("base64")}`);
                    send({ access_token: "local-simulator-token", expires_in: "3600" });
                    return;
                }
                assert.equal(request.headers.authorization, "Bearer local-simulator-token");
                assert.equal(request.headers["api-key"], "system-test-merchant");
                assert.match(String(request.headers["x-request-id"]), /^[0-9a-f-]{36}$/);
                if (path.endsWith("/settlement-data")) {
                    send([{ settlement_currency: "ISK", account: { account_number: "SIMULATED-ACCOUNT", is_reserve: false } }]);
                    return;
                }
                if (path.endsWith("/languages")) {
                    send([{ code: "is" }, { code: "en" }]);
                    return;
                }
                if (path === "/v1.1/online-payments/payment-request" && method === "POST") {
                    if (mode === "deny_create") {
                        send({ error: "simulated permission failure" }, 403);
                        return;
                    }
                    const chunks = [];
                    for await (const chunk of request)
                        chunks.push(chunk);
                    const body = JSON.parse(Buffer.concat(chunks).toString());
                    assert.equal(body.currency, "ISK");
                    assert.equal(body.qr_generated, false);
                    assert.equal(body.client_name, details.customerName);
                    const code = `SYSTEM${++sequence}`;
                    payments.set(code, { code, amount: body.amount, currency: body.currency,
                        booking_text: body.booking_text, status: 1, qr_generated: false });
                    if (mode === "uncertain_create") {
                        send({ error: "simulated lost creation receipt" }, 503);
                        return;
                    }
                    send({ code, payment_request_url: `https://demo.mypos.eu/pr/${code}` });
                    return;
                }
                if (path.startsWith("/v1.1/online-payments/payment-request/") && method === "GET") {
                    if (mode === "deny_read") {
                        send({ error: "simulated permission failure" }, 403);
                        return;
                    }
                    const payment = payments.get(path.split("/").at(-1));
                    assert(payment);
                    send({ ...payment, ...(mode === "wrong_amount" ? { amount: payment.amount + 1 } : {}),
                        ...(mode === "wrong_currency" ? { currency: "EUR" } : {}),
                        ...(mode === "wrong_reference" ? { booking_text: "another-job" } : {}) });
                    return;
                }
                send({ error: "simulator route unavailable" }, 404);
            }
            catch {
                send({ error: "simulator contract assertion failed" }, 500);
            }
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        simulatorUrl = `http://127.0.0.1:${server.address().port}`;
    });
    beforeEach(async () => {
        mode = "ok";
        calls.length = 0;
        payments.clear();
        jobId = randomUUID();
        token = randomBytes(32).toString("base64url");
        tokenHash = createHash("sha256").update(token).digest("hex");
        await db.query("insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,intake_pending,created_by) values($1,'Pending Customer','+3545550101',64.95,-18.7,null,'manual',true,$2)", [jobId, staffId]);
        await db.query("insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by) values($1,$2,now()+interval '1 hour',$3)", [jobId, tokenHash, staffId]);
    });
    afterEach(async () => { if (jobId)
        await db.query("delete from public.jobs where id=$1", [jobId]); });
    afterAll(async () => {
        connection.admin = undefined;
        if (server)
            await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        if (db)
            await db.end();
    });
    it("collects the fixed fee, submits the frozen form without a browser, then collects an independent manual amount", async () => {
        const initial = await start();
        expect(initial).toMatchObject({ amountIsk: 10490, currency: "ISK", status: "pending" });
        expect(await pending()).toBe(true);
        const draft = (await db.query("select details from public.customer_payment_intakes where job_id=$1", [jobId])).rows[0].details;
        expect(draft).toEqual(details);
        expect(draft).not.toHaveProperty("token");
        expect(await service().reconcile()).toMatchObject({ submitted: 0, verified: 1 });
        expect(await pending()).toBe(true);
        markRemote(initial.providerCode, 4);
        await due();
        expect(await service().reconcile()).toMatchObject({ submitted: 1, failed: 0 });
        const job = (await db.query("select customer_name,customer_notes,intake_pending,status from public.jobs where id=$1", [jobId])).rows[0];
        expect(job).toMatchObject({ customer_name: details.customerName, customer_notes: details.customerNotes, intake_pending: false, status: "new" });
        expect(await service().reconcile()).toMatchObject({ submitted: 0, verified: 0 });
        const second = await service().startService(serviceInput());
        expect(second).toMatchObject({ amountIsk: 27000, purpose: "service", currency: "ISK", status: "pending" });
        markRemote(second.providerCode, 4);
        expect(await service().reconcile()).toMatchObject({ submitted: 0, verified: 1 });
        const rows = (await db.query("select purpose,amount_isk,status from public.job_payment_requests where job_id=$1 order by purpose", [jobId])).rows;
        expect(rows).toEqual([{ purpose: "initial_fee", amount_isk: 10490, status: "paid" }, { purpose: "service", amount_isk: 27000, status: "paid" }]);
        const billing = (await db.query("select receivable_status,payable_status from public.job_billing where job_id=$1", [jobId])).rows[0];
        expect(billing.receivable_status).not.toBe("paid");
        expect(billing.payable_status).not.toBe("paid");
        expect(creates()).toBe(2);
    });
    it("reuses one remotely created request across concurrent and repeated form checkouts", async () => {
        const results = await Promise.allSettled([start(), start()]);
        expect(results.some((result) => result.status === "fulfilled")).toBe(true);
        const repeated = await start();
        expect(repeated.status).toBe("pending");
        expect(creates()).toBe(1);
        expect((await db.query("select count(*)::int as count from public.customer_payment_intakes where job_id=$1", [jobId])).rows[0].count).toBe(1);
    });
    it.each([1, 2, 3, 5, 6, 99])("keeps the form unsubmitted for provider status %i", async (status) => {
        const request = await start();
        markRemote(request.providerCode, status);
        expect(await service().reconcile()).toMatchObject({ submitted: 0, failed: 0 });
        expect(await pending()).toBe(true);
        expect((await db.query("select submitted_at from public.customer_intake_links where job_id=$1", [jobId])).rows[0].submitted_at).toBeNull();
    });
    it.each(["wrong_amount", "wrong_currency", "wrong_reference"])("rejects a Paid response with %s", async (failure) => {
        const request = await start();
        markRemote(request.providerCode, 4);
        mode = failure;
        expect(await service().reconcile()).toMatchObject({ submitted: 0, failed: 1 });
        expect(await pending()).toBe(true);
        expect((await createPaymentStore().get(request.id)).status).toBe("pending");
    });
    it.each(["uncertain_create", "deny_create"])("retains the draft and reservation after %s and never retries creation", async (failure) => {
        mode = failure;
        await expect(start()).rejects.toThrow();
        mode = "ok";
        await expect(start()).rejects.toMatchObject({ code: "payment_creation_unresolved" });
        expect(creates()).toBe(1);
        expect(await pending()).toBe(true);
        expect((await db.query("select count(*)::int as count from public.customer_payment_intakes where job_id=$1", [jobId])).rows[0].count).toBe(1);
    });
    it("recovers after a provider read outage without requiring a customer return", async () => {
        const request = await start();
        markRemote(request.providerCode, 4);
        mode = "deny_read";
        expect(await service().reconcile()).toMatchObject({ submitted: 0, failed: 1 });
        expect(await pending()).toBe(true);
        mode = "ok";
        await due();
        expect(await service().reconcile()).toMatchObject({ submitted: 1, failed: 0 });
        expect(creates()).toBe(1);
    });
    it("lets concurrent workers finalize a paid form exactly once", async () => {
        const request = await start();
        markRemote(request.providerCode, 4);
        const results = await Promise.all([service().reconcile(), service().reconcile()]);
        expect(results.reduce((sum, result) => sum + result.submitted, 0)).toBe(1);
        expect(results.reduce((sum, result) => sum + result.verified, 0)).toBe(1);
        expect(await pending()).toBe(false);
    });
    it("recovers a verified Paid draft after a worker dies before finalization, even after link expiry", async () => {
        const request = await start();
        const remote = payments.get(request.providerCode);
        await createPaymentStore().record(request.id, { code: remote.code, amountIsk: 10490, currency: "ISK", reference: remote.booking_text, status: "paid", providerStatus: "4" }, new Date().toISOString());
        await db.query("update public.customer_intake_links set created_at=now()-interval '2 hours',expires_at=now()-interval '1 second' where job_id=$1", [jobId]);
        const reads = calls.length;
        expect(await service().reconcile()).toMatchObject({ submitted: 1 });
        expect(calls.length).toBe(reads);
        expect(await pending()).toBe(false);
    });
    it("flags a revoked paid draft for staff review without overwriting the job", async () => {
        const request = await start();
        markRemote(request.providerCode, 4);
        await db.query("update public.customer_intake_links set revoked_at=now() where job_id=$1", [jobId]);
        expect(await service().reconcile()).toMatchObject({ submitted: 0, reviewRequired: 1 });
        expect(await pending()).toBe(true);
        expect((await createPaymentStore().get(request.id)).status).toBe("paid");
    });
    it("rotates second-payment summary links while preserving the original amount and single request", async () => {
        await db.query("update public.jobs set intake_pending=false,customer_name=$2 where id=$1", [jobId, details.customerName]);
        const input = serviceInput();
        const first = await service().startService(input);
        const next = serviceInput();
        const repeated = await service().startService(next);
        expect(repeated.id).toBe(first.id);
        expect(creates()).toBe(1);
        const page = (await db.query("select token_hash,description from public.job_payment_pages where payment_request_id=$1", [first.id])).rows[0];
        expect(page).toMatchObject({ token_hash: next.tokenHash, description: input.description });
        await expect(service().startService(serviceInput(30000))).rejects.toThrow();
        expect(creates()).toBe(1);
        expect((await db.query("select token_hash from public.job_payment_pages where payment_request_id=$1", [first.id])).rows[0].token_hash).toBe(next.tokenHash);
    });
    it("refuses an invalid customer capability before creating a payment or draft", async () => {
        tokenHash = "f".repeat(64);
        await expect(start()).rejects.toMatchObject({ code: "payment_link_unavailable" });
        expect(creates()).toBe(0);
        expect((await db.query("select count(*)::int as count from public.job_payment_requests where job_id=$1", [jobId])).rows[0].count).toBe(0);
    });
    it("blocks anonymous reads and mutations at the real database API boundary", async () => {
        const request = await start();
        const anonymous = createClient(restUrl, anonKey, { auth: { persistSession: false }, global: { fetch: databaseFetch } });
        for (const table of ["customer_payment_intakes", "job_payment_pages", "job_payment_requests"]) {
            const result = await anonymous.from(table).select("*");
            expect(result.error !== null || result.data?.length === 0).toBe(true);
        }
        const result = await anonymous.rpc("finalize_paid_customer_intake", { p_payment_id: request.id });
        expect(result.error).not.toBeNull();
        expect(await pending()).toBe(true);
    });
});
