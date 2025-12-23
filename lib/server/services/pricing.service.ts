import { prisma } from "@/lib/server/prisma";

/**
 * PricingService - Applies admin-configured pricing rules to calculate final prices.
 *
 * Pricing rules are fetched from the database and matched in priority order:
 * 1. Higher priority rules take precedence
 * 2. More specific rules (service + country) override general rules
 * 3. If no rule matches, a default fallback markup is applied
 */

interface PricingResult {
  basePrice: number;
  profit: number;
  finalPrice: number;
  ruleApplied: {
    id: string | null;
    serviceCode: string | null;
    country: string | null;
    profitType: string;
    profitValue: number;
    priority: number;
  } | null;
}

// Default fallback if no pricing rule is configured
const DEFAULT_MARKUP = {
  profitType: "PERCENTAGE" as const,
  profitValue: 20, // 20% default markup
};

export class PricingService {
  /**
   * Find the best matching pricing rule for a service/country combination.
   * Rules are matched in this priority order:
   * 1. Exact match (serviceCode + country)
   * 2. Service only (serviceCode + any country)
   * 3. Country only (any service + country)
   * 4. Global (any service + any country)
   *
   * Within each category, higher priority rules take precedence.
   */
  static async findBestPricingRule(
    serviceCode: string,
    country: string
  ): Promise<{
    id: string;
    serviceCode: string | null;
    country: string | null;
    profitType: string;
    profitValue: number;
    priority: number;
  } | null> {
    // Fetch all active pricing rules ordered by priority (highest first)
    const rules = await prisma.pricingRule.findMany({
      where: {
        isActive: true,
        OR: [
          { serviceCode, country },
          { serviceCode, country: null },
          { serviceCode: null, country },
          { serviceCode: null, country: null },
        ],
      },
      orderBy: { priority: "desc" },
    });

    if (rules.length === 0) return null;

    // Score each rule based on specificity and priority
    // More specific rules get higher scores
    const scoreRule = (rule: (typeof rules)[0]): number => {
      let score = rule.priority * 100; // Base score from priority
      if (rule.serviceCode && rule.country) score += 1000; // Most specific
      else if (rule.serviceCode) score += 500; // Service-specific
      else if (rule.country) score += 250; // Country-specific
      // Global rules get no bonus
      return score;
    };

    const scoredRules = rules.map((rule) => ({
      rule,
      score: scoreRule(rule),
    }));

    // Sort by score descending
    scoredRules.sort((a, b) => b.score - a.score);

    const bestRule = scoredRules[0].rule;
    return {
      id: bestRule.id,
      serviceCode: bestRule.serviceCode,
      country: bestRule.country,
      profitType: bestRule.profitType,
      profitValue: Number(bestRule.profitValue),
      priority: bestRule.priority,
    };
  }

  /**
   * Calculate the final price by applying the matching pricing rule.
   *
   * @param basePrice - The base cost from the provider (in any currency)
   * @param serviceCode - The service code
   * @param country - The country code
   * @returns PricingResult with basePrice, profit, finalPrice, and the rule applied
   */
  static async calculatePrice(
    basePrice: number,
    serviceCode: string,
    country: string
  ): Promise<PricingResult> {
    const rule = await this.findBestPricingRule(serviceCode, country);

    let profit = 0;
    let appliedRule: PricingResult["ruleApplied"] = null;

    if (rule) {
      if (rule.profitType === "PERCENTAGE") {
        profit = basePrice * (rule.profitValue / 100);
      } else {
        // FIXED - the profitValue is a fixed amount to add
        // ensure we convert the profits to NGN
        profit = rule.profitValue / 1400;
      }
      appliedRule = rule;

      console.log(
        `[PricingService] Rule applied: ${rule.id} (${
          rule.serviceCode || "*"
        }/${rule.country || "*"}) - ${rule.profitType} ${rule.profitValue}${
          rule.profitType === "PERCENTAGE" ? "%" : ""
        }`
      );
    } else {
      // No rule found, apply default markup
      profit = basePrice * (DEFAULT_MARKUP.profitValue / 100);
      console.log(
        `[PricingService] No rule found, using default ${DEFAULT_MARKUP.profitValue}% markup`
      );
    }

    const finalPrice = basePrice + profit;

    return {
      basePrice,
      profit,
      finalPrice,
      ruleApplied: appliedRule,
    };
  }

  /**
   * Batch calculate prices for multiple services.
   * Optimized to fetch pricing rules once and apply them to all services.
   *
   * @param services - Array of {basePrice, serviceCode, country}
   * @returns Array of PricingResult for each service
   */
  static async calculatePrices(
    services: Array<{
      basePrice: number;
      serviceCode: string;
      country: string;
    }>
  ): Promise<PricingResult[]> {
    // Fetch all active pricing rules once
    const allRules = await prisma.pricingRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });

    const results: PricingResult[] = [];

    for (const service of services) {
      // Find matching rules for this service
      const matchingRules = allRules.filter((rule) => {
        const serviceMatch =
          rule.serviceCode === null || rule.serviceCode === service.serviceCode;
        const countryMatch =
          rule.country === null || rule.country === service.country;
        return serviceMatch && countryMatch;
      });

      let profit = 0;
      let appliedRule: PricingResult["ruleApplied"] = null;

      if (matchingRules.length > 0) {
        // Score and select best rule
        const scoreRule = (rule: (typeof allRules)[0]): number => {
          let score = rule.priority * 100;
          if (rule.serviceCode && rule.country) score += 1000;
          else if (rule.serviceCode) score += 500;
          else if (rule.country) score += 250;
          return score;
        };

        const scoredRules = matchingRules.map((rule) => ({
          rule,
          score: scoreRule(rule),
        }));
        scoredRules.sort((a, b) => b.score - a.score);

        const bestRule = scoredRules[0].rule;

        if (bestRule.profitType === "PERCENTAGE") {
          profit = service.basePrice * (Number(bestRule.profitValue) / 100);
        } else {
          profit = Number(bestRule.profitValue);
        }

        appliedRule = {
          id: bestRule.id,
          serviceCode: bestRule.serviceCode,
          country: bestRule.country,
          profitType: bestRule.profitType,
          profitValue: Number(bestRule.profitValue),
          priority: bestRule.priority,
        };
      } else {
        // Apply default markup
        profit = service.basePrice * (DEFAULT_MARKUP.profitValue / 100);
      }

      results.push({
        basePrice: service.basePrice,
        profit,
        finalPrice: service.basePrice + profit,
        ruleApplied: appliedRule,
      });
    }

    return results;
  }

  /**
   * Get all active pricing rules for display/debugging purposes.
   */
  static async getAllActiveRules() {
    return await prisma.pricingRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }
}
