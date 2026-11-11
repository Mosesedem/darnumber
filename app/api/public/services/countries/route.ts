import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { getCountriesForService } from "@/lib/server/services/services-catalog.service";
import { PROVIDERS } from "@/lib/constants/providers";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/services/countries?serviceCode=wa&provider=lion
 *
 * Returns only the countries + priced rows for one service under one provider.
 * Typically a few dozen to a couple hundred rows — not the full 100k matrix.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceCode = searchParams.get("serviceCode")?.trim() || "";
    const providerRaw = searchParams.get("provider")?.trim() || "";

    if (!serviceCode || !providerRaw) {
      return error("serviceCode and provider are required", 400);
    }

    // Normalize provider aliases used by the UI
    const providerId = normalizeProviderId(providerRaw);

    const result = await getCountriesForService(serviceCode, providerId);

    return json(
      {
        ok: true,
        data: {
          serviceCode,
          provider: providerId,
          countries: result.countries,
          exchangeRate: result.exchangeRate,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load countries";
    logger.error("[public/services/countries] error", e);
    if (message.startsWith("Unknown provider")) {
      return error(message, 400);
    }
    return error("Failed to load countries for this service. Please try again.", 503);
  }
}

function normalizeProviderId(raw: string): string {
  const v = raw.toLowerCase();
  if (v === "lion" || v === "sms-man" || v === "smsman") {
    return PROVIDERS.LION.id;
  }
  if (v === "panda" || v === "textverified") {
    return PROVIDERS.PANDA.id;
  }
  return raw;
}
