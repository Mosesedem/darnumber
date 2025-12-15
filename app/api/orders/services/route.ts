import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { PROVIDERS } from "@/lib/constants/providers";
import {
  SMSManService,
  TextVerifiedService,
} from "@/lib/server/services/order.service";
import { ExchangeRateService } from "@/lib/server/services/exchange-rate.service";

export const runtime = "nodejs";

// Pricing markup: 20% profit margin + 2000 NGN flat fee
const MARKUP_PERCENTAGE = 0.2;
const FLAT_FEE_NGN = 2000;

export async function GET(req: NextRequest) {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   GET /api/orders/services - Provider Aggregator");
  console.log("╚════════════════════════════════════════════════╝");
  try {
    console.log("[Auth] Authenticating user...");
    const authResult = await requireAuth();
    console.log(`[Auth] ✓ User ${authResult?.email} authenticated`);

    console.log("[Rates] Fetching exchange rates from cache/API...");
    const rubToUsdRate = await ExchangeRateService.getUsdToRubRate();
    const usdToNgnRate = await ExchangeRateService.getUsdToNgnRate();
    console.log(
      `[Rates] ✓ 1 USD = ${rubToUsdRate} RUB, 1 USD = ${usdToNgnRate} NGN`
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
      `[Providers] Available: ${providers.map((p) => p.name).join(", ")}`
    );

    const servicesMap = new Map<string, any>();

    let smsManServices: any[] = [];
    try {
      console.log("[SMSMan] Fetching services...");
      const smsManService = new SMSManService();
      smsManServices = await smsManService.getAvailableServices();
      console.log(
        `[SMSMan] ✓ Fetched ${smsManServices.length} services (RUB pricing)`
      );
    } catch (err) {
      console.error(
        "[SMSMan] ✗ Error:",
        err instanceof Error ? err.message : err
      );
      smsManServices = [];
    }

    let tvServices: any[] = [];
    try {
      console.log("[TextVerified] Fetching services...");
      const textVerifiedService = new TextVerifiedService();
      tvServices = await textVerifiedService.getAvailableServices();
      console.log(
        `[TextVerified] ✓ Fetched ${tvServices.length} services (USD pricing)`
      );
    } catch (err) {
      console.error(
        "[TextVerified] ✗ Error:",
        err instanceof Error ? err.message : err
      );
      tvServices = [];
    }

    if (smsManServices.length === 0 && tvServices.length === 0) {
      console.error("[Error] No services available from any provider");
      return error(
        "No services available from providers. Please check API keys and try again.",
        503
      );
    }

    console.log(
      `[Summary] Total raw services: SMS-Man ${
        smsManServices.length
      } + TextVerified ${tvServices.length} = ${
        smsManServices.length + tvServices.length
      }`
    );

    // Process SMS-Man services: convert RUB → USD → apply markup (20% + 2000 NGN)
    console.log(
      "[Processing] Converting SMS-Man RUB prices to USD with full markup..."
    );
    smsManServices.forEach((service: any, idx: number) => {
      const key = `${service.code}-${service.country}`;
      const priceRUB = service.price; // SMS-Man returns prices in Russian Rubles
      const baseUSD = Number((priceRUB / rubToUsdRate).toFixed(4));
      const flatFeeUSD = FLAT_FEE_NGN / usdToNgnRate;
      const priceUSD = Number(
        (baseUSD * (1 + MARKUP_PERCENTAGE) + flatFeeUSD).toFixed(2)
      );

      if (idx === 0) {
        console.log(
          `[SMSMan] Sample: ${priceRUB} RUB (provider) → ${baseUSD} USD → ${priceUSD} USD (×1.20 + ₦${FLAT_FEE_NGN})`
        );
      }

      if (!servicesMap.has(key)) {
        servicesMap.set(key, {
          code: service.code,
          name: service.name,
          country: service.country,
          price: priceUSD,
          prices: { [PROVIDERS.LION.id]: priceUSD },
          currency: "USD",
          providerId: "sms-man",
          ui: {
            logo: "📱",
            color: "bg-gray-200",
            displayName: service.name,
          },
          providers: [
            {
              id: PROVIDERS.LION.id,
              name: "sms-man",
              displayName: PROVIDERS.LION.displayName,
            },
          ],
        });
      } else {
        const existing = servicesMap.get(key);
        existing.prices = existing.prices || {};
        existing.prices[PROVIDERS.LION.id] = priceUSD;
        if (!existing.providers.find((p: any) => p.id === PROVIDERS.LION.id)) {
          existing.providers.push({
            id: PROVIDERS.LION.id,
            name: "sms-man",
            displayName: PROVIDERS.LION.displayName,
          });
        }
      }
    });

    // Process TextVerified services: USD prices → apply markup (20% + 2000 NGN)
    console.log("[Processing] TextVerified services (USD) with full markup...");
    tvServices.forEach((service: any, idx: number) => {
      const key = `${service.code}-${service.country}`;
      // TextVerified services have price: 0 initially, will be fetched on-demand
      const baseUSD = service.price || 0;
      const flatFeeUSD = FLAT_FEE_NGN / usdToNgnRate;
      const priceUSD = Number(
        (baseUSD * (1 + MARKUP_PERCENTAGE) + flatFeeUSD).toFixed(2)
      );

      if (idx === 0 && tvServices.length > 0) {
        console.log(
          `[TextVerified] Sample: ${service.name} = ${baseUSD} USD → ${priceUSD} USD (×1.20 + ₦${FLAT_FEE_NGN})`
        );
      }

      if (!servicesMap.has(key)) {
        servicesMap.set(key, {
          code: service.code,
          name: service.name,
          country: service.country,
          price: priceUSD,
          prices: { [PROVIDERS.PANDA.id]: priceUSD },
          currency: "USD",
          providerId: "textverified",
          capability: service.capability || "sms",
          ui: {
            logo: "📱",
            color: "bg-gray-200",
            displayName: service.name,
          },
          providers: [
            {
              id: PROVIDERS.PANDA.id,
              name: "textverified",
              displayName: PROVIDERS.PANDA.displayName,
            },
          ],
        });
      } else {
        const existing = servicesMap.get(key);
        existing.prices = existing.prices || {};
        existing.prices[PROVIDERS.PANDA.id] = priceUSD;
        existing.capability =
          service.capability || existing.capability || "sms";
        if (!existing.providers.find((p: any) => p.id === PROVIDERS.PANDA.id)) {
          existing.providers.push({
            id: PROVIDERS.PANDA.id,
            name: "textverified",
            displayName: PROVIDERS.PANDA.displayName,
          });
        }
      }
    });

    const result = {
      services: Array.from(servicesMap.values()),
      providers,
    };

    console.log("\n[Summary] ✓ Aggregation complete:");
    console.log(`  • Total unique services: ${result.services.length}`);
    console.log(`  • Providers: ${result.providers.length}`);
    console.log(`  • All prices in: USD`);
    console.log(`  • SMS-Man (RUB→USD): ${smsManServices.length} services`);
    console.log(`  • TextVerified (USD): ${tvServices.length} services`);
    if (result.services.length > 0) {
      console.log(
        "  • Sample service:",
        JSON.stringify(result.services[0], null, 2)
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
    return error("Unexpected error", 500);
  }
}
