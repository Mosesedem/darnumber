import { prisma } from "@/lib/server/prisma";
import { Prisma } from "@/app/generated/prisma";
import { RedisService } from "@/lib/server/services/redis.service";
import { TextVerifiedService } from "./textverified.service";
import { PricingService } from "./pricing.service";
import { ExchangeRateService } from "./exchange-rate.service";
import { logger } from "@/lib/logger";

const redis = new RedisService();

const REFUND_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
} as const;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isExpiredTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2028"
  );
}

/**
 * A robust fetch wrapper that handles retries with exponential backoff for network errors.
 * @param url The URL to fetch.
 * @param options The fetch options.
 * @param retries Number of retries to attempt.
 * @param backoff Initial backoff delay in ms.
 * @returns The fetch Response object.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  backoff = 300,
): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "1");
      logger.warn(
        `[fetchWithRetry] Rate limited. Retrying after ${retryAfter}s...`,
      );
      await delay(retryAfter * 1000);
      return fetchWithRetry(url, options, retries - 1, backoff);
    }
    return res;
  } catch (e: any) {
    if (
      (e.code === "ECONNRESET" || e.message.includes("fetch failed")) &&
      retries > 0
    ) {
      logger.warn(
        `[fetchWithRetry] Network error (${
          e.code || "FETCH_FAILED"
        }). Retrying in ${backoff}ms... (${retries} retries left)`,
      );
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw e;
  }
}

interface CreateOrderInput {
  userId: string;
  serviceCode: string;
  country: string;
  /** Client-supplied price in NGN — used only as a stale-price guard, never as the authoritative charge. */
  clientPriceNgn?: number;
  preferredProvider?: string;
}

