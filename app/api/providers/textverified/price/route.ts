import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { TextVerifiedService } from "@/lib/server/services/order.service";

export const runtime = "nodejs";

/**
 * GET /api/providers/textverified/price
 * Fetches the price for a single TextVerified service, with caching.
 * @param {NextRequest} req - serviceName: string
 */
export async function GET(req: NextRequest) {
  const serviceName = req.nextUrl.searchParams.get("serviceName");

  if (!serviceName) {
    return error("serviceName is required", 400);
  }

  try {
    const textVerifiedService = new TextVerifiedService();
    const price = await textVerifiedService.fetchAndCacheServicePrice(
      serviceName
    );

    if (price === null) {
      return error("Price not found for this service", 404);
    }

    return json({ ok: true, data: { serviceName, price } });
  } catch (e) {
    const err = e as Error;
    console.error(
      `[API][TextVerified][Price] Failed to fetch price for ${serviceName}:`,
      err
    );
    return error(err.message, 500);
  }
}
