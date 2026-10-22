import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createCheckoutService } from "@/features/payments/checkout-service";
import { createCheckoutStore } from "@/features/payments/checkout-store";
import { requireReconciliationConfig } from "@/features/payments/collection-config";
import { MyPosProvider } from "@/features/payments/mypos";
import { createPaymentStore } from "@/features/payments/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WORKER_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const headers = { "Cache-Control": "no-store" };
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  try {
    const config = requireReconciliationConfig();
    const result = await createCheckoutService(new MyPosProvider(config), createPaymentStore(), createCheckoutStore()).reconcile();
    if (result.submitted > 0) {
      revalidatePath("/");
      revalidatePath("/driver");
      revalidatePath("/jobs/[jobId]/history", "page");
    }
    return Response.json(result, { headers });
  } catch {
    return Response.json({ error: "payment_worker_unavailable" }, { status: 503, headers });
  }
}