export class OrderService {
  async createOrder(input: CreateOrderInput) {
    const { userId, serviceCode, country, clientPriceNgn, preferredProvider } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, currency: true },
    });
    if (!user) {
      logger.error("[Order] User not found");
      throw new Error("User not found");
    }

    const providers = await this.getAvailableProviders(
      serviceCode,
      country,
      preferredProvider,
    );
    if (!providers.length) {
      logger.error("[Order] No provider for selection", {
        serviceCode,
        country,
      });
      throw new Error("No providers available for this service and country.");
    }
    const selectedProvider = providers[0];

    const serverPriceNgn = await this.calculateAuthoritativePrice(
      serviceCode,
      country,
      selectedProvider.name,
    );
    // Guard: if the client quoted a price that is more than 10% below the server
    // price, the frontend was working off a stale cache. Reject so the user sees
    // fresh pricing before being charged.
    if (clientPriceNgn !== undefined && clientPriceNgn < serverPriceNgn * 0.90) {
      logger.warn("[Order] Quoted price is stale", { serviceCode, country });
      throw new Error(
        `Price has changed. Expected ₦${serverPriceNgn.toLocaleString()}, got ₦${clientPriceNgn.toLocaleString()}. Please refresh and try again.`,
      );
    }

    const finalPrice = new Prisma.Decimal(serverPriceNgn);
    if (user.balance.lt(finalPrice)) {
      logger.warn("[Order] Insufficient balance", { serviceCode, country });
      throw new Error("Insufficient balance");
    }

    const order = await prisma.$transaction(
      async (tx) => {
        // Debit user's balance
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: finalPrice } },
        });

        // Create a transaction record for the payment
        const transaction = await tx.transaction.create({
          data: {
            userId,
            transactionNumber: `TXN-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 9)}`,
            type: "ORDER_PAYMENT",
            amount: finalPrice,
            currency: user.currency,
            balanceBefore: user.balance,
            balanceAfter: user.balance.sub(finalPrice),
            status: "COMPLETED",
            description: `Payment for ${serviceCode} in ${country}`,
          },
        });

        // Create the order record
        const newOrder = await tx.order.create({
          data: {
            userId,
            providerId: selectedProvider.id,
            serviceCode,
            country,
            price: finalPrice,
            finalPrice: finalPrice, // Final price (same as price for now, could be different with discounts)
            transactionId: transaction.id,
            status: "PROCESSING", // Status is now 'PROCESSING'
            expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20-minute expiry
          },
        });

        return newOrder;
      },
      {
        maxWait: 10000, // Max time to wait for a transaction slot (10s)
        timeout: 15000, // Max transaction execution time (15s)
      },
    );
    const providerErrors: Array<{ provider: string; message: string }> = [];

    for (const provider of providers) {
      try {
        const providerService = this.getProviderService(provider.name);
        const providerOrder = await providerService.requestNumber(
          serviceCode,
          country,
          order.id,
        );

        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            providerId: provider.id,
            externalId: providerOrder.id,
            phoneNumber: providerOrder.phoneNumber,
            cost: providerOrder.cost
              ? new Prisma.Decimal(providerOrder.cost)
              : undefined,
            status: "WAITING_FOR_SMS",
          },
        });

        return {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          phoneNumber: updatedOrder.phoneNumber,
          status: updatedOrder.status,
          expiresAt: updatedOrder.expiresAt,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        providerErrors.push({ provider: provider.name, message });
        logger.warn("[Order] Provider declined", {
          provider: provider.name,
          serviceCode,
          country,
        });
      }
    }

    logger.error("[Order] All providers failed", {
      orderId: order.id,
      serviceCode,
      country,
    });
    await this.refundOrder(order.id, "PROVIDER_FAILURE");

    const allUnavailable =
      providerErrors.length > 0 &&
      providerErrors.every((entry) =>
        this.isProviderUnavailableError(entry.message),
      );

    if (allUnavailable) {
      throw new Error(
        "No providers currently have stock for this service. Please try again shortly.",
      );
    }

    throw new Error("Failed to secure a number from the provider.");
  }

  private isProviderUnavailableError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("unavailable") ||
      normalized.includes("out of stock") ||
      normalized.includes("sold out") ||
      normalized.includes("no stock") ||
      normalized.includes("no number") ||
      normalized.includes("no_number")
    );
  }

  private isSmsManProvider(provider: string | null | undefined): boolean {
    const name = (provider || "").toLowerCase();
    return (
      name.includes("lion") ||
      name.includes("sms-man") ||
      name === "smsman"
    );
  }

  private isTextVerifiedProvider(provider: string | null | undefined): boolean {
    const name = (provider || "").toLowerCase();
    return name.includes("panda") || name.includes("textverified");
  }

  private getProviderService(
    providerName: string,
  ): SMSManService | TextVerifiedService {
    if (this.isSmsManProvider(providerName)) {
      return new SMSManService();
    }
    if (this.isTextVerifiedProvider(providerName)) {
      return new TextVerifiedService();
    }
    throw new Error(`Unknown provider: ${providerName}`);
  }

  /**
   * Best-effort provider cancellation. Already-closed numbers are treated as success
   * so user/admin/expiry refunds can still complete.
   */
  private async cancelProviderReservation(order: {
    id: string;
    externalId?: string | null;
    providerId?: string | null;
  }): Promise<void> {
    if (!order.externalId || !order.providerId) return;

    const providerService = this.getProviderService(order.providerId);
    if (providerService instanceof SMSManService) {
      await providerService.cancelNumber(order.externalId);
    } else if (providerService instanceof TextVerifiedService) {
      await providerService.cancelVerification(order.externalId);
    }

    await prisma.systemLog.create({
      data: {
        level: "INFO",
        service: "order-processor",
        message: "Provider cancellation executed",
        metadata: {
          orderId: order.id,
          externalId: order.externalId,
          provider: order.providerId,
        },
      },
    });
  }

  /**
   * Calculates the authoritative server-side price for a service/country/provider
   * combination in NGN, with admin pricing rules applied.
   *
   * For SMS-Man: fetches the live RUB price, converts to USD, applies markup, converts to NGN.
   * For TextVerified: fetches the live USD verification price, then applies markup.
   *
   * This is the ONLY price the backend trusts for charging. The client-supplied price
   * is used only as a stale-cache guard.
   */
  async calculateAuthoritativePrice(
    serviceCode: string,
    country: string,
    providerName: string,
  ): Promise<number> {
    const normalizedProvider = providerName.toLowerCase();

    // Fetch exchange rates in parallel
    const [rubToUsdRate, usdToNgnRate] = await Promise.all([
      ExchangeRateService.getUsdToRubRate(),
      ExchangeRateService.getUsdToNgnRate(),
    ]);

    let baseUsd: number;

    let pricingCode = serviceCode;
    let pricingCountry = country;

    if (normalizedProvider.includes("sms-man") || normalizedProvider.includes("lion")) {
      // One country + one service. Do not download the full price matrix.
      const smsMan = new SMSManService();
      const priceRub = await smsMan.getPriceForService(serviceCode, country);
      baseUsd = Number((priceRub / rubToUsdRate).toFixed(6));
    } else {
      // TextVerified prices the service's real capability. Short codes such as
      // "wa" resolve to the provider's service name before the quote.
      const tv = new TextVerifiedService();
      const quote = await tv.quoteVerification(serviceCode);
      baseUsd = quote.price;
      pricingCode = quote.serviceName;
      pricingCountry = "US";
    }

    // Apply admin pricing rules: final = providerBase + markup
    // FIXED markups may be USD or NGN (converted inside PricingService)
    const pricing = await PricingService.calculatePrice(
      baseUsd,
      pricingCode,
      pricingCountry,
      usdToNgnRate,
    );
    const finalUsd = pricing.finalPrice;

    // Convert to NGN and round up to nearest whole unit
    const finalNgn = Math.ceil(finalUsd * usdToNgnRate);

    return finalNgn;
  }

  async getAvailableProviders(
    serviceCode: string,
    country: string,
    preferred?: string,
  ) {
    // Normalize preferred provider name to handle various formats
    // Frontend may send "sms-man", "textverified", "lion", "panda", etc.
    const normalizeProvider = (name?: string): string | undefined => {
      if (!name) return undefined;
      const lower = name.toLowerCase();
      if (
        lower.includes("lion") ||
        lower.includes("sms-man") ||
        lower === "sms-man"
      )
        return "sms-man";
      if (
        lower.includes("panda") ||
        lower.includes("textverified") ||
        lower === "textverified"
      )
        return "textverified";
      return lower;
    };

    const normalizedPreferred = normalizeProvider(preferred);

    // Use hardcoded providers instead of DB queries
    const availableProviders: Array<{
      id: string;
      name: string;
      priority: number;
    }> = [];

    // Check if SMS-Man (Lion) supports this country
    if (normalizedPreferred === "sms-man" || !normalizedPreferred) {
      // SMS-Man supports all countries globally
      availableProviders.push({
        id: "sms-man",
        name: "sms-man",
        priority: 1,
      });
    }

    // Check if TextVerified (Panda) supports this country
    if (
      country === "US" &&
      (normalizedPreferred === "textverified" || !normalizedPreferred)
    ) {
      availableProviders.push({
        id: "textverified",
        name: "textverified",
        priority: 2,
      });
    }

    // If a preferred provider was specified but not added, return empty
    if (normalizedPreferred && availableProviders.length === 0) {
      logger.warn(
        "[OrderService.getAvailableProviders] Preferred provider not available:",
        { preferred, normalizedPreferred, country },
      );
      return [];
    }

    // Sort by priority (higher priority first)
    return availableProviders.sort((a, b) => b.priority - a.priority);
  }

  async calculatePricing(
    providerId: string,
    serviceCode: string,
    country: string,
  ) {
    const cacheKey = `pricing:${providerId}:${serviceCode}:${country}`;

    // Cache read is best-effort — failure falls through to DB
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis unavailable — continue to DB
    }

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
    // Cache write is fire-and-forget
    redis.set(cacheKey, JSON.stringify(pricing), 300).catch(() => {});
    return pricing;
  }

  async getOrderStatus(orderId: string) {
    const TERMINAL_STATUSES = [
      "COMPLETED",
      "CANCELLED",
      "EXPIRED",
      "REFUNDED",
      "FAILED",
    ];

    // Cache is only used for terminal orders. Active orders must hit the DB so
    // SMS polling and expiry/cancellation still run.
    try {
      const cached = await redis.getOrderStatus(orderId);
      if (cached && TERMINAL_STATUSES.includes(cached.status)) {
        return cached;
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    let order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        phoneNumber: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        finalPrice: true,
        currency: true,
        serviceCode: true,
        country: true,
        providerId: true,
        externalId: true,
        smsCode: true,
        smsMessage: true,
      },
    });
    if (!order) return null;

    // Opportunistic refresh for TextVerified: number may arrive after create
    try {
      if (
        this.isTextVerifiedProvider(order.providerId) &&
        order.externalId &&
        !order.phoneNumber &&
        (order.status === "WAITING_FOR_SMS" || order.status === "PROCESSING")
      ) {
        const tv = new TextVerifiedService();
        const details = await tv.getVerificationDetails(order.externalId);
        if (details && details.number) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              phoneNumber: details.number,
              ...(details.id && details.id !== order.externalId
                ? { externalId: details.id }
                : {}),
              status:
                details.state === "verificationCompleted"
                  ? "WAITING_FOR_SMS"
                  : order.status,
            },
          });
          order.phoneNumber = details.number;
          if (details.id) order.externalId = details.id;
          order.status =
            details.state === "verificationCompleted"
              ? "WAITING_FOR_SMS"
              : order.status;
        }
      }
    } catch (e) {
      logger.warn("[OrderService] TextVerified details refresh failed", {
        orderId: order.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // If status is WAITING_FOR_SMS and no code, try to fetch code from provider
    if (order.status === "WAITING_FOR_SMS" && !order.smsCode) {
      await this.tryFetchAndUpdateSmsCode(
        order.id,
        order.providerId,
        order.externalId,
      );
      // Re-fetch after possible update
      const refreshed = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          phoneNumber: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          finalPrice: true,
          currency: true,
          serviceCode: true,
          country: true,
          providerId: true,
          externalId: true,
          smsCode: true,
          smsMessage: true,
        },
      });
      if (refreshed) {
        order = refreshed; // Update order with refreshed data
      }
    }

    // Auto-expire orders that have passed their expiry window
    // The refundOrder method has its own atomic guard to prevent double refunds,
    // so even if two concurrent requests enter this block, only one refund will process.
    if (
      order.expiresAt &&
      new Date(order.expiresAt).getTime() < Date.now() &&
      (order.status === "PENDING" ||
        order.status === "PROCESSING" ||
        order.status === "WAITING_FOR_SMS")
    ) {
      try {
        try {
          await this.cancelProviderReservation(order);
        } catch (e) {
          logger.error("[OrderService] Provider cancel on expire failed", e);
          await prisma.systemLog.create({
            data: {
              level: "WARN",
              service: "order-processor",
              message: "Auto-expire: provider cancellation failed",
              error: e instanceof Error ? e.message : String(e),
              metadata: {
                orderId: order.id,
                externalId: order.externalId,
                provider: order.providerId,
              },
            },
          });
        }

        await this.refundOrder(order.id, "EXPIRED");
        order.status = "EXPIRED";
      } catch (e) {
        logger.error(
          "[OrderService] Failed to auto-expire order",
          order.id,
          e,
        );
      }
    }

    const payload = {
      ...order,
      provider: order.providerId,
    } as any;
    delete (payload as any).providerId;
    // Cache write is fire-and-forget — order status must be readable even if Redis is down
    redis.setOrderStatus(orderId, payload, 300).catch(() => {});
    return payload;
  }

  /**
   * Try to fetch and update the SMS code for an order from the provider.
   */
  private async tryFetchAndUpdateSmsCode(
    orderId: string,
    providerId: string,
    externalId?: string | null,
  ) {
    if (!externalId) return;
    let code: string | undefined;
    let message: string | undefined;
    let status: string | undefined;
    try {
      if (this.isTextVerifiedProvider(providerId)) {
        const tv = new TextVerifiedService();
        const messages = await tv.getSmsForVerification(externalId);
        for (const msg of messages) {
          const parsed = msg.parsedCode || "";
          const content = msg.smsContent || "";
          if (parsed && /\d{3,}/.test(parsed)) {
            code = (parsed.match(/\d{3,}/) || [])[0];
            message = content || parsed;
            status = "COMPLETED";
            break;
          }
          if (content && /\d{3,}/.test(content)) {
            code = (content.match(/\d{3,}/) || [])[0];
            message = content;
            status = "COMPLETED";
            break;
          }
        }
      } else if (this.isSmsManProvider(providerId)) {
        // SMSMan: poll for code
        const apiKey = process.env.SMSMAN_API_KEY;
        if (!apiKey) return;
        const url = `https://api.sms-man.com/control/get-sms?token=${apiKey}&request_id=${externalId}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          let foundSms = null;
          if (
            data.sms_code &&
            typeof data.sms_code === "string" &&
            /\d{3,}/.test(data.sms_code)
          ) {
            foundSms = data.sms_code;
          } else if (
            data.sms &&
            typeof data.sms === "string" &&
            /\d{3,}/.test(data.sms)
          ) {
            foundSms = data.sms;
          } else if (
            data.message &&
            typeof data.message === "string" &&
            /\d{3,}/.test(data.message)
          ) {
            foundSms = data.message;
          } else if (
            data.code &&
            typeof data.code === "string" &&
            /\d{3,}/.test(data.code)
          ) {
            foundSms = data.code;
          }
          if (foundSms) {
            code = (foundSms.match(/\d{3,}/) || [])[0];
            message = foundSms;
            status = "COMPLETED";
          }
        } else {
          await res.text().catch(() => {});
        }
      }
      if (code && status) {
        await prisma.order.update({
          where: { id: orderId },
          data: { smsCode: code, smsMessage: message, status: status as any },
        });
        // Also update cache
        const updated = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNumber: true,
            phoneNumber: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            finalPrice: true,
            currency: true,
            serviceCode: true,
            country: true,
            providerId: true,
            externalId: true,
            smsCode: true,
            smsMessage: true,
          },
        });
        if (updated) {
          const payload = { ...updated, provider: updated.providerId };
          delete (payload as any).providerId;
          // Fire-and-forget — the DB is the source of truth
          redis.setOrderStatus(orderId, payload, 300).catch(() => {});
        }
      }
    } catch (e) {
      logger.warn(`[OrderService] tryFetchAndUpdateSmsCode failed`, e);
    }
  }

  async refundOrder(
    orderId: string,
    reason: "USER_CANCELLED" | "PROVIDER_FAILURE" | "EXPIRED",
  ) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              userId: true,
              price: true,
              status: true,
              user: { select: { balance: true } },
            },
          });

          if (!order) {
            logger.error(`[Refund] Order ${orderId} not found.`);
            return;
          }

          // Only refund if the order is in a refundable state
          if (
            order.status === "REFUNDED" ||
            order.status === "COMPLETED" ||
            order.status === "CANCELLED" ||
            order.status === "FAILED" ||
            order.status === "EXPIRED"
          ) {
            logger.warn(
              `[Refund] Order ${orderId} is already in a final state (${order.status}). No refund will be processed.`,
            );
            return;
          }

          // Update order status based on reason
          let newStatus: "REFUNDED" | "CANCELLED" | "FAILED" | "EXPIRED" =
            "REFUNDED";
          if (reason === "USER_CANCELLED") newStatus = "CANCELLED";
          if (reason === "PROVIDER_FAILURE") newStatus = "FAILED";
          if (reason === "EXPIRED") newStatus = "EXPIRED";

          // Atomic update: only update if order is still in a refundable state
          // This prevents race conditions where two concurrent refund attempts
          // both pass the status check above before either commits.
          const updated = await tx.order.updateMany({
            where: {
              id: orderId,
              status: {
                notIn: [
                  "REFUNDED",
                  "COMPLETED",
                  "CANCELLED",
                  "FAILED",
                  "EXPIRED",
                ],
              },
            },
            data: { status: newStatus },
          });

          // If no rows were updated, another refund already went through
          if (updated.count === 0) {
            logger.warn(
              `[Refund] Order ${orderId} was already processed by a concurrent refund. Aborting.`,
            );
            return;
          }

          // Refund the money
          const newBalance = order.user.balance.add(order.price);
          await tx.user.update({
            where: { id: order.userId },
            data: { balance: { increment: order.price } },
          });

          // Create a refund transaction
          await tx.transaction.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              transactionNumber: `REF-${Date.now()}-${order.id.slice(0, 4)}`,
              type: "REFUND",
              amount: order.price,
              currency: "NGN", // Align with system default and order currency
              balanceBefore: order.user.balance,
              balanceAfter: newBalance,
              status: "COMPLETED",
              description: `Refund for order ${order.id} due to ${reason}`,
            },
          });

          logger.info(
            `[Refund] Successfully processed refund for order ${orderId}.`,
          );
        }, REFUND_TRANSACTION_OPTIONS);
      } catch (error) {
        if (!isExpiredTransactionError(error) || attempt === 2) {
          throw error;
        }

        logger.warn(
          `[Refund] Transaction expired for order ${orderId}; retrying once...`,
        );
        await delay(250 * attempt);
      }
    }
  }

  async cancelOrder(
    orderId: string,
    userId: string,
    options?: { asAdmin?: boolean; reason?: string },
  ) {
    const order = await prisma.order.findUnique({
      where: options?.asAdmin ? { id: orderId } : { id: orderId, userId },
    });
    if (!order) throw new Error("Order not found");

    if (
      order.status !== "PENDING" &&
      order.status !== "PROCESSING" &&
      order.status !== "WAITING_FOR_SMS"
    ) {
      throw new Error(`Order is in a non-cancellable state: ${order.status}`);
    }

    const reason = options?.asAdmin
      ? options.reason || "ADMIN_CANCELLED"
      : "USER_CANCELLED";

    try {
      await this.cancelProviderReservation(order);
    } catch (e) {
      logger.error("[OrderService] Provider cancel failed", e);
      await prisma.systemLog.create({
        data: {
          level: "WARN",
          service: "order-processor",
          message: "Provider cancellation failed",
          error: e instanceof Error ? e.message : String(e),
          metadata: {
            orderId: order.id,
            externalId: order.externalId,
            provider: order.providerId,
            reason,
            asAdmin: Boolean(options?.asAdmin),
          },
        },
      });
    }

    await this.refundOrder(orderId, "USER_CANCELLED");
    await redis.invalidateOrder(orderId).catch(() => {});

    logger.info("[OrderService] Order cancelled and refunded", {
      orderId,
      provider: order.providerId,
      asAdmin: Boolean(options?.asAdmin),
      reason,
    });

    return { ok: true, message: "Order cancelled and refunded." };
  }
}

type SmsManPriceRow = {
  applicationId: string;
  countryId: string;
  countryCode: string;
  cost: number;
  count: number;
};

/**
 * SMS-Man `get-prices` is nested `{ countryId: { applicationId: row } }` when
 * the call is unfiltered or filtered by application, and flat
 * `{ applicationId: row }` when both country and application are set.
 * Application ids in `/applications` are numbers; price keys are strings.
 */
function parseSmsManPriceRows(payload: unknown): SmsManPriceRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const root = payload as Record<string, unknown>;
  if (root.success === false) {
    const msg = root.error_msg || root.error_code || "SMS-Man prices request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const rows: SmsManPriceRow[] = [];
  const push = (fallbackAppId: string, raw: Record<string, unknown>) => {
    if (!("cost" in raw)) return;
    const cost = parseFloat(String(raw.cost));
    const count = Number(raw.count ?? 0);
    if (!Number.isFinite(cost) || !Number.isFinite(count)) return;
    rows.push({
      applicationId: String(raw.application_id ?? fallbackAppId),
      countryId: String(raw.country_id ?? ""),
      countryCode: String(raw.country ?? "").toUpperCase(),
      cost,
      count,
    });
  };

  for (const [key, value] of Object.entries(root)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    if ("cost" in obj) {
      push(key, obj);
      continue;
    }
    for (const [innerKey, inner] of Object.entries(obj)) {
      if (!inner || typeof inner !== "object" || Array.isArray(inner)) continue;
      push(innerKey, inner as Record<string, unknown>);
    }
  }
  return rows;
}

export type SmsManOffer = {
  countryCode: string;
  countryName: string;
  priceRub: number;
  count: number;
};

// SMS-Man API v2.0 Integration
export class SMSManService {
  private apiUrl = "https://api.sms-man.com/control";
  private apiKey = process.env.SMSMAN_API_KEY || "";

  async getAvailableServices() {
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

      // Keys must be strings. `/applications` returns numeric ids, while
      // `get-prices` object keys are strings, and Map lookup is strict.
      const countriesMap = new Map<
        string,
        { title: string; code: string }
      >();
      const applicationsMap = new Map<
        string,
        { name: string; code: string }
      >();

      countries.forEach((c: any) => {
        if (c?.id === undefined || c?.id === null) return;
        countriesMap.set(String(c.id), {
          title: c.title,
          code: c.code,
        });
      });

      applications.forEach((a: any) => {
        if (a?.id === undefined || a?.id === null) return;
        applicationsMap.set(String(a.id), {
          name: a.title || a.name,
          code: a.code,
        });
      });

      const services: any[] = [];
      for (const row of parseSmsManPriceRows(pricesData)) {
        if (row.count <= 0 || row.cost <= 0) continue;
        const country = countriesMap.get(row.countryId);
        const application = applicationsMap.get(row.applicationId);
        if (!country || !application) continue;
        services.push({
          code: application.code || `app_${row.applicationId}`,
          name: application.name,
          country: row.countryCode || country.code,
          countryName: country.title,
          price: row.cost,
          count: row.count,
          providerId: "sms-man",
          currency: "RUB",
        });
      }

      return services;
    } catch (err) {
      logger.error("[SMSManService] Error:", err);
      throw new Error(
        `SMS-Man API failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Live RUB price for one service in one country.
   * `country_id` + `application_id` returns a single row, not the full matrix.
   */
  async getPriceForService(serviceCode: string, countryCode: string): Promise<number> {
    if (!this.apiKey) throw new Error("SMS-Man API key not configured");

    const app = await this.findApplication(serviceCode);
    if (!app) {
      throw new Error(`SMS-Man: service code "${serviceCode}" not found`);
    }

    const countryId = await this.getCountryIdFromCode(countryCode);
    const params = new URLSearchParams({
      token: this.apiKey,
      country_id: countryId,
      application_id: app.id,
    });
    const res = await fetch(`${this.apiUrl}/get-prices?${params}`);
    if (!res.ok) throw new Error(`SMS-Man prices API returned ${res.status}`);
    const rows = parseSmsManPriceRows(await res.json());
    const row =
      rows.find((r) => r.applicationId === app.id) ||
      rows.find((r) => r.cost > 0);

    if (!row || row.cost <= 0) {
      throw new Error(
        `SMS-Man: service "${serviceCode}" is not available in "${countryCode}"`,
      );
    }
    if (row.count <= 0) {
      throw new Error(
        `No numbers available for ${serviceCode} in ${countryCode}`,
      );
    }
    return row.cost;
  }

  /**
   * In-stock countries for one service. Filtered `get-prices?application_id=`
   * is tens of KB; the unfiltered matrix is tens of MB and is not used here.
   */
  async listServiceOffers(serviceCode: string): Promise<SmsManOffer[]> {
    if (!this.apiKey) throw new Error("SMS-Man API key not configured");

    const app = await this.findApplication(serviceCode);
    if (!app) return [];

    const [pricesRes, directory] = await Promise.all([
      fetch(
        `${this.apiUrl}/get-prices?token=${this.apiKey}&application_id=${app.id}`,
      ),
      this.getCountryDirectory(),
    ]);
    if (!pricesRes.ok) {
      throw new Error(`SMS-Man prices API returned ${pricesRes.status}`);
    }

    const offers: SmsManOffer[] = [];
    const seen = new Set<string>();
    for (const row of parseSmsManPriceRows(await pricesRes.json())) {
      if (row.applicationId !== app.id || row.count <= 0 || row.cost <= 0) {
        continue;
      }
      const meta = directory.byId.get(row.countryId);
      const countryCode = (row.countryCode || meta?.code || "").toUpperCase();
      if (!countryCode || seen.has(countryCode)) continue;
      seen.add(countryCode);
      offers.push({
        countryCode,
        countryName: meta?.title || countryCode,
        priceRub: row.cost,
        count: row.count,
      });
    }
    return offers;
  }

  async cancelNumber(externalId: string): Promise<void> {
    if (!this.apiKey) throw new Error("SMS-Man API key not configured");
    const url = `${this.apiUrl}/cancel-request?token=${this.apiKey}&request_id=${externalId}`;
    const res = await fetch(url, { method: "GET" });

    // Check if response is JSON before parsing
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // If the request is already closed/expired, SMS-Man may return HTML error page
      if (!res.ok) {
        logger.warn("[SMSMan] Cancel failed", { status: res.status });
        return; // Don't throw - order likely already expired on provider side
      }
    }

    const data = await res.json();
    if (data.success === false) {
      // If error is "wrong_status" or similar, it's likely already closed
      if (
        data.error_code === "wrong_status" ||
        data.error_msg?.includes("already closed")
      ) {
        logger.warn("[SMSMan] Cancel already closed", {
          status: res.status,
        });
        return; // Don't throw - this is expected for expired orders
      }
      throw new Error(data.error_msg || "Failed to cancel SMS-Man request");
    }
  }

  async requestNumber(
    serviceCode: string,
    country: string,
    orderId: string,
  ): Promise<{ id: string; phoneNumber: string; cost?: number }> {
    if (!this.apiKey) {
      logger.error("[SMSMan] API key not configured");
      throw new Error("SMS-Man API key not configured");
    }

    const app = await this.findApplication(serviceCode);
    if (!app) {
      logger.error("[SMSMan] Unknown service code", { serviceCode });
      throw new Error(`SMS-Man does not support service code: ${serviceCode}`);
    }
    const applicationId = app.id;
    const countryId = await this.getCountryIdFromCode(country);

    const url = `${this.apiUrl}/get-number?token=${this.apiKey}&country_id=${countryId}&application_id=${applicationId}&currency=RUB`;
    const res = await fetch(url);
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error(`SMS-Man get-number failed (${res.status})`);
    }

    if (!res.ok || data.success === false || data.error_code) {
      logger.warn("[SMSMan] get-number rejected", {
        serviceCode,
        country,
        status: res.status,
      });
      const code = String(data.error_code || "");
      const rawMsg = data.error_msg || data.error || "Failed to get number";
      const msg = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg);
      if (/no_?numbers?/i.test(code) || /no numbers/i.test(msg)) {
        throw new Error(
          `No numbers available for ${serviceCode} in ${country}`,
        );
      }
      throw new Error(msg);
    }
    if (!data.request_id || !data.number) {
      throw new Error("SMS-Man did not return a phone number");
    }

    return {
      id: data.request_id.toString(),
      phoneNumber: data.number,
      cost: data.cost,
    };
  }

  /**
   * Public applications list (code + display name). Small payload used for the
   * fast services catalog so the buy page doesn't wait on full get-prices.
   */
  async listApplications(): Promise<
    Array<{ id: string; code: string; name: string }>
  > {
    const cacheKey = "smsman:applications:full";

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis unavailable — continue to live API
    }

    if (!this.apiKey) throw new Error("SMS-Man API key not configured");

    const res = await fetch(`${this.apiUrl}/applications?token=${this.apiKey}`);
    if (!res.ok) {
      throw new Error(`SMS-Man applications API returned ${res.status}`);
    }
    const data = await res.json();
    const applications = Object.values(data)
      .map((a: any) => ({
        id: String(a.id),
        // Prefer `code` to match getAvailableServices() / prices mapping
        code: String(a.code || a.slug || `app_${a.id}`),
        name: String(a.title || a.name || a.code || a.slug || `app_${a.id}`),
      }))
      .filter((a) => a.code);

    redis
      .set(cacheKey, JSON.stringify(applications), 60 * 60 * 24)
      .catch(() => {});
    return applications;
  }

  private async findApplication(
    serviceCode: string,
  ): Promise<{ id: string; code: string; name: string } | null> {
    const q = serviceCode.trim().toLowerCase();
    if (!q) return null;
    const apps = await this.listApplications();
    return apps.find((a) => a.code.toLowerCase() === q) ?? null;
  }

  private async getApplications(): Promise<{ id: string; code: string }[]> {
    const full = await this.listApplications();
    return full.map((a) => ({ id: a.id, code: a.code }));
  }

  /**
   * ISO code → SMS-Man country id, plus id → display name.
   * One cached directory feeds quotes, purchases, and the country picker.
   */
  private async getCountryDirectory(): Promise<{
    byCode: Map<string, string>;
    byId: Map<string, { id: string; code: string; title: string }>;
  }> {
    const cacheKey = "smsman:country-directory";
    let rows: Array<{ id: string; code: string; title: string }> | null = null;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) rows = JSON.parse(cached);
    } catch {
      // Redis unavailable — continue to live API
    }

    if (!rows) {
      if (!this.apiKey) throw new Error("SMS-Man API key not configured");
      const res = await fetch(`${this.apiUrl}/countries?token=${this.apiKey}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch countries: ${res.status}`);
      }
      const data = await res.json();
      rows = Object.entries(data)
        .map(([key, country]: [string, any]) => ({
          id: String(country?.id ?? key),
          code: String(country?.code || "").toUpperCase(),
          title: String(country?.title || country?.name || country?.code || key),
        }))
        .filter((c) => c.code);
      redis.set(cacheKey, JSON.stringify(rows), 60 * 60 * 24).catch(() => {});
    }

    const byCode = new Map<string, string>();
    const byId = new Map<string, { id: string; code: string; title: string }>();
    for (const row of rows) {
      byCode.set(row.code, row.id);
      byId.set(row.id, row);
    }
    return { byCode, byId };
  }

  private async getCountries(): Promise<Map<string, string>> {
    const { byCode } = await this.getCountryDirectory();
    return byCode;
  }

  /**
   * Converts ISO country code to SMS-Man country ID using API data
   */
  private async getCountryIdFromCode(countryCode: string): Promise<string> {
    const countries = await this.getCountries();
    const countryId = countries.get(countryCode.toUpperCase());

    if (!countryId) {
      logger.warn(
        `[SMSManService] Country code "${countryCode}" not found in SMS-Man. Available: ${Array.from(
          countries.keys(),
        )
          .slice(0, 10)
          .join(", ")}...`,
      );
      throw new Error(`Country "${countryCode}" is not supported by SMS-Man`);
    }

    return countryId;
  }
}
