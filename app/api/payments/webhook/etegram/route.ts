import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { PaymentService } from "@/lib/server/services/payment.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const svc = new PaymentService();
    const result = await svc.handleEtegramWebhook(payload);
    if (!result.ok) return error("Invalid or unsuccessful event", 400);
    return json({ ok: true });
  } catch {
    return error("Invalid payload", 400);
  }
}
