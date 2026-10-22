// @vitest-environment node
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MyPosProvider } from "../src/features/payments/mypos";
import { parseMyPosConfig } from "../src/features/payments/mypos-config";

vi.mock("server-only", () => ({}));

const credentialFile = process.env.MYPOS_REST_CREDENTIAL_FILE;

describe.skipIf(!credentialFile)("myPOS REST read-only merchant account check", () => {
  it("checks authentication, settlement eligibility and languages without creating payments", async () => {
    let credentials;
    try {
      const filename = await realpath(credentialFile);
      const project = resolve(process.cwd());
      const info = await stat(filename);
      if (filename === project || filename.startsWith(project + sep) || !info.isFile()
        || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) {
        throw new Error("Invalid credential file location or permissions");
      }
      credentials = JSON.parse(await readFile(filename, "utf8"));
    } catch {
      // JSON parser errors can include file contents. Never report their cause.
      throw new Error("Use an owner-only credential JSON file outside the repository");
    }
    const config = parseMyPosConfig({
      environment: credentials.environment, clientId: credentials.clientId,
      clientSecret: credentials.clientSecret, livePaymentsEnabled: false,
    });
    const hosts = config.environment === "sandbox"
      ? { token: "https://sandbox-auth-api.mypos.com/oauth/token", api: "https://sandbox-transactions-api.mypos.com/v1.1" }
      : { token: "https://auth-api.mypos.com/oauth/token", api: "https://transactions-api.mypos.com/v1.1" };
    const reads = ["/online-payments/settlement-data", "/online-payments/languages"].map((path) => hosts.api + path);
    const readOnlyFetch = async (url, init) => {
      const method = init?.method ?? "GET";
      if (!((method === "POST" && url === hosts.token) || (method === "GET" && reads.includes(String(url))))) {
        throw new Error("The account check refuses all payment creation and other operations");
      }
      return fetch(url, init);
    };
    const capabilities = await new MyPosProvider(config, readOnlyFetch).inspectAccount();
    console.info("myPOS REST account check:", {
      environment: config.environment, authenticationVerified: true,
      eligibleCurrencies: capabilities.currencies, supportedLanguages: capabilities.languages,
      iskSupported: capabilities.iskSupported, productionWritesEnabled: false,
    });
    expect(capabilities.iskSupported, "This merchant needs an eligible ISK settlement account before collection can be enabled").toBe(true);
  }, 45_000);
});
