import { prisma } from "@/lib/server/prisma";
import { RedisService } from "@/lib/server/services/redis.service";

const redis = new RedisService();

interface CreateOrderInput {
  userId: string;
  serviceCode: string;
  country: string;
  preferredProvider?: string;
}

export class OrderService {
  async createOrder(input: CreateOrderInput) {
    const { userId, serviceCode, country, preferredProvider } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, currency: true },
    });
    if (!user) throw new Error("User not found");

    const providers = await this.getAvailableProviders(
      serviceCode,
      country,
      preferredProvider
    );
    if (!providers.length)
      throw new Error("No providers available for this service");

    const pricing = await this.calculatePricing(
      providers[0].id,
      serviceCode,
      country
    );
    if (Number(user.balance) < Number(pricing.finalPrice))
      throw new Error("Insufficient balance");

    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: pricing.finalPrice } },
      });
      await tx.transaction.create({
        data: {
          userId,
          transactionNumber: `TXN-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          type: "ORDER_PAYMENT",
          amount: pricing.finalPrice,
          currency: user.currency,
          balanceBefore: user.balance,
          balanceAfter: Number(user.balance) - Number(pricing.finalPrice),
          status: "COMPLETED",
          description: `Order for ${serviceCode} - ${country}`,
        },
      });
      const newOrder = await tx.order.create({
        data: {
          userId,
          providerId: providers[0].id,
          serviceId: providers[0].services[0].id,
          orderNumber: `ORD-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          serviceCode,
          country,
          baseCost: pricing.baseCost,
          profit: pricing.profit,
          finalPrice: pricing.finalPrice,
          currency: user.currency,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        },
      });
      return newOrder;
    });

    try {
      // Decide provider adapter based on selected provider
      const selectedProvider = providers[0];
      const provName = (selectedProvider.name || "").toLowerCase();
      console.log("[OrderService] Selected provider:", selectedProvider);

      const useLion = provName.includes("lion") || provName.includes("sms-man");
      const usePanda =
        provName.includes("panda") || provName.includes("textverified");

      const providerService = useLion
        ? new SMSManService()
        : new TextVerifiedService();

      console.log(
        "[OrderService] Requesting number from",
        useLion ? "Lion (SMS-Man)" : "Panda (TextVerified)",
        { serviceCode, country }
      );

      const providerOrder = await providerService.requestNumber(
        serviceCode,
        country
      );
      await prisma.order.update({
        where: { id: order.id },
        data: {
          providerOrderId: providerOrder.id,
          phoneNumber: providerOrder.phoneNumber,
          status: "WAITING_SMS",
        },
      });
      await redis.setOrderStatus(
        order.id,
        { status: "WAITING_SMS", phoneNumber: providerOrder.phoneNumber },
        300
      );
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        phoneNumber: providerOrder.phoneNumber,
        status: "WAITING_SMS",
        expiresAt: order.expiresAt,
      };
    } catch (e) {
      console.error("[OrderService] Provider request failed:", e);
      await this.refundOrder(order.id);
      throw new Error("Failed to create order with provider");
    }
  }

  async getAvailableProviders(
    serviceCode: string,
    country: string,
    preferred?: string
  ) {
    const cacheKey = `providers:available:${serviceCode}:${country}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const providers = await prisma.provider.findMany({
      where: {
        isActive: true,
        healthStatus: "HEALTHY",
        ...(preferred && { name: preferred }),
        services: {
          some: { serviceCode, country, isActive: true, available: true },
        },
      },
      include: { services: { where: { serviceCode, country } } },
      orderBy: { priority: "desc" },
    });
    await redis.set(cacheKey, JSON.stringify(providers), 60);
    return providers;
  }

  async calculatePricing(
    providerId: string,
    serviceCode: string,
    country: string
  ) {
    const cacheKey = `pricing:${providerId}:${serviceCode}:${country}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const providerPrice = await prisma.providerPrice.findFirst({
      where: { providerId, serviceCode, country },
    });
    if (!providerPrice) throw new Error("Pricing not available");

    const pricingRule = await prisma.pricingRule.findFirst({
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

    let profit = 0;
    if (pricingRule) {
      if (pricingRule.profitType === "PERCENTAGE") {
        profit =
          Number(providerPrice.baseCost) *
          (Number(pricingRule.profitValue) / 100);
      } else {
        profit = Number(pricingRule.profitValue);
      }
    }
    const finalPrice = Number(providerPrice.baseCost) + profit;
    const pricing = { baseCost: providerPrice.baseCost, profit, finalPrice };
    await redis.set(cacheKey, JSON.stringify(pricing), 300);
    return pricing;
  }

  async getOrderStatus(orderId: string) {
    console.log("[OrderService] getOrderStatus ->", { orderId });
    const cached = await redis.getOrderStatus(orderId);
    if (cached) {
      console.log("[OrderService] cache hit", cached);
      return cached;
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        phoneNumber: true,
        status: true,
        smsCode: true,
        smsText: true,
        expiresAt: true,
        createdAt: true,
        finalPrice: true,
        currency: true,
        serviceCode: true,
        country: true,
        provider: {
          select: { name: true, displayName: true },
        },
      },
    });
    if (!order) return null;
    const payload = {
      ...order,
      provider:
        order.provider?.displayName || order.provider?.name || undefined,
    } as any;
    delete (payload as any).provider?.displayName;
    delete (payload as any).provider?.name;
    await redis.setOrderStatus(orderId, payload, 300);
    console.log("[OrderService] getOrderStatus payload", payload);
    return payload;
  }

  async refundOrder(orderId: string) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });
      if (!order) return;
      await tx.order.update({
        where: { id: orderId },
        data: { status: "REFUNDED", cancelledAt: new Date() },
      });
      await tx.user.update({
        where: { id: order.userId },
        data: { balance: { increment: order.finalPrice } },
      });
      await tx.transaction.create({
        data: {
          userId: order.userId,
          transactionNumber: `REFUND-${Date.now()}`,
          type: "REFUND",
          amount: order.finalPrice,
          currency: order.currency,
          balanceBefore: order.user.balance,
          balanceAfter: Number(order.user.balance) + Number(order.finalPrice),
          orderId: order.id,
          status: "COMPLETED",
          description: `Refund for order ${order.orderNumber}`,
        },
      });
    });
    await redis.invalidateOrder(orderId);
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId, userId },
    });
    if (!order) throw new Error("Order not found");
    if (order.status !== "PENDING" && order.status !== "WAITING_SMS")
      throw new Error("Order cannot be cancelled");
    await this.refundOrder(orderId);
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return { ok: true };
  }
}

