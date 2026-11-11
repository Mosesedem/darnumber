import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { OrderService } from "@/lib/server/services/order.service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const serviceCode = searchParams.get("serviceCode") || "";
    const country = searchParams.get("country") || "";

    if (!serviceCode || !country) {
      return error("serviceCode and country required", 400);
    }

    const service = new OrderService();
    const providers = await service.getAvailableProviders(serviceCode, country);
    return json({ ok: true, data: providers });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return error("Unauthorized", 401);
    }
    logger.error("[Orders][Available] Request failed", e);
    return error("Unexpected error", 500);
  }
}
