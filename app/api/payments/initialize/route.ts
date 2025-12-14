import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { PaymentService } from "@/lib/server/services/payment.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { amount, provider } = body || {};
    if (!amount || !provider) return error("amount and provider required", 400);
    const svc = new PaymentService();
    const data = await svc.initializePayment({
      userId: session.user.id,
      amount: Number(amount),
      provider,
    });
    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return error(msg, 400);
  }
}
