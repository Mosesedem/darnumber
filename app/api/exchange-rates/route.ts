import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { ExchangeRateService } from "@/lib/server/services/exchange-rate.service";

export const runtime = "nodejs";

/**
 * GET /api/exchange-rates
 * Public endpoint returning current cached exchange rates.
 * Used by the frontend to convert USD prices to NGN for display.
 */
export async function GET(_req: NextRequest) {
  console.log("[GET /api/exchange-rates] Fetching current rates...");
  try {
    const [usdToNgn, usdToRub] = await Promise.all([
      ExchangeRateService.getUsdToNgnRate(),
      ExchangeRateService.getUsdToRubRate(),
    ]);

    console.log(`[GET /api/exchange-rates] Rates: USD/NGN=${usdToNgn}, USD/RUB=${usdToRub}`);

    return json({
      ok: true,
      data: {
        usdToNgn,
        usdToRub,
        rubToUsd: 1 / usdToRub,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[GET /api/exchange-rates] Error:", e);
    // Return fallback rates rather than failing
    return json({
      ok: true,
      data: {
        usdToNgn: 1600,
        usdToRub: 100,
        rubToUsd: 0.01,
        timestamp: new Date().toISOString(),
        fallback: true,
      },
    });
  }
}
