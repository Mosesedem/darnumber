import { prisma } from "@/lib/server/prisma";
import { Prisma } from "@/app/generated/prisma";

interface ExchangeRateResponse {
  rates: Record<string, number>;
}

const OPEN_EXCHANGE_RATES_API_ID = process.env.OPEN_EXCHANGE_RATES_API_ID;
const CACHE_DURATION_HOURS = 8; // Refresh every 8 hours (3 times daily)

export class ExchangeRateService {
  /**
   * Get exchange rate from cache or fetch from API if stale
   */
  static async getRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    try {
      // Try to get from database cache
      const cached = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency,
            toCurrency,
          },
        },
      });

      // Check if cache is still valid (less than 8 hours old)
      const now = new Date();
      const cacheValid =
        cached &&
        now.getTime() - cached.updatedAt.getTime() <
          CACHE_DURATION_HOURS * 60 * 60 * 1000;

      if (cacheValid && cached) {
        console.log(
          `[ExchangeRate] ✓ Using cached rate: 1 ${fromCurrency} = ${
            cached.rate
          } ${toCurrency} (age: ${Math.round(
            (now.getTime() - cached.updatedAt.getTime()) / (1000 * 60)
          )}min)`
        );
        return Number(cached.rate);
      }

      // Cache miss or stale - fetch from API
      console.log(
        `[ExchangeRate] Cache ${
          cached ? "stale" : "miss"
        } for ${fromCurrency}/${toCurrency}, fetching from API...`
      );
      const rate = await this.fetchRateFromAPI(fromCurrency, toCurrency);

      // Update or create cache entry
      await prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency,
            toCurrency,
          },
        },
        update: {
          rate: new Prisma.Decimal(rate),
          updatedAt: now,
        },
        create: {
          fromCurrency,
          toCurrency,
          rate: new Prisma.Decimal(rate),
        },
      });

      console.log(
        `[ExchangeRate] ✓ Cached new rate: 1 ${fromCurrency} = ${rate} ${toCurrency}`
      );
      return rate;
    } catch (error) {
      console.error(
        `[ExchangeRate] Error getting rate for ${fromCurrency}/${toCurrency}:`,
        error
      );
      // Try to return stale cache as fallback, but don't fail if DB is unavailable
      try {
        const staleCache = await prisma.exchangeRate.findUnique({
          where: {
            fromCurrency_toCurrency: {
              fromCurrency,
              toCurrency,
            },
          },
        });

        if (staleCache) {
          console.warn(
            `[ExchangeRate] ⚠ Using stale cache as fallback: ${staleCache.rate}`
          );
          return Number(staleCache.rate);
        }
      } catch (dbErr) {
        console.warn(
          `[ExchangeRate] ⚠ Skipping stale cache lookup due to DB error:`,
          dbErr
        );
      }

      // Return hardcoded fallback as last resort
      return this.getFallbackRate(fromCurrency, toCurrency);
    }
  }

  /**
   * Fetch rate from Open Exchange Rates API
   */
  private static async fetchRateFromAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_RATES_API_ID}&base=${fromCurrency}`;

    const response = await fetch(url, {
      next: { revalidate: 0 }, // Don't cache at fetch level
    });

    if (!response.ok) {
      throw new Error(
        `Open Exchange Rates API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (!data.rates || !(toCurrency in data.rates)) {
      throw new Error(`Currency ${toCurrency} not found in API response`);
    }

    return data.rates[toCurrency];
  }

  /**
   * Get hardcoded fallback rates (last resort)
   */
  private static getFallbackRate(
    fromCurrency: string,
    toCurrency: string
  ): number {
    console.error(
      `[ExchangeRate] ✗ Using hardcoded fallback for ${fromCurrency}/${toCurrency}`
    );

    const fallbacks: Record<string, Record<string, number>> = {
      USD: {
        NGN: 1500,
        RUB: 100,
      },
    };

    return fallbacks[fromCurrency]?.[toCurrency] || 1;
  }

  /**
   * Manually refresh all commonly used rates (can be called by cron job)
   */
  static async refreshCommonRates(): Promise<void> {
    console.log("[ExchangeRate] Refreshing common exchange rates...");

    const commonPairs = [
      { from: "USD", to: "NGN" },
      { from: "USD", to: "RUB" },
    ];

    for (const pair of commonPairs) {
      try {
        await this.getRate(pair.from, pair.to);
      } catch (error) {
        console.error(
          `[ExchangeRate] Failed to refresh ${pair.from}/${pair.to}:`,
          error
        );
      }
    }

    console.log("[ExchangeRate] ✓ Refresh complete");
  }

  /**
   * Get USD/RUB rate (for SMS-Man conversion)
   */
  static async getUsdToRubRate(): Promise<number> {
    return this.getRate("USD", "RUB");
  }

  /**
   * Get USD/NGN rate (for Nigerian pricing)
   */
  static async getUsdToNgnRate(): Promise<number> {
    return this.getRate("USD", "NGN");
  }

  /**
   * Convert RUB to USD
   */
  static async convertRubToUsd(rubAmount: number): Promise<number> {
    const rate = await this.getUsdToRubRate();
    return rubAmount / rate;
  }

  /**
   * Convert USD to NGN
   */
  static async convertUsdToNgn(usdAmount: number): Promise<number> {
    const rate = await this.getUsdToNgnRate();
    return usdAmount * rate;
  }
}
