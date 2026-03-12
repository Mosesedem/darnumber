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
const SERVICES_CACHE_TTL_SECONDS = 30 * 60; // 30 min — amortises the expensive build cost
const PROVIDER_FETCH_TIMEOUT_MS = 25000;

// TextVerified default base price in USD (most services are $2.50)
// Exact price is fetched lazily via /api/providers/textverified/price when user selects a service
const TV_BASE_PRICE_CAPABILITY = "sms"; // Fetch pricing for SMS capability (voice is out of stock)

// In-memory cache fallback for when Redis is OOM
// `cachedAt` is stored so the stale-while-revalidate logic can check age.
const SERVICES_STALE_AFTER_SECONDS = 24 * 60; // serve stale, refresh in background after 24 min
let memoryCache: { data: string; expiresAt: number; cachedAt: number } | null =
  null;
let refreshInProgress = false;

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = PROVIDER_FETCH_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Fetches all provider services, applies admin pricing rules, and writes the
 * result to Redis + in-memory cache. Guarded by `refreshInProgress` so
 * concurrent stale-while-revalidate background triggers are coalesced into one.
 */
async function buildAndCacheServices(): Promise<void> {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    console.log("[Build] Starting services cache build...");
    const rubToUsdRate = await ExchangeRateService.getUsdToRubRate();
    const usdToNgnRate = await ExchangeRateService.getUsdToNgnRate();
    console.log(
      `[Build] Rates: 1 USD = ${rubToUsdRate} RUB, 1 USD = ${usdToNgnRate} NGN`,
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

    const servicesMap = new Map<string, any>();

    console.log("[Build] Fetching provider services in parallel...");
    const [smsManResult, tvResult] = await Promise.allSettled([
      withTimeout(
        (async () => {
          console.log("[SMSMan] Fetching services...");
          const smsManService = new SMSManService();
          const services = await smsManService.getAvailableServices();
          console.log(
            `[SMSMan] ✓ Fetched ${services.length} services (RUB pricing)`,
          );
          return services;
        })(),
        "SMS-Man service fetch",
        60 * 1000, // 60s — sub-caches are warmed at startup; cold-start tolerance
      ),
      withTimeout(
        (async () => {
          console.log(
            "[TextVerified] Fetching services with real per-service pricing (sms capability)...",
          );
          const textVerifiedService = new TextVerifiedService();
          // Use 'sms' capability override so prices reflect SMS numbers (not voice,
          // which is currently out of stock at TextVerified and returns wrong prices).
          const services = await textVerifiedService.getServicesWithPricing(
            "mobile",
            false,
            false,
            TV_BASE_PRICE_CAPABILITY,
          );
          console.log(
            `[TextVerified] ✓ Fetched ${services.length} services with real prices`,
          );
          return services;
        })(),
        "TextVerified service fetch",
        45 * 1000, // 45s — includes batched per-service pricing fetches; individual prices are Redis-cached for 30min
      ),
    ]);

    const smsManServices =
      smsManResult.status === "fulfilled" ? smsManResult.value : [];
    if (smsManResult.status === "rejected") {
      console.error(
        "[SMSMan] ✗ Error:",
        smsManResult.reason instanceof Error
          ? smsManResult.reason.message
          : smsManResult.reason,
      );
    }

    const tvServices = tvResult.status === "fulfilled" ? tvResult.value : [];
    if (tvResult.status === "rejected") {
      console.error(
        "[TextVerified] ✗ Error:",
        tvResult.reason instanceof Error
          ? tvResult.reason.message
          : tvResult.reason,
      );
    }

    if (smsManServices.length === 0 && tvServices.length === 0) {
      console.error(
        "[Build] No services from any provider — skipping cache write",
      );
      return;
    }

    // Refuse to cache a partial result that has no Lion (SMS-Man) services.
    // A previous poll may have cached a TextVerified-only snapshot when SMS-Man
    // timed out; we must not let that sit for 30 minutes.
    if (smsManServices.length === 0) {
      console.warn(
        "[Build] SMS-Man returned 0 services — skipping cache write to avoid serving lion-less snapshot",
      );
      return;
    }

    console.log(
      `[Build] Total raw: SMS-Man ${smsManServices.length} + TextVerified ${tvServices.length}`,
    );

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

    smsManServices.forEach((service: any, idx: number) => {
      const baseUSD = Number((service.price / rubToUsdRate).toFixed(4));
      if (idx === 0) {
        console.log(
          `[SMSMan] Sample base: ${service.price} RUB → $${baseUSD} USD`,
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

    tvServices.forEach((service: any, idx: number) => {
      const baseUSD = service.price || 0;
      if (idx === 0) {
        console.log(`[TextVerified] Sample base: $${baseUSD} USD`);
      }
      servicesToPrice.push({
        basePrice: baseUSD,
        serviceCode: service.serviceName || service.code,
        country: "US",
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

    console.log("[Build] Applying admin pricing rules...");
    const pricingResults =
      await PricingService.calculatePrices(servicesToPrice);

    if (pricingResults.length > 0) {
      const first = pricingResults[0];
      console.log(
        `[Build] Sample pricing: $${first.basePrice.toFixed(4)} base + $${first.profit.toFixed(4)} profit = $${first.finalPrice.toFixed(4)}`,
        first.ruleApplied
          ? `(Rule: ${first.ruleApplied.profitType} ${first.ruleApplied.profitValue})`
          : "(Default 20%)",
      );
    }

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

    // Embed cachedAt timestamp so stale-while-revalidate can check cache age
    const now = Date.now();
    const resultJson = JSON.stringify({ ...result, cachedAt: now });
    memoryCache = {
      data: resultJson,
      expiresAt: now + SERVICES_CACHE_TTL_SECONDS * 1000,
      cachedAt: now,
    };
    try {
      await redis.set(
        SERVICES_CACHE_KEY,
        resultJson,
        SERVICES_CACHE_TTL_SECONDS,
      );
    } catch {
      console.warn(
        "[Build] Redis write failed (OOM?), using memory cache only",
      );
    }

    console.log(
      `[Build] ✓ Cache built: ${result.services.length} unique services`,
      `(SMS-Man: ${smsManServices.length}, TextVerified: ${tvServices.length})`,
    );
  } finally {
    refreshInProgress = false;
  }
}

export async function GET() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   GET /api/orders/services - Provider Aggregator");
  console.log("╚════════════════════════════════════════════════╝");
  try {
    console.log("[Auth] Authenticating user...");
    const authResult = await requireAuth();
    console.log(`[Auth] ✓ User ${authResult?.user?.email} authenticated`);

    // ── Stale-while-revalidate cache ─────────────────────────────────────────
    // Always return cached data immediately. If the data is older than
    // SERVICES_STALE_AFTER_SECONDS, kick off a background rebuild so the
    // *next* request benefits — no user ever waits for the expensive fetch.
    const serveCache = async (
      raw: string,
      source: string,
    ): Promise<Response> => {
      const parsed = JSON.parse(raw) as Record<string, unknown> & {
        cachedAt?: number;
        services?: Array<{ providers?: Array<{ id: string }> }>;
      };

      // Validate: if the cached payload has no Lion services, it was built during
      // an SMS-Man timeout. Force a synchronous rebuild rather than serving it.
      const hasLion =
        Array.isArray(parsed.services) &&
        parsed.services.some((s) =>
          s.providers?.some((p) => p.id === PROVIDERS.LION.id),
        );
      if (!hasLion) {
        console.warn(
          `[Cache] ${source} contains no Lion services — discarding and rebuilding synchronously`,
        );
        // Delete poisoned cache entries so they are not served again
        try {
          await redis.del(SERVICES_CACHE_KEY);
        } catch {
          /* ignore */
        }
        memoryCache = null;
        await buildAndCacheServices();
        // Use `as` cast to escape TypeScript's control-flow narrowing of the module-level variable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshCacheData = memoryCache as any as {
          data: string;
          expiresAt: number;
        } | null;
        if (freshCacheData) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { cachedAt, ...rest } = JSON.parse(
            freshCacheData.data,
          ) as Record<string, unknown> & { cachedAt?: number };
          return json({ ok: true, data: rest });
        }
        return error(
          "No services available from providers. Please check API keys and try again.",
          503,
        );
      }

      const ageSeconds = (Date.now() - (parsed.cachedAt ?? 0)) / 1000;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cachedAt, services: _s, ...clientData } = parsed;
      const clientPayload = { ...clientData, services: parsed.services };

      if (ageSeconds > SERVICES_STALE_AFTER_SECONDS && !refreshInProgress) {
        console.log(
          `[Cache] ${source} is ${Math.round(ageSeconds / 60)}min old — rebuilding in background`,
        );
        void buildAndCacheServices();
      } else {
        console.log(
          `[Cache] ✓ Serving ${source} (${Math.round(ageSeconds / 60)}min old, ${parsed.services?.length ?? 0} services, has Lion: yes)`,
        );
      }
      console.log("╚════════════════════════════════════════════════╝\n");
      return json({ ok: true, data: clientPayload });
    };

    try {
      const cached = await redis.get(SERVICES_CACHE_KEY);
      if (cached) return await serveCache(cached, "Redis cache");
    } catch {
      console.warn("[Cache] Redis read failed, checking memory cache");
    }

    if (memoryCache && Date.now() < memoryCache.expiresAt) {
      return await serveCache(memoryCache.data, "memory cache");
    }

    // ── Cache miss: build synchronously then serve ────────────────────────────────────
    console.log("[Cache] Miss — building synchronously...");
    await buildAndCacheServices();

    if (memoryCache) {
      return await serveCache(memoryCache.data, "fresh build");
    }

    // Both providers returned empty sets
    console.log("╚════════════════════════════════════════════════╝\n");
    return error(
      "No services available from providers. Please check API keys and try again.",
      503,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return error("Unauthorized", 401);
    }
    console.error(
      "[Error] ✗ Request failed:",
      e instanceof Error ? e.message : e,
    );
    console.log("╚════════════════════════════════════════════════╝\n");
    return error(
      `Service aggregation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      500,
    );
  }
}
