// ============================================
// API CLIENT - Axios Configuration
// ============================================

import axios, { AxiosError, AxiosInstance } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<any>) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshed = await this.refreshToken();
          if (refreshed && error.config) {
            return this.client.request(error.config);
          }
          // Redirect to login
          this.clearAuth();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  private clearAuth(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      if (response.data.success) {
        this.setTokens(
          response.data.data.accessToken,
          response.data.data.refreshToken
        );
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // AUTH METHODS
  // ============================================

  async register(data: {
    email: string;
    password: string;
    userName: string;
    phone?: string;
    country?: string;
    referralCode?: string;
  }) {
    const response = await this.client.post("/auth/register", data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post("/auth/login", { email, password });
    if (response.data.success) {
      this.setTokens(
        response.data.data.accessToken,
        response.data.data.refreshToken
      );
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(response.data.data.user));
      }
    }
    return response.data;
  }

  async logout() {
    try {
      await this.client.post("/auth/logout");
    } finally {
      this.clearAuth();
    }
  }

  async getCurrentUser() {
    const response = await this.client.get("/auth/me");
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post("/auth/password/change", {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  async requestPasswordReset(email: string) {
    const response = await this.client.post("/auth/password-reset/request", {
      email,
    });
    return response.data;
  }

  // ============================================
  // ORDER METHODS
  // ============================================

  async createOrder(data: {
    serviceCode: string;
    country: string;
    provider?: string;
  }) {
    const response = await this.client.post("/orders", data);
    return response.data;
  }

  async getOrders(page: number = 1, limit: number = 20) {
    const response = await this.client.get("/orders", {
      params: { page, limit },
    });
    return response.data;
  }

  async getOrder(orderId: string) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  async cancelOrder(orderId: string) {
    const response = await this.client.post(`/orders/${orderId}/cancel`);
    return response.data;
  }

  async getAvailableServices(country?: string, serviceCode?: string) {
    const response = await this.client.get("/orders/services/available", {
      params: { country, serviceCode },
    });
    return response.data;
  }

  // ============================================
  // USER METHODS
  // ============================================

  async getProfile() {
    const response = await this.client.get("/users/profile");
    return response.data;
  }

  async updateProfile(data: {
    userName?: string;
    phone?: string;
    country?: string;
  }) {
    const response = await this.client.patch("/users/profile", data);
    return response.data;
  }

  async getBalance() {
    const response = await this.client.get("/users/balance");
    return response.data;
  }

  async getTransactions(page: number = 1, limit: number = 20) {
    const response = await this.client.get("/users/transactions", {
      params: { page, limit },
    });
    return response.data;
  }

  async updateBankDetails(data: {
    bankAccount: string;
    accountNumber: string;
    bankName: string;
  }) {
    const response = await this.client.patch("/users/bank-details", data);
    return response.data;
  }

  async getReferrals() {
    const response = await this.client.get("/users/referrals");
    return response.data;
  }

  async getUserStats() {
    const response = await this.client.get("/users/stats");
    return response.data;
  }

  async getActivity(page: number = 1, limit: number = 20) {
    const response = await this.client.get("/users/activity", {
      params: { page, limit },
    });
    return response.data;
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  async createPaymentIntent(amount: number, currency: string = "USD") {
    const response = await this.client.post("/payments/deposit", {
      amount,
      currency,
    });
    return response.data;
  }

  async requestWithdrawal(data: {
    amount: number;
    bankDetails: {
      accountNumber: string;
      bankName: string;
      accountName: string;
    };
  }) {
    const response = await this.client.post("/payments/withdraw", data);
    return response.data;
  }

  async getPaymentHistory(page: number = 1, limit: number = 20) {
    const response = await this.client.get("/payments/history", {
      params: { page, limit },
    });
    return response.data;
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  async getDashboard(days: number = 30) {
    const response = await this.client.get("/admin/dashboard", {
      params: { days },
    });
    return response.data;
  }

  async getUsers(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get("/admin/users", { params });
    return response.data;
  }

  async getUserDetails(userId: string) {
    const response = await this.client.get(`/admin/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: string, data: any) {
    const response = await this.client.patch(`/admin/users/${userId}`, data);
    return response.data;
  }

  async adjustBalance(userId: string, amount: number, reason: string) {
    const response = await this.client.post(
      `/admin/users/${userId}/adjust-balance`,
      { amount, reason }
    );
    return response.data;
  }

  async getAdminOrders(params?: any) {
    const response = await this.client.get("/admin/orders", { params });
    return response.data;
  }

  async getOrderStats(startDate?: string, endDate?: string) {
    const response = await this.client.get("/admin/orders/stats", {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getPricingRules() {
    const response = await this.client.get("/admin/pricing-rules");
    return response.data;
  }

  async createPricingRule(data: any) {
    const response = await this.client.post("/admin/pricing-rules", data);
    return response.data;
  }

  async updatePricingRule(ruleId: string, data: any) {
    const response = await this.client.patch(
      `/admin/pricing-rules/${ruleId}`,
      data
    );
    return response.data;
  }

  async deletePricingRule(ruleId: string) {
    const response = await this.client.delete(`/admin/pricing-rules/${ruleId}`);
    return response.data;
  }

  async getProviders() {
    const response = await this.client.get("/admin/providers");
    return response.data;
  }

  async updateProvider(providerId: string, data: any) {
    const response = await this.client.patch(
      `/admin/providers/${providerId}`,
      data
    );
    return response.data;
  }

  async syncProvider(providerId: string) {
    const response = await this.client.post(
      `/admin/providers/${providerId}/sync`
    );
    return response.data;
  }

  async getActivityLogs(params?: any) {
    const response = await this.client.get("/admin/logs/activity", { params });
    return response.data;
  }

  async getSystemLogs(params?: any) {
    const response = await this.client.get("/admin/logs/system", { params });
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
