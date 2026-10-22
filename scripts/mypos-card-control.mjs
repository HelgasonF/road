import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";

// A separate action token lets privacy-restricted browsers submit the local
// test forms without relying solely on the optional Origin header.
export function authorizeCardTestAction(request, { origin, basePath, actionToken }) {
  const target = new URL(request.url, origin);
  assert.equal(request.method, "POST");
  assert.equal(request.headers.host, new URL(origin).host);
  assert.equal(target.origin, origin);
  assert(["initial_fee", "service", "finish"].some((action) => target.pathname === `${basePath}/${action}`));
  const supplied = Buffer.from(target.searchParams.get("action_token") ?? "");
  const expected = Buffer.from(actionToken);
  assert(supplied.length === expected.length && timingSafeEqual(supplied, expected));
  if (request.headers.origin && request.headers.origin !== "null") {
    assert.equal(request.headers.origin, origin);
  }
  return target.pathname;
}

export function canFinishCardTest({ attempts, payments, intakeSubmitted }) {
  if (attempts.length === 0) return payments.length === 0;
  return intakeSubmitted && payments.length === 2
    && ["initial_fee", "service"].every((purpose) => payments.some((payment) =>
      payment.purpose === purpose && payment.status === "paid"
      && payment.amountIsk === 35 && payment.currency === "ISK"));
}