// SMS-Man API v2.0 Integration
export class SMSManService {
  private apiUrl = "https://api.sms-man.com/control";
  private apiKey = process.env.SMSMAN_API_KEY || "";

  async getAvailableServices() {
    console.log(
      "[SMSManService] getAvailableServices - Fetching from API v2.0"
    );
    try {
      if (!this.apiKey) {
        throw new Error("SMS-Man API key not configured");
      }

      // First, get list of countries
      const countriesUrl = `${this.apiUrl}/countries?token=${this.apiKey}`;
      console.log("[SMSManService] Fetching countries:", countriesUrl);
      const countriesRes = await fetch(countriesUrl);
      const countriesData = await countriesRes.json();
      console.log(
        "[SMSManService] Countries raw response type:",
        typeof countriesData
      );

      // SMS-Man API returns countries as an object with numeric keys, not an array
      let countries: any[] = [];
      if (
        typeof countriesData === "object" &&
        countriesData !== null &&
        !Array.isArray(countriesData)
      ) {
        // Convert object to array
        countries = Object.values(countriesData);
        console.log(
          "[SMSManService] Converted countries object to array, length:",
          countries.length
        );
      } else if (Array.isArray(countriesData)) {
        countries = countriesData;
        console.log(
          "[SMSManService] Countries already in array format, length:",
          countries.length
        );
      } else {
        console.error(
          "[SMSManService] Countries API error - unexpected format:",
          typeof countriesData
        );
        throw new Error(
          `SMS-Man Countries API error: Expected object or array, got ${typeof countriesData}`
        );
      }

      console.log(`[SMSManService] Found ${countries.length} countries`);

      // Get list of applications/services
      const applicationsUrl = `${this.apiUrl}/applications?token=${this.apiKey}`;
      console.log("[SMSManService] Fetching applications:", applicationsUrl);
      const applicationsRes = await fetch(applicationsUrl);
      const applicationsData = await applicationsRes.json();
      console.log(
        "[SMSManService] Applications raw response type:",
        typeof applicationsData
      );

      // SMS-Man API might return applications as an object with numeric keys, not an array
      let applications: any[] = [];
      if (
        typeof applicationsData === "object" &&
        applicationsData !== null &&
        !Array.isArray(applicationsData)
      ) {
        // Convert object to array
        applications = Object.values(applicationsData);
        console.log(
          "[SMSManService] Converted applications object to array, length:",
          applications.length
        );
      } else if (Array.isArray(applicationsData)) {
        applications = applicationsData;
        console.log(
          "[SMSManService] Applications already in array format, length:",
          applications.length
        );
      } else {
        console.error(
          "[SMSManService] Applications API error - unexpected format:",
          typeof applicationsData
        );
        throw new Error(
          `SMS-Man Applications API error: Expected object or array, got ${typeof applicationsData}`
        );
      }

      console.log(`[SMSManService] Found ${applications.length} applications`);

      // Get current prices for all countries
      const pricesUrl = `${this.apiUrl}/get-prices?token=${this.apiKey}`;
      console.log("[SMSManService] Fetching prices:", pricesUrl);
      const pricesRes = await fetch(pricesUrl);
      const pricesData = await pricesRes.json();
      console.log(
        "[SMSManService] Prices raw response:",
        JSON.stringify(pricesData).slice(0, 500) + "..."
      );

      if (typeof pricesData !== "object" || pricesData === null) {
        console.error(
          "[SMSManService] Prices API error - expected object, got:",
          typeof pricesData,
          pricesData
        );
        throw new Error(
          `SMS-Man Prices API error: Expected object, got ${typeof pricesData}`
        );
      }

      console.log("[SMSManService] Prices data received successfully");

      // Build services array from prices data
      // Format: {"0":{"1":{"cost":"15","count":6455},"2":{"cost":"50","count":124}}, "1":{"3":{"cost":"6","count":1000}}}
      // Where first key is country_id, second key is application_id
      const services: any[] = [];
      const countriesMap = new Map(
        countries.map((c: any) => [c.id.toString(), c.title])
      );
      const applicationsMap = new Map(
        applications.map((a: any) => [a.id, { name: a.name, code: a.code }])
      );

      Object.entries(pricesData).forEach(
        ([countryId, countryServices]: any) => {
          const countryName =
            countriesMap.get(countryId) || `Country_${countryId}`;
          const countryCode = this.getCountryCode(countryId);

          if (typeof countryServices === "object") {
            Object.entries(countryServices).forEach(
              ([applicationId, serviceData]: any) => {
                if (typeof serviceData === "object" && serviceData.count > 0) {
                  const application = applicationsMap.get(applicationId);
                  if (application) {
                    // Convert RUB to NGN (current rate: ~800 NGN per RUB)
                    const basePriceNGN = Math.ceil(
                      parseFloat(serviceData.cost) * 800
                    );

                    // Add profit margin: 10% + 2000 NGN
                    const profitMargin = basePriceNGN * 0.1; // 10%
                    const finalPrice = basePriceNGN + profitMargin + 2000; // + 2000 NGN

                    services.push({
                      code: application.code || `app_${applicationId}`,
                      name: application.name,
                      country: countryCode,
                      countryName: countryName,
                      price: Math.ceil(finalPrice),
                      count: serviceData.count,
                      basePrice: basePriceNGN,
                      profitMargin: Math.ceil(profitMargin),
                    });
                  }
                }
              }
            );
          }
        }
      );

      console.log(
        `[SMSManService] Parsed ${services.length} services from API`
      );
      if (services.length === 0) {
        throw new Error("No services available from SMS-Man API");
      }

      return services;
    } catch (err) {
      console.error("[SMSManService] Error fetching services:", err);
      throw err;
    }
  }

