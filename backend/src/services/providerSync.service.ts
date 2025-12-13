// ============================================
// PROVIDER SYNC SERVICE
// ============================================

import { PrismaClient } from "@prisma/client";
import { RedisService } from "./redis.service";
import { SMSManService } from "./smsMan.service";
import { TextVerifiedService } from "./textVerified.service";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();
const redis = new RedisService();

/**
 * Sync services and pricing from a provider
 */
export async function syncProviderServices(providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  logger.info(`Starting sync for provider: ${provider.name}`);

  let providerService: SMSManService | TextVerifiedService;

  switch (provider.name) {
    case "sms-man":
      providerService = new SMSManService();
      break;
    case "textverified":
      providerService = new TextVerifiedService();
      break;
    default:
      throw new Error(`Unknown provider: ${provider.name}`);
  }

  try {
    // Get available services from provider
    const services = await providerService.getServices();

    logger.info(`Found ${services.length} services from ${provider.name}`);

    // Update services in database
    for (const service of services) {
      await syncService(providerId, service, providerService);
    }

    logger.info(`Sync completed for provider: ${provider.name}`);
  } catch (error: any) {
    logger.error(`Sync failed for provider ${provider.name}:`, error);
    throw error;
  }
}

async function syncService(
  providerId: string,
  serviceData: any,
  providerService: any
) {
  // Implementation would depend on provider API structure
  // This is a placeholder showing the general approach

  const serviceCode = serviceData.code || serviceData.name;
  const country = serviceData.country || "US";
  const available = serviceData.available !== false;

  // Update or create service
  await prisma.service.upsert({
    where: {
      providerId_serviceCode_country: {
        providerId,
        serviceCode,
        country,
      },
    },
    update: {
      serviceName: serviceData.name,
      available,
      isActive: true,
    },
    create: {
      providerId,
      serviceCode,
      serviceName: serviceData.name,
      country,
      available,
      isActive: true,
    },
  });

  // Get and update pricing
  try {
    const pricing = await providerService.getPricing(serviceCode, country);

    if (pricing > 0) {
      await prisma.providerPrice.upsert({
        where: {
          providerId_serviceCode_country: {
            providerId,
            serviceCode,
            country,
          },
        },
        update: {
          baseCost: pricing,
        },
        create: {
          providerId,
          serviceCode,
          country,
          baseCost: pricing,
        },
      });

      // Invalidate pricing cache
      await redis.invalidatePricing(undefined, serviceCode, country);
    }
  } catch (error) {
    logger.warn(
      `Failed to get pricing for ${serviceCode} in ${country}:`,
      error
    );
  }
}

/**
 * Check provider health status
 */
export async function checkProviderHealth(providerId: string): Promise<string> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    return "DOWN";
  }

  let providerService: SMSManService | TextVerifiedService;

  switch (provider.name) {
    case "sms-man":
      providerService = new SMSManService();
      break;
    case "textverified":
      providerService = new TextVerifiedService();
      break;
    default:
      return "DOWN";
  }

  try {
    const balance = await providerService.getBalance();

    if (balance >= 0) {
      return "HEALTHY";
    } else {
      return "DEGRADED";
    }
  } catch (error) {
    logger.error(`Health check failed for ${provider.name}:`, error);
    return "DOWN";
  }
}
