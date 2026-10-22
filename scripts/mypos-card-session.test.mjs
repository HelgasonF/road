// @vitest-environment node
// Explicit, interactive opt-in. The user pays on myPOS; this code never accepts
// card data. Ordinary tests cannot enable this session or production creation.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { authorizeCardTestAction, canFinishCardTest } from "./mypos-card-control.mjs";
import { MyPosProvider } from "../src/features/payments/mypos";
import { parseMyPosConfig, PaymentError } from "../src/features/payments/mypos-config";
import { createCheckoutService } from "../src/features/payments/checkout-service";
import { createCheckoutStore } from "../src/features/payments/checkout-store";
import { createPaymentStore } from "../src/features/payments/store";

vi.mock("server-only", () => ({}));
const connection = vi.hoisted(() => ({ admin: undefined }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => connection.admin }));
const enabled = process.env.MYPOS_CARD_SESSION_APPROVAL === "35-350-10";
const amountIsk = 35, totalCapIsk = 350, attemptCap = 10;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

describe.skipIf(!enabled)("user-controlled 35 ISK card acceptance session", () => {
  it("verifies the two independent payments through myPOS after the user completes checkout", async () => {
    const url = new URL(process.env.MYPOS_TEST_DATABASE_URL);
    assert(["127.0.0.1", "localhost"].includes(url.hostname) && /^\/road_mypos_test_system_\d+$/.test(url.pathname));
    const restUrl = process.env.MYPOS_TEST_REST_URL;
    assert.equal(new URL(restUrl).hostname, "127.0.0.1");
    assert.equal(JSON.parse(Buffer.from(process.env.MYPOS_TEST_REST_KEY.split(".")[1], "base64url").toString()).iss, "road-isolated-test");
    const filename = await realpath(process.env.MYPOS_REST_CREDENTIAL_FILE);
    assert(!filename.startsWith(resolve(process.cwd()) + sep));
    const info = await stat(filename);
    assert(info.isFile() && (info.mode & 0o077) === 0 && info.uid === process.getuid());
    let credentials;
    try { credentials = JSON.parse(await readFile(filename, "utf8")); }
    catch { throw new Error("Private credential JSON could not be parsed"); }
    const config = parseMyPosConfig({ ...credentials, livePaymentsEnabled: true });
    assert.equal(config.environment, "production");
    const db = new pg.Client({ connectionString: url.href });
    await db.connect();
    connection.admin = createClient(restUrl, process.env.MYPOS_TEST_REST_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const target = new URL(String(input));
        assert.equal(target.origin, restUrl); assert(target.pathname.startsWith("/rest/v1/"));
        target.pathname = target.pathname.slice("/rest/v1".length);
        return fetch(target, init);
      } },
    });
    const jobId = randomUUID(), tokenHash = randomBytes(32).toString("hex"), control = randomBytes(32).toString("base64url");
    const basePath = `/session/${control}`;
    const actionToken = randomBytes(32).toString("base64url");
    const actionPath = (action) => `${basePath}/${action}?action_token=${actionToken}`;
    const staffId = "00000000-0000-4000-8000-000000000001";
    const ledgerPath = resolve(dirname(filename), `card-test-${jobId}.json`);
    const ledger = { session: jobId, amountIsk, totalCapIsk, attemptCap, attempts: [], payments: [], intakeSubmitted: false,
      note: "Only two payment purposes are available (70 ISK total). Checkout/card attempts are performed by the user on myPOS. No card data is accepted or stored." };
    let saving = Promise.resolve();
    const persist = () => {
      const data = JSON.stringify(ledger, null, 2) + "\n";
      saving = saving.then(async () => {
        await writeFile(`${ledgerPath}.tmp`, data, { mode: 0o600 });
        await rename(`${ledgerPath}.tmp`, ledgerPath);
      });
      return saving;
    };
    await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await db.query("insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,intake_pending,created_by) values($1,'Card acceptance test','+3546597003',64.14,-21.9,'Reykjavík — test only','manual',true,$2)", [jobId, staffId]);
    await db.query("insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by) values($1,$2,now()+interval '2 hours',$3)", [jobId, tokenHash, staffId]);
    const provider = new MyPosProvider(config);
    const store = createPaymentStore();
    const service = createCheckoutService(provider, store, createCheckoutStore());
    let busy = false, checking = false, error = null, checkedAt = null;
    let endSession;
    const finished = new Promise((resolve) => { endSession = resolve; });
    const snapshot = async () => {
      const rows = await store.listForJob(jobId);
      ledger.payments = rows.map((row) => ({ id: row.id, purpose: row.purpose, amountIsk: row.amountIsk,
        currency: row.currency, reference: row.reference, providerCode: row.providerCode, status: row.status, paidAt: row.paidAt }));
      ledger.intakeSubmitted = !(await db.query("select intake_pending from public.jobs where id=$1", [jobId])).rows[0].intake_pending;
      await persist();
      return rows;
    };
    const check = async () => {
      if (checking || !ledger.attempts.length) return;
      checking = true;
      try {
        const result = await service.reconcile();
        checkedAt = new Date().toISOString();
        if (result.failed) error = "The myPOS status check needs retrying. Pending payments have not been confirmed.";
        else error = null;
        await snapshot();
        console.info("Card test API verification:", { ...result, intakeSubmitted: ledger.intakeSubmitted,
          payments: ledger.payments.map(({ purpose, amountIsk, status }) => ({ purpose, amountIsk, status })) });
      } catch { error = "Payment status is temporarily unavailable; no payment is assumed successful."; }
      finally { checking = false; }
    };
    const prepare = async (purpose) => {
      assert(!busy, "Another request is being prepared"); busy = true;
      try {
        const rows = await snapshot();
        if (rows.some((row) => row.purpose === purpose)) return;
        assert(!ledger.attempts.some((attempt) => attempt.purpose === purpose), "An earlier attempt needs investigation; automatic replacement is refused");
        assert(ledger.attempts.length < attemptCap && (ledger.attempts.length + 1) * amountIsk <= totalCapIsk);
        if (purpose === "service") assert(ledger.intakeSubmitted && rows.some((row) => row.purpose === "initial_fee" && row.status === "paid"));
        ledger.attempts.push({ purpose, amountIsk, startedAt: new Date().toISOString() });
        await persist();
        if (purpose === "initial_fee") {
          await service.startInitial({ tokenHash, amountIsk, language: "en", details: {
            customerName: "Freyr Helgason", customerPhone: "+3546597003", vehicleRegistration: "TEST35", vehicleMake: "Ford",
            rentalCompany: null, peopleCount: 1, requiredCapability: "jump_start", latitude: 64.14, longitude: -21.9,
            locationLabel: "Reykjavík — payment test only", locationSource: "map_pin", customerNotes: "Controlled payment acceptance test. Do not dispatch a driver.",
          } });
        } else {
          await service.startService({ jobId, amountIsk, customerName: "Freyr Helgason", createdBy: staffId,
            description: "Second payment — controlled 35 ISK test only", tokenHash: randomBytes(32).toString("hex"),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
        }
        error = null;
      } catch (failure) {
        error = failure instanceof PaymentError ? failure.code : "This request needs checking before another attempt.";
      } finally { await snapshot(); busy = false; }
    };
    const server = createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store"); response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Content-Type-Options", "nosniff");
      try {
        const path = new URL(request.url, "http://127.0.0.1").pathname;
        if (![basePath, `${basePath}/initial_fee`, `${basePath}/service`, `${basePath}/finish`].includes(path)) {
          response.writeHead(404); response.end("Unavailable"); return;
        }
        if (request.method === "POST") {
          try {
            authorizeCardTestAction(request, {
              origin: `http://127.0.0.1:${server.address().port}`, basePath, actionToken,
            });
          } catch {
            response.writeHead(403);
            response.end("Open the current test page and use its button. This action could not be verified; no replacement payment was created.");
            return;
          }
          // POST bodies are never read: there is no card-data or amount input.
          if (path === `${basePath}/finish`) {
            await snapshot();
            if (!canFinishCardTest(ledger)) {
              response.writeHead(409);
              response.end("The test remains open. Wait until both 35 ISK payments are confirmed before finishing.");
              return;
            }
            endSession();
          }
          else if (path !== basePath) await prepare(path.endsWith("/initial_fee") ? "initial_fee" : "service");
          response.writeHead(303, { Location: basePath }); response.end(); return;
        }
        assert.equal(request.method, "GET");
        const rows = await snapshot();
        const cards = ["initial_fee", "service"].map((purpose) => {
          const payment = rows.find((row) => row.purpose === purpose);
          const allowed = purpose === "initial_fee" || (ledger.intakeSubmitted
            && rows.some((row) => row.purpose === "initial_fee" && row.status === "paid"));
          const attempted = ledger.attempts.some((attempt) => attempt.purpose === purpose);
          const title = purpose === "initial_fee" ? "1. First payment" : "2. Separate service payment";
          const action = payment?.paymentUrl && ["pending", "seen", "failed", "unknown"].includes(payment.status)
            ? `<a target="_blank" rel="noreferrer" href="${escape(payment.paymentUrl)}">Open myPOS and pay 35 ISK</a>`
            : !attempted && allowed ? `<form method="post" action="${actionPath(purpose)}"><button>Prepare 35 ISK payment link</button></form>` : "";
          return `<section><h2>${title} · 35 ISK</h2><p>Status: <strong>${escape(payment?.status ?? (attempted ? "needs checking" : "not prepared"))}</strong></p>${action}</section>`;
        }).join("");
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>35 ISK controlled payment test</title><style>body{font:17px system-ui;max-width:650px;margin:36px auto;padding:20px;background:#f4f8f6;color:#123}section{background:white;padding:20px;margin:20px 0;border:1px solid #ccd}a,button{display:inline-block;padding:14px;background:#00675e;color:white;border:0;border-radius:6px;font:inherit}small{color:#456}</style><h1>35 ISK controlled payment test</h1><p>Two payments available: <strong>70 ISK total</strong>. Your overall limit is 10 attempts / 350 ISK. Normal customer pricing stays 10,490 ISK.</p><p>Enter your card only on myPOS. You can close checkout after paying. This page checks the API automatically about once a minute.</p>${cards}<p>Saved customer form submitted: <strong>${ledger.intakeSubmitted ? "Yes" : "Not yet"}</strong></p><small>Last API check: ${escape(checkedAt ?? "Awaiting first payment request")}</small>${error ? `<p role="alert">${escape(error)}</p>` : ""}<form method="post" action="${actionPath("finish")}"><p>Finish after both payments are confirmed, or stop before preparing any links.</p><button${canFinishCardTest(ledger) ? "" : " disabled"}>Finish test session</button></form></html>`);
      } catch { response.writeHead(503); response.end("The test state is temporarily unavailable. Refresh the test page; no replacement payment will be created automatically."); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = `http://127.0.0.1:${server.address().port}${basePath}`;
    console.info(`Controlled card test page: ${address}`);
    console.info(`Private transaction ledger: ${ledgerPath}`);
    console.info("No provider request has been created. The user prepares each 35 ISK link and enters/confirms the card directly on myPOS.");
    const timer = setInterval(() => { void check(); }, 60_000);
    try {
      await finished;
      await snapshot();
      if (ledger.attempts.length) {
        expect(ledger.payments).toHaveLength(2);
        expect(ledger.payments.every((payment) => payment.status === "paid" && payment.amountIsk === 35 && payment.currency === "ISK")).toBe(true);
        expect(ledger.intakeSubmitted).toBe(true);
      }
    } finally {
      clearInterval(timer);
      await new Promise((resolve) => server.close(resolve));
      await persist(); await db.end(); connection.admin = undefined;
    }
  }, 60 * 60 * 1000);
});