  private getCountryCode(countryId: string): string {
    // Map SMS-Man country IDs to ISO codes
    const countryMap: Record<string, string> = {
      "0": "RU", // Russia
      "1": "UA", // Ukraine
      "2": "KZ", // Kazakhstan
      "3": "CN", // China
      "4": "PH", // Philippines
      "5": "MM", // Myanmar
      "6": "ID", // Indonesia
      "7": "MY", // Malaysia
      "8": "KE", // Kenya
      "9": "TZ", // Tanzania
      "10": "VN", // Vietnam
      "11": "KG", // Kyrgyzstan
      "12": "US", // USA
      "13": "IL", // Israel
      "14": "HK", // Hong Kong
      "15": "PL", // Poland
      "16": "GB", // United Kingdom
      "17": "MG", // Madagascar
      "18": "ZA", // South Africa
      "19": "RO", // Romania
      "20": "EG", // Egypt
      "21": "IN", // India
      "22": "IE", // Ireland
      "23": "KH", // Cambodia
      "24": "LA", // Laos
      "25": "HT", // Haiti
      "26": "CI", // Ivory Coast
      "27": "GM", // Gambia
      "28": "RS", // Serbia
      "29": "YE", // Yemen
      "30": "ZM", // Zambia
      "31": "UZ", // Uzbekistan
      "32": "TJ", // Tajikistan
      "33": "EC", // Ecuador
      "34": "SV", // El Salvador
      "35": "LY", // Libya
      "36": "JM", // Jamaica
      "37": "TT", // Trinidad and Tobago
      "38": "GH", // Ghana
      "39": "AR", // Argentina
      "40": "UG", // Uganda
      "41": "ZW", // Zimbabwe
      "42": "BO", // Bolivia
      "43": "CM", // Cameroon
      "44": "MA", // Morocco
      "45": "AO", // Angola
      "46": "CA", // Canada
      "47": "MZ", // Mozambique
      "48": "NP", // Nepal
      "49": "KR", // South Korea
      "50": "TH", // Thailand
      "51": "BD", // Bangladesh
      "52": "NL", // Netherlands
      "53": "FR", // France
      "54": "DE", // Germany
      "55": "IT", // Italy
      "56": "ES", // Spain
      "57": "BR", // Brazil
      "58": "MX", // Mexico
      "59": "NG", // Nigeria
    };
    return countryMap[countryId] || "US";
  }

