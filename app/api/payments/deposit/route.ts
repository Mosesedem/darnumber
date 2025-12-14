import { NextRequest } from "next/server";
import { json } from "@/lib/server/utils/response";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return json({ ok: false, message: "This endpoint has been removed. Use /api/payments/initialize instead." }, { status: 410 })
}
