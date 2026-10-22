// @vitest-environment node
import { describe, expect, it } from "vitest";
import { authorizeCardTestAction, canFinishCardTest } from "./mypos-card-control.mjs";

const options = { origin: "http://127.0.0.1:37913", basePath: "/session/test-session", actionToken: "a".repeat(43) };
const request = (overrides = {}) => ({
  method: "POST", url: `${options.basePath}/service?action_token=${options.actionToken}`,
  headers: { host: "127.0.0.1:37913", origin: options.origin }, ...overrides,
});
const paid = (purpose) => ({ purpose, status: "paid", amountIsk: 35, currency: "ISK" });

describe("private card-test actions", () => {
  it("accepts each fixed action with its session token", () => {
    for (const action of ["initial_fee", "service", "finish"]) {
      expect(authorizeCardTestAction(request({ url: `${options.basePath}/${action}?action_token=${options.actionToken}` }), options))
        .toBe(`${options.basePath}/${action}`);
    }
  });
  it.each([undefined, "null"])("accepts an authenticated form when its browser sends Origin %s", (origin) => {
    expect(authorizeCardTestAction(request({ headers: { host: "127.0.0.1:37913", origin } }), options))
      .toBe(`${options.basePath}/service`);
  });
  it.each(["", "wrong-token", "b".repeat(43)])("rejects a missing or incorrect action token (%s)", (token) => {
    expect(() => authorizeCardTestAction(request({ url: `${options.basePath}/service?action_token=${token}` }), options)).toThrow();
  });
  it("rejects a foreign origin even with the correct token", () => {
    expect(() => authorizeCardTestAction(request({ headers: { host: "127.0.0.1:37913", origin: "https://foreign.example" } }), options)).toThrow();
  });
  it("rejects a forged host, another session, unknown action and GET", () => {
    for (const forged of [
      { headers: { host: "foreign.example", origin: options.origin } },
      { url: `/session/another/service?action_token=${options.actionToken}` },
      { url: `${options.basePath}/refund?action_token=${options.actionToken}` },
      { method: "GET" },
    ]) expect(() => authorizeCardTestAction(request(forged), options)).toThrow();
  });
});

describe("card-test completion", () => {
  it("allows stopping before any request or after both exact payments are verified", () => {
    expect(canFinishCardTest({ attempts: [], payments: [], intakeSubmitted: false })).toBe(true);
    expect(canFinishCardTest({ attempts: [{}, {}], payments: [paid("initial_fee"), paid("service")], intakeSubmitted: true })).toBe(true);
  });
  it("retains the session when only the first payment is paid", () => {
    expect(canFinishCardTest({ attempts: [{}], payments: [paid("initial_fee")], intakeSubmitted: true })).toBe(false);
  });
  it.each([
    [paid("initial_fee"), { ...paid("service"), status: "pending" }],
    [paid("initial_fee"), { ...paid("service"), amountIsk: 10490 }],
    [paid("initial_fee"), { ...paid("service"), currency: "EUR" }],
    [paid("initial_fee"), paid("initial_fee")],
  ])("rejects unconfirmed, mismatched or duplicate-purpose results", (...payments) => {
    expect(canFinishCardTest({ attempts: [{}, {}], payments, intakeSubmitted: true })).toBe(false);
  });
  it("requires automatic intake submission as well as both paid results", () => {
    expect(canFinishCardTest({ attempts: [{}, {}], payments: [paid("initial_fee"), paid("service")], intakeSubmitted: false })).toBe(false);
  });
});