  async requestNumber(serviceCode: string, country: string) {
    console.log("[SMSManService] requestNumber", { serviceCode, country });

    if (!this.apiKey) {
      throw new Error("SMS-Man API key not configured");
    }

    const countryId = this.getCountryIdFromCode(country);
    const applicationId = serviceCode;

    const url = `${this.apiUrl}/get-number?token=${this.apiKey}&country_id=${countryId}&application_id=${applicationId}`;
    console.log("[SMSManService] GET", url);

    const res = await fetch(url);
    const data = await res.json();
    console.log("[SMSManService] Response", data);

    if (data.success === false || data.error_code) {
      throw new Error(data.error_msg || data.error || "Failed to get number");
    }

    return {
      id: data.request_id.toString(),
      phoneNumber: data.number,
    };
  }

  private getCountryIdFromCode(countryCode: string): string {
    // Reverse mapping from ISO code to SMS-Man country ID
    const codeMap: Record<string, string> = {
      RU: "0",
      UA: "1",
      KZ: "2",
      CN: "3",
      PH: "4",
      MM: "5",
      ID: "6",
      MY: "7",
      KE: "8",
      TZ: "9",
      VN: "10",
      KG: "11",
      US: "12",
      IL: "13",
      HK: "14",
      PL: "15",
      GB: "16",
      MG: "17",
      ZA: "18",
      RO: "19",
      EG: "20",
      IN: "21",
      IE: "22",
      KH: "23",
      LA: "24",
      HT: "25",
      CI: "26",
      GM: "27",
      RS: "28",
      YE: "29",
      ZM: "30",
      UZ: "31",
      TJ: "32",
      EC: "33",
      SV: "34",
      LY: "35",
      JM: "36",
      TT: "37",
      GH: "38",
      AR: "39",
      UG: "40",
      ZW: "41",
      BO: "42",
      CM: "43",
      MA: "44",
      AO: "45",
      CA: "46",
      MZ: "47",
      NP: "48",
      KR: "49",
      TH: "50",
      BD: "51",
      NL: "52",
      FR: "53",
      DE: "54",
      IT: "55",
      ES: "56",
      BR: "57",
      MX: "58",
      NG: "59",
    };
    return codeMap[countryCode] || "12"; // Default to US
  }
}

