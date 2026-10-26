// @vitest-environment node
// Explicit opt-in: creates two UNPAID merchant test links, with no card or SMS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MyPosProvider } from "../src/features/payments/mypos";
import { parseMyPosConfig } from "../src/features/payments/mypos-config";

vi.mock("server-only", () => ({}));
const enabled = process.env.MYPOS_NAME_CHECK_APPROVAL === "unpaid-links-only" && Boolean(process.env.MYPOS_REST_CREDENTIAL_FILE);

describe.skipIf(!enabled)("myPOS Icelandic-name unpaid creation check", () => {
  it("accepts the adapted Icelandic name with both en and is and leaves both requests unpaid", async () => {
    const filename = await realpath(process.env.MYPOS_REST_CREDENTIAL_FILE);
    const info = await stat(filename);
    assert(!filename.startsWith(resolve(process.cwd()) + sep) && info.isFile() && (info.mode & 0o077) === 0 && info.uid === process.getuid());
    let credentials;
    try { credentials = JSON.parse(await readFile(filename, "utf8")); }
    catch { throw new Error("Private merchant credentials could not be parsed"); }
    const config = parseMyPosConfig({ ...credentials, livePaymentsEnabled: true });
    assert.equal(config.environment, "production");
    const ledgerFile = resolve(dirname(filename), `name-check-${randomUUID()}.json`);
    const ledger = { purpose: "Two unpaid synthetic name checks; no card, SMS or application database writes", attempts: [] };
    await writeFile(ledgerFile, JSON.stringify(ledger, null, 2), { mode: 0o600, flag: "wx" });
    let creates = 0;
    const provider = new MyPosProvider(config, async (url, init) => {
      const target = String(url);
      const method = init?.method ?? "GET";
      const allowedRead = method === "GET" && /^https:\/\/transactions-api\.mypos\.com\/v1\.1\/online-payments\/(settlement-data|languages|payment-request\/[A-Za-z0-9_-]+)$/.test(target);
      const oauth = method === "POST" && target === "https://auth-api.mypos.com/oauth/token";
      const create = method === "POST" && target === "https://transactions-api.mypos.com/v1.1/online-payments/payment-request";
      assert(allowedRead || oauth || create, "Unexpected provider operation refused");
      if (create) {
        assert(++creates <= 2, "Only two unpaid links are permitted");
        const body = JSON.parse(init.body);
        assert.equal(body.amount, 10490);
        assert.equal(body.currency, "ISK");
        assert.equal(body.client_name, "Thordur Aegir Gudjonsson");
        assert(["en", "is"].includes(body.payment_request_lang));
        assert(!("notify_gsm" in body));
      }
      return fetch(url, init);
    });
    for (const language of ["en", "is"]) {
      const attempt = { language, reference: `IRA-NAMECHECK-${randomUUID()}` };
      ledger.attempts.push(attempt);
      await writeFile(ledgerFile, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      const receipt = await provider.create({ amountIsk: 10490, customerName: "Þórður Ægir Guðjónsson", language, reference: attempt.reference });
      Object.assign(attempt, receipt);
      await writeFile(ledgerFile, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      const details = await provider.get(receipt.code);
      expect(details).toMatchObject({ amountIsk: 10490, reference: attempt.reference, status: "pending" });
      attempt.status = details.status;
      await writeFile(ledgerFile, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      console.info("Unpaid myPOS name check:", { language, amountIsk: 10490, status: details.status });
    }
    expect(creates).toBe(2);
  }, 45_000);
});
