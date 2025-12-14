import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { PaymentService } from "@/lib/server/services/payment.service";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { reference: string } }
) {
  try {
    const session = await requireAuth();
    const sp = new URL(req.url).searchParams;
    const provider = sp.get("provider");
    if (!provider) return error("provider required", 400);
    const svc = new PaymentService();
    const data = await svc.verifyPayment({
      userId: session.user.id,
      reference: params.reference,
      provider: provider as any,
    });
    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return error(msg, 400);
  }
}
