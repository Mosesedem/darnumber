import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { TextVerifiedService } from "@/lib/server/services/textverified.service";
import { ExchangeRateService } from "@/lib/server/services/exchange-rate.service";
import { PricingService } from "@/lib/server/services/pricing.service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/providers/textverified/price
 * Fetches the price for a single TextVerified service with admin-configured profit markup applied, returned in NGN.
 * @param {NextRequest} req - serviceName: string
 */
export async function GET(req: NextRequest) {
  const serviceName = req.nextUrl.searchParams.get("serviceName");

  if (!serviceName) {
    return error("serviceName is required", 400);
  }

  try {
    const textVerifiedService = new TextVerifiedService();

    // Quote the capability the service actually sells. Trying sms, voice, and
    // combo in sequence is what TextVerified rejects as incompatible.
    let quote: Awaited<ReturnType<TextVerifiedService["quoteVerification"]>>;
    try {
      quote = await textVerifiedService.quoteVerification(serviceName);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/not available/i.test(message)) {
        return error(`Price not available for service: ${serviceName}`, 404);
      }
      throw e;
    }

    const baseUsdPrice = quote.price;

    // 2. Get exchange rate
    const usdToNgn = await ExchangeRateService.getUsdToNgnRate();

    // 3. Apply admin pricing rules (TextVerified is always US)
    // final = providerBase + markup (FIXED may be USD or NGN)
    const pricingResult = await PricingService.calculatePrice(
      baseUsdPrice,
      quote.serviceName,
      "US",
      usdToNgn,
    );

    const finalUsdPrice = pricingResult.finalPrice;
    const profitUsd = pricingResult.profit;

    // 4. Convert to NGN
    const finalNgnPrice = Math.ceil(finalUsdPrice * usdToNgn);

    return json({
      ok: true,
      data: {
        serviceName: quote.serviceName,
        capability: quote.capability,
        price: finalNgnPrice, // Return NGN price
        baseUsd: baseUsdPrice,
        profitUsd: profitUsd,
        finalUsd: finalUsdPrice,
        ruleApplied: pricingResult.ruleApplied,
      },
    });
  } catch (e) {
    const err = e as Error;
    logger.error(
      `[API][panda][Price] Failed to fetch price for ${serviceName}:`,
      err,
    );
    return error(err.message, 500);
  }
}