// Minimal TextVerified provider adapter with detailed logging
export class TextVerifiedService {
  private apiUrl = "https://api.textverified.com/v2";
  private apiKey = process.env.TEXTVERIFIED_API_KEY || "";

  async getAvailableServices() {
    console.log(
      "[TextVerifiedService] getAvailableServices - TEMPORARILY DISABLED"
    );
    // Temporarily disable TextVerified to focus on SMS-Man
    console.log(
      "[TextVerifiedService] TextVerified temporarily disabled - returning empty array"
    );
    return [];

    /* TEMPORARILY DISABLED - FIXING API ENDPOINT
      const res = await fetch(url, {
        headers: {
          "X-API-KEY": this.apiKey,
        },
      });
      const data = await res.json();
      console.log("[TextVerifiedService] Targets raw response:", data);

      if (!data.success) {
        console.error("[TextVerifiedService] API error:", data.message || data);
        throw new Error(`TextVerified API error: ${data.message || 'Unknown error'}`);
      }

      // Parse TextVerified response format
      const services: any[] = [];
      if (Array.isArray(data.targets)) {
        data.targets.forEach((target: any) => {
          // Convert USD to NGN (current rate: ~1500 NGN per USD)
          const basePriceNGN = Math.ceil(target.price * 1500);

          // Add profit margin: 10% + 2000 NGN
          const profitMargin = basePriceNGN * 0.1; // 10%
          const finalPrice = basePriceNGN + profitMargin + 2000; // + 2000 NGN

          services.push({
            code: target.name.toLowerCase(),
            name: target.name,
            country: "US", // TextVerified is USA only
            countryName: "United States",
            price: Math.ceil(finalPrice),
            basePrice: basePriceNGN,
            profitMargin: Math.ceil(profitMargin),
          });
        });
      }

      console.log(`[TextVerifiedService] Parsed ${services.length} services`);
      if (services.length === 0) {
        throw new Error("No services available from TextVerified API");
      }

      return services;
    } catch (err) {
      console.error("[TextVerifiedService] Error fetching services:", err);
      throw err;
    }
    */
  }

  async requestNumber(serviceCode: string, country: string) {
    console.log("[TextVerifiedService] requestNumber - TEMPORARILY DISABLED");
    throw new Error("TextVerified integration temporarily disabled");
  }
}
