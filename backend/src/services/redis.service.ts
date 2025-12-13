// ============================================
// REDIS SERVICE - Caching & Session Management
// ============================================

import Redis from "ioredis";

export class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      console.log("✅ Redis connected");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      console.error("❌ Redis error:", error);
    });
  }

  // ============================================
  // BASIC OPERATIONS
  // ============================================

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
    }
  }

  async del(...keys: string[]): Promise<number> {
    try {
      return await this.client.del(...keys);
    } catch (error) {
      console.error(`Redis DEL error:`, error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error:`, error);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      console.error(`Redis EXPIRE error:`, error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`Redis KEYS error:`, error);
      return [];
    }
  }

  // ============================================
  // PRICING CACHE
  // ============================================

  async getPricing(
    provider: string,
    service: string,
    country: string
  ): Promise<any> {
    const key = `pricing:${provider}:${service}:${country}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setPricing(
    provider: string,
    service: string,
    country: string,
    pricing: any,
    ttl: number = 300
  ): Promise<void> {
    const key = `pricing:${provider}:${service}:${country}`;
    await this.set(key, JSON.stringify(pricing), ttl);
  }

  async invalidatePricing(
    provider?: string,
    service?: string,
    country?: string
  ): Promise<void> {
    let pattern = "pricing:";
    if (provider) pattern += `${provider}:`;
    else pattern += "*:";
    if (service) pattern += `${service}:`;
    else pattern += "*:";
    if (country) pattern += country;
    else pattern += "*";

    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await this.del(...keys);
    }
  }

  // ============================================
  // SERVICE AVAILABILITY CACHE
  // ============================================

  async getServiceAvailability(
    provider: string,
    service: string,
    country: string
  ): Promise<boolean | null> {
    const key = `service:available:${provider}:${service}:${country}`;
    const cached = await this.get(key);
    return cached ? cached === "true" : null;
  }

  async setServiceAvailability(
    provider: string,
    service: string,
    country: string,
    available: boolean,
    ttl: number = 60
  ): Promise<void> {
    const key = `service:available:${provider}:${service}:${country}`;
    await this.set(key, available.toString(), ttl);
  }

  // ============================================
  // PROVIDER HEALTH CACHE
  // ============================================

  async getProviderHealth(provider: string): Promise<string | null> {
    const key = `provider:health:${provider}`;
    return await this.get(key);
  }

  async setProviderHealth(
    provider: string,
    status: string,
    ttl: number = 60
  ): Promise<void> {
    const key = `provider:health:${provider}`;
    await this.set(key, status, ttl);
  }

  // ============================================
  // ORDER STATUS CACHE
  // ============================================

  async getOrderStatus(orderId: string): Promise<any> {
    const key = `order:status:${orderId}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setOrderStatus(
    orderId: string,
    status: any,
    ttl: number = 300
  ): Promise<void> {
    const key = `order:status:${orderId}`;
    await this.set(key, JSON.stringify(status), ttl);
  }

  async invalidateOrder(orderId: string): Promise<void> {
    const key = `order:status:${orderId}`;
    await this.del(key);
  }

  // ============================================
  // USER BALANCE CACHE
  // ============================================

  async getUserBalance(userId: string): Promise<number | null> {
    const key = `user:balance:${userId}`;
    const cached = await this.get(key);
    return cached ? parseFloat(cached) : null;
  }

  async setUserBalance(
    userId: string,
    balance: number,
    ttl: number = 30
  ): Promise<void> {
    const key = `user:balance:${userId}`;
    await this.set(key, balance.toString(), ttl);
  }

  async invalidateUserBalance(userId: string): Promise<void> {
    const key = `user:balance:${userId}`;
    await this.del(key);
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  async incrementRateLimit(
    userId: string,
    action: string,
    windowSeconds: number
  ): Promise<number> {
    const key = `rate:${action}:${userId}`;
    const count = await this.client.incr(key);

    if (count === 1) {
      await this.expire(key, windowSeconds);
    }

    return count;
  }

  async getRateLimitCount(userId: string, action: string): Promise<number> {
    const key = `rate:${action}:${userId}`;
    const count = await this.get(key);
    return count ? parseInt(count) : 0;
  }

  async resetRateLimit(userId: string, action: string): Promise<void> {
    const key = `rate:${action}:${userId}`;
    await this.del(key);
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async setSession(token: string, data: any, ttl: number = 900): Promise<void> {
    const key = `session:${token}`;
    await this.set(key, JSON.stringify(data), ttl);
  }

  async getSession(token: string): Promise<any> {
    const key = `session:${token}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async deleteSession(token: string): Promise<void> {
    const key = `session:${token}`;
    await this.del(key);
  }

  // ============================================
  // ANALYTICS CACHE
  // ============================================

  async cacheAnalytics(
    cacheKey: string,
    data: any,
    ttl: number = 3600
  ): Promise<void> {
    const key = `analytics:${cacheKey}`;
    await this.set(key, JSON.stringify(data), ttl);
  }

  async getAnalyticsCache(cacheKey: string): Promise<any> {
    const key = `analytics:${cacheKey}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  // ============================================
  // CLEANUP & UTILITIES
  // ============================================

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// Singleton instance
let redisInstance: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!redisInstance) {
    redisInstance = new RedisService();
  }
  return redisInstance;
}
