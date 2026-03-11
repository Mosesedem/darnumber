import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { PROVIDERS } from "@/lib/constants/providers";
import { SMSManService } from "@/lib/server/services/order.service";
import { TextVerifiedService } from "@/lib/server/services/textverified.service";
import { ExchangeRateService } from "@/lib/server/services/exchange-rate.service";
import { PricingService } from "@/lib/server/services/pricing.service";
import { getRedisService } from "@/lib/server/services/redis.service";

export const runtime = "nodejs";

const redis = getRedisService();
const SERVICES_CACHE_KEY = "orders:services:aggregated:v2";
const SERVICES_CACHE_TTL_SECONDS = 5 * 60;

// TextVerified default base price in USD (most services are $2.50)
// Exact price is fetched lazily via /api/providers/textverified/price when user selects a service
const TV_DEFAULT_BASE_PRICE_USD = 2.5;

// In-memory cache fallback for when Redis is OOM
let memoryCache: { data: string; expiresAt: number } | null = null;

export async function GET(req: NextRequest) {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   GET /api/orders/services - Provider Aggregator");
  console.log("╚════════════════════════════════════════════════╝");
  try {
    console.log("[Auth] Authenticating user...");
    const authResult = await requireAuth();
    console.log(`[Auth] ✓ User ${authResult?.user?.email} authenticated`);

    // Try Redis cache first, then in-memory fallback
    try {
      const cachedServices = await redis.get(SERVICES_CACHE_KEY);
      if (cachedServices) {
        console.log("[Cache] ✓ Returning cached aggregated services (Redis)");
        return json({ ok: true, data: JSON.parse(cachedServices) });
      }
    } catch (e) {
      console.warn("[Cache] Redis read failed, checking memory cache");
    }
    if (memoryCache && Date.now() < memoryCache.expiresAt) {
      console.log("[Cache] ✓ Returning cached aggregated services (memory)");
      return json({ ok: true, data: JSON.parse(memoryCache.data) });
    }

    console.log("[Rates] Fetching exchange rates from cache/API...");
    const rubToUsdRate = await ExchangeRateService.getUsdToRubRate();
    const usdToNgnRate = await ExchangeRateService.getUsdToNgnRate();
    console.log(
      `[Rates] ✓ 1 USD = ${rubToUsdRate} RUB, 1 USD = ${usdToNgnRate} NGN`,
    );

    const providers = [
      {
        id: PROVIDERS.LION.id,
        name: "sms-man",
        displayName: PROVIDERS.LION.displayName,
        logo: PROVIDERS.LION.logo,
        cover: "All Countries",
      },
      {
        id: PROVIDERS.PANDA.id,
        name: "textverified",
        displayName: PROVIDERS.PANDA.displayName,
        logo: PROVIDERS.PANDA.logo,
        cover: "United States",
      },
    ];

    console.log(
      `[Providers] Available: ${providers.map((p) => p.name).join(", ")}`,
    );

    const servicesMap = new Map<string, any>();

    let smsManServices: any[] = [];
    try {
      console.log("[SMSMan] Fetching services...");
      const smsManService = new SMSManService();
      smsManServices = await smsManService.getAvailableServices();
      console.log(
        `[SMSMan] ✓ Fetched ${smsManServices.length} services (RUB pricing)`,
      );
    } catch (err) {
      console.error(
        "[SMSMan] ✗ Error:",
        err instanceof Error ? err.message : err,
      );
      smsManServices = [];
    }

    let tvServices: any[] = [];
    try {
      console.log(
        "[TextVerified] Fetching service list (fast, no individual pricing)...",
      );
      const textVerifiedService = new TextVerifiedService();
      // Use getAvailableServices() — single API call, cached 1hr
      // Individual pricing is fetched lazily on the frontend when user selects a service
      const basicServices = await textVerifiedService.getAvailableServices();
      tvServices = basicServices.map((s: any) => ({
        ...s,
        price: TV_DEFAULT_BASE_PRICE_USD,
      }));
      console.log(
        `[TextVerified] ✓ Fetched ${tvServices.length} services (default price: $${TV_DEFAULT_BASE_PRICE_USD})`,
      );
      if (tvServices.length > 0) {
        console.log(`[TextVerified] Sample service:`, {
          name: tvServices[0].serviceName,
          price: tvServices[0].price,
          capability: tvServices[0].capability,
        });
      }
    } catch (err) {
      console.error(
        "[TextVerified] ✗ Error fetching services:",
        err instanceof Error ? err.message : err,
      );
      tvServices = [];
    }

    if (smsManServices.length === 0 && tvServices.length === 0) {
      console.error("[Error] No services available from any provider");
      return error(
        "No services available from providers. Please check API keys and try again.",
        503,
      );
    }

    console.log(
      `[Summary] Total raw services: SMS-Man ${
        smsManServices.length
      } + TextVerified ${tvServices.length} = ${
        smsManServices.length + tvServices.length
      }`,
    );

    // Collect all services for batch pricing calculation using admin rules
    const servicesToPrice: Array<{
      basePrice: number;
      serviceCode: string;
      country: string;
    }> = [];
    const serviceMetadata: Array<{
      key: string;
      providerData: any;
      providerId: string;
      providerName: string;
    }> = [];

    // Process SMS-Man services: convert RUB to USD base price
    console.log(
      "[Processing] Collecting SMS-Man base prices for admin pricing rules...",
    );
    smsManServices.forEach((service: any, idx: number) => {
      const priceRUB = service.price; // SMS-Man returns prices in Russian Rubles
      const baseUSD = Number((priceRUB / rubToUsdRate).toFixed(4));

      if (idx === 0) {
        console.log(
          `[SMSMan] Sample base: ${priceRUB} RUB (provider) → ${baseUSD} USD (before admin markup)`,
        );
      }

      servicesToPrice.push({
        basePrice: baseUSD,
        serviceCode: service.code,
        country: service.country,
      });
      serviceMetadata.push({
        key: `${service.code}-${service.country}`,
        providerData: service,
        providerId: PROVIDERS.LION.id,
        providerName: "sms-man",
      });
    });

    // Process TextVerified services: USD base price
    console.log(
      "[Processing] Collecting TextVerified base prices for admin pricing rules...",
    );
    tvServices.forEach((service: any, idx: number) => {
      const baseUSD = service.price || 0;

      if (idx === 0 && tvServices.length > 0) {
        console.log(
          `[TextVerified] Sample base: ${service.name} = ${baseUSD} USD (before admin markup)`,
        );
      }

      servicesToPrice.push({
        basePrice: baseUSD,
        serviceCode: service.serviceName || service.code, // Use serviceName from new API
        country: service.country || "US", // TextVerified is US only
      });
      serviceMetadata.push({
        key: `${service.serviceName || service.code}-US`,
        providerData: {
          ...service,
          code: service.serviceName || service.code,
          country: "US",
          name: service.serviceName || service.name,
        },
        providerId: PROVIDERS.PANDA.id,
        providerName: "textverified",
      });
    });

    // Apply admin pricing rules to all services in batch
    console.log("[Pricing] Applying admin pricing rules to all services...");
    const pricingResults =
      await PricingService.calculatePrices(servicesToPrice);

    // Log first pricing result for debugging
    if (pricingResults.length > 0) {
      const firstResult = pricingResults[0];
      console.log(
        `[Pricing] Sample result: base $${firstResult.basePrice.toFixed(
          4,
        )} + profit $${firstResult.profit.toFixed(
          4,
        )} = $${firstResult.finalPrice.toFixed(4)}`,
        firstResult.ruleApplied
          ? `(Rule: ${firstResult.ruleApplied.profitType} ${
              firstResult.ruleApplied.profitValue
            }${
              firstResult.ruleApplied.profitType === "PERCENTAGE" ? "%" : " USD"
            })`
          : "(Default 20% markup)",
      );
    }

    // Build services map with priced data
    pricingResults.forEach((priceResult, idx) => {
      const metadata = serviceMetadata[idx];
      const service = metadata.providerData;
      const priceUSD = Number(priceResult.finalPrice.toFixed(2));

      if (!servicesMap.has(metadata.key)) {
        servicesMap.set(metadata.key, {
          code: service.code,
          name: service.name,
          country: service.country,
          price: priceUSD,
          prices: { [metadata.providerId]: priceUSD },
          currency: "USD",
          providerId: metadata.providerName,
          capability: service.capability || "sms",
          ui: {
            logo: "📱",
            color: "bg-gray-200",
            displayName: service.name,
          },
          providers: [
            {
              id: metadata.providerId,
              name: metadata.providerName,
              displayName:
                metadata.providerName === "sms-man"
                  ? PROVIDERS.LION.displayName
                  : PROVIDERS.PANDA.displayName,
            },
          ],
        });
      } else {
        const existing = servicesMap.get(metadata.key);
        existing.prices = existing.prices || {};
        existing.prices[metadata.providerId] = priceUSD;
        existing.capability =
          service.capability || existing.capability || "sms";
        if (
          !existing.providers.find((p: any) => p.id === metadata.providerId)
        ) {
          existing.providers.push({
            id: metadata.providerId,
            name: metadata.providerName,
            displayName:
              metadata.providerName === "sms-man"
                ? PROVIDERS.LION.displayName
                : PROVIDERS.PANDA.displayName,
          });
        }
      }
    });

    const result = {
      services: Array.from(servicesMap.values()),
      providers,
      exchangeRate: {
        usdToNgn: usdToNgnRate,
        usdToRub: rubToUsdRate,
        source: "server",
        timestamp: new Date().toISOString(),
      },
    };

    // Cache in Redis (may fail if OOM) and always cache in memory as fallback
    const resultJson = JSON.stringify(result);
    memoryCache = {
      data: resultJson,
      expiresAt: Date.now() + SERVICES_CACHE_TTL_SECONDS * 1000,
    };
    try {
      await redis.set(
        SERVICES_CACHE_KEY,
        resultJson,
        SERVICES_CACHE_TTL_SECONDS,
      );
    } catch (cacheErr) {
      console.warn(
        "[Cache] Redis write failed (OOM?), using memory cache only",
      );
    }

    console.log("\n[Summary] ✓ Aggregation complete:");
    console.log(`  • Total unique services: ${result.services.length}`);
    console.log(`  • Providers: ${result.providers.length}`);
    console.log(`  • All prices in: USD (with admin pricing rules applied)`);
    console.log(`  • SMS-Man (RUB→USD): ${smsManServices.length} services`);
    console.log(`  • TextVerified (USD): ${tvServices.length} services`);
    if (result.services.length > 0) {
      console.log(
        "  • Sample service:",
        JSON.stringify(result.services[0], null, 2),
      );
    }
    console.log("╚════════════════════════════════════════════════╝\n");

    return json({ ok: true, data: result });
  } catch (e) {
    console.error("\n[Error] ✗ Request failed");
    console.error("Details:", {
      message: e instanceof Error ? e.message : "Unknown error",
      stack: e instanceof Error ? e.stack : undefined,
    });

    if (e instanceof Error && e.message === "Unauthorized") {
      return error("Unauthorized", 401);
    }

    console.log("╚════════════════════════════════════════════════╝\n");
    return error(
      `Service aggregation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      500,
    );
  }
}
