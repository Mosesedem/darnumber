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

// SMS-Man API v2.0 Integration - Simplified and Optimized
export class SMSManService {
  private apiUrl = "https://api.sms-man.com/control";
  private apiKey = process.env.SMSMAN_API_KEY || "";

  async getAvailableServices() {
    console.log("[SMSManService] Starting optimized service fetch...");

    try {
      if (!this.apiKey) {
        throw new Error("SMS-Man API key not configured");
      }

      // Fetch all data in parallel for better performance
      const [countriesRes, applicationsRes, pricesRes] = await Promise.all([
        fetch(`${this.apiUrl}/countries?token=${this.apiKey}`),
        fetch(`${this.apiUrl}/applications?token=${this.apiKey}`),
        fetch(`${this.apiUrl}/get-prices?token=${this.apiKey}`),
      ]);

      if (!countriesRes.ok || !applicationsRes.ok || !pricesRes.ok) {
        throw new Error("Failed to fetch data from SMS-Man API");
      }

      const [countriesData, applicationsData, pricesData] = await Promise.all([
        countriesRes.json(),
        applicationsRes.json(),
        pricesRes.json(),
      ]);

      // Convert API objects to arrays - SMS-Man returns {id: {data}} format
      const countries = Object.values(countriesData);
      const applications = Object.values(applicationsData);

      console.log(
        `[SMSManService] Loaded ${countries.length} countries, ${applications.length} applications`
      );

      // Create lookup maps for fast processing
      const countriesMap = new Map();
      const applicationsMap = new Map();

      countries.forEach((c: any) => {
        countriesMap.set(c.id.toString(), {
          title: c.title,
          code: c.code,
        });
      });

      applications.forEach((a: any) => {
        applicationsMap.set(a.id, {
          name: a.title || a.name,
          code: a.code,
        });
      });

      // Process pricing data efficiently
      const services: any[] = [];

      Object.entries(pricesData).forEach(
        ([countryId, countryServices]: any) => {
          const country = countriesMap.get(countryId);
          if (!country || typeof countryServices !== "object") return;

          Object.entries(countryServices).forEach(
            ([applicationId, serviceData]: any) => {
              if (!serviceData?.count || serviceData.count <= 0) return;

              const application = applicationsMap.get(applicationId);
              if (!application) return;

              // SMS-Man prices are in Russian Rubles (RUB)
              // Return raw RUB price - conversion RUB→USD→NGN happens in frontend
              const priceRUB = parseFloat(serviceData.cost);

              services.push({
                code: application.code || `app_${applicationId}`,
                name: application.name,
                country: country.code,
                countryName: country.title,
                price: priceRUB, // Raw RUB price
                count: serviceData.count,
                providerId: "sms-man",
                currency: "RUB",
              });
            }
          );
        }
      );

      console.log(
        `[SMSManService] Successfully processed ${services.length} services`
      );
      return services;
    } catch (err) {
      console.error("[SMSManService] Error:", err);
      throw new Error(
        `SMS-Man API failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
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

// TextVerified provider adapter - USA only
export class TextVerifiedService {
  private apiUrl = "https://www.textverified.com/api/pub/v2";
  private apiKey = process.env.TEXTVERIFIED_API_KEY || "";
  private apiUsername = process.env.TEXTVERIFIED_USERNAME || "";
  private bearerToken: string | null = null;
  private tokenExpiry: number = 0;

  // Generate bearer token using X-API-KEY and X-API-USERNAME
  private async getBearerToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.bearerToken && Date.now() < this.tokenExpiry) {
      console.log("[TextVerified] Using cached bearer token");
      return this.bearerToken;
    }

    console.log("[TextVerified] Generating new bearer token...");

    if (!this.apiKey || !this.apiUsername) {
      throw new Error("TextVerified API key or username not configured");
    }

    const authUrl = `${this.apiUrl}/auth`;
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "X-API-USERNAME": this.apiUsername,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to generate bearer token: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    this.bearerToken = data.token || data.bearerToken || data.access_token;

    if (!this.bearerToken) {
      throw new Error("Bearer token not found in response");
    }

    // Cache token for 50 minutes (assuming 60min expiry)
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;
    console.log("[TextVerified] ✓ Bearer token generated successfully");

    return this.bearerToken;
  }

  async getAvailableServices() {
    console.log("\n╔═══════════════════════════════════════════════╗");
    console.log("║ TextVerified - Fetching ALL Available Services");
    console.log("╚═══════════════════════════════════════════════╝");

    try {
      // Generate bearer token
      const bearerToken = await this.getBearerToken();

      // Fetch services list - using correct endpoint
      const servicesParams = new URLSearchParams({
        numberType: "mobile",
        reservationType: "verification",
      }).toString();
      const servicesUrl = `${this.apiUrl}/services?${servicesParams}`;
      console.log(`[TextVerified] Fetching services from: ${servicesUrl}`);

      const servicesResponse = await fetch(servicesUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log(
        `[TextVerified] Services response: ${servicesResponse.status} ${servicesResponse.statusText}`
      );

      if (!servicesResponse.ok) {
        const errorText = await servicesResponse.text();
        console.error(`[TextVerified] API Error: ${servicesResponse.status}`);
        console.error(`[TextVerified] Error body:`, errorText);
        throw new Error(
          `TextVerified API error: ${servicesResponse.status} - ${errorText}`
        );
      }

      const servicesData = await servicesResponse.json();
      // Try to extract list from multiple possible shapes
      const extractServices = (data: any) => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.data?.items)) return data.data.items;
        return [];
      };
      const servicesList = extractServices(servicesData);

      console.log(
        `[TextVerified] Total services found: ${servicesList.length}`
      );

      if (servicesList.length === 0) {
        console.warn(`[TextVerified] ⚠️  No services returned from API`);
        console.warn(
          `[TextVerified] Raw services payload keys: ${Object.keys(
            servicesData || {}
          ).join(", ")}`
        );
        console.warn(
          `[TextVerified] Raw:`,
          JSON.stringify(servicesData).slice(0, 1000)
        );
        return [];
      }

      // Fetch pricing for each service with rate limiting
      console.log(`[TextVerified] Fetching pricing with rate limiting...`);
      const pricingUrl = `${this.apiUrl}/pricing/verifications`;
      
      // Rate limiting configuration
      const BATCH_SIZE = 10; // Process 10 services at a time
      const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
      const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between individual requests
      const MAX_SERVICES = 500; // Limit to first 500 services for reasonable load time

      // Limit services to process
      const limitedServicesList = servicesList.slice(0, MAX_SERVICES);
      console.log(`[TextVerified] Processing ${limitedServicesList.length} of ${servicesList.length} services (limited for performance)`);

      // Helper: delay function
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Helper: robust pricing fetch trying id-based first, then fallbacks
      const fetchPricing = async (
        svc: any,
        idx: number,
        retries = 2
      ): Promise<null | { price: number; raw?: any }> => {
        const svcName = svc.serviceName || svc.name || svc.title || "";
        const svcId = svc.id || svc.serviceId || svc.targetId || null;
        const capability = svc.capability || "sms";

        const common = {
          areaCode: false,
          carrier: false,
          numberType: "mobile",
          capability,
        } as any;

        const payloads: any[] = [];
        if (svcId) payloads.push({ ...common, serviceId: svcId });
        if (svcName) payloads.push({ ...common, serviceName: svcName });

        let lastStatus = 0;
        let lastBody: string | undefined;
        
        for (const body of payloads) {
          try {
            const res = await fetch(pricingUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
            lastStatus = res.status;
            
            // Handle rate limiting with retry
            if (res.status === 429 && retries > 0) {
              const retryAfter = parseInt(res.headers.get('Retry-After') || '5');
              await delay(retryAfter * 1000);
              return fetchPricing(svc, idx, retries - 1);
            }
            
            if (!res.ok) {
              lastBody = await res.text().catch(() => undefined);
              continue;
            }
            
            const data = await res.json().catch(() => ({}));
            const priceCandidate =
              (typeof data.price === "number" && data.price) ||
              (typeof data.price === "string" && parseFloat(data.price)) ||
              (Array.isArray(data?.prices) &&
                data.prices.length > 0 &&
                parseFloat(data.prices[0]?.price)) ||
              0;
            const price = Number.isFinite(priceCandidate)
              ? Number(priceCandidate)
              : 0;
            if (!price || price <= 0) {
              continue;
            }
            
            if ((idx + 1) % 50 === 0) {
              console.log(`[TextVerified] Processed ${idx + 1}/${limitedServicesList.length} services...`);
            }
            return { price, raw: data };
          } catch (e) {
            // Retry on error
            if (retries > 0) {
              await delay(1000);
              return fetchPricing(svc, idx, retries - 1);
            }
          }
        }
        return null;
      };

      // Process services in batches with rate limiting
      const servicesWithPricing: any[] = [];
      const totalBatches = Math.ceil(limitedServicesList.length / BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, limitedServicesList.length);
        const batch = limitedServicesList.slice(start, end);
        
        console.log(`[TextVerified] Processing batch ${batchIndex + 1}/${totalBatches} (services ${start + 1}-${end})...`);
        
        // Process batch sequentially with small delays
        for (let i = 0; i < batch.length; i++) {
          const service = batch[i];
          const globalIndex = start + i;
          const pricing = await fetchPricing(service, globalIndex);
          
          // Only include services with valid pricing
          if (pricing && pricing.price > 0) {
            servicesWithPricing.push({
              code: service.serviceName || service.name || service.id,
              name: service.serviceName || service.name || `${service.id}`,
              country: "US",
              countryName: "United States",
              price: pricing.price,
              count: 100,
              providerId: "textverified",
              currency: "USD",
              capability: service.capability || "sms",
            });
          }
          
          // Small delay between requests
          if (i < batch.length - 1) {
            await delay(DELAY_BETWEEN_REQUESTS);
          }
        }
        
        // Delay between batches (except for the last batch)
        if (batchIndex < totalBatches - 1) {
          await delay(DELAY_BETWEEN_BATCHES);
        }
      }

      const services = servicesWithPricing;

      console.log(
        `\n[TextVerified] ✅ Successfully processed ${services.length} services with pricing`
      );
      console.log("╚═══════════════════════════════════════════════╝\n");

      return services;
    } catch (err) {
      console.error("\n[TextVerified] ❌ FATAL ERROR");
      console.error(
        "[TextVerified] Error:",
        err instanceof Error ? err.message : err
      );
      if (err instanceof Error) {
        console.error("[TextVerified] Stack:", err.stack);
      }
      console.log("╚═══════════════════════════════════════════════╝\n");

      return [];
    }
  }

  async requestNumber(serviceCode: string, country: string) {
    console.log("[TextVerifiedService] requestNumber", {
      serviceCode,
      country,
    });
    throw new Error("TextVerified integration not fully implemented yet");
  }
}
