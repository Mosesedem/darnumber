// ============================================
// SMS-MAN PROVIDER SERVICE (Enhanced)
// ============================================

export class SMSManService {
  private apiUrl = "https://api.sms-man.com/control";
  private apiKey = process.env.SMSMAN_API_KEY!;

  /**
   * Request a phone number from SMS-Man
   */
  async requestNumber(serviceCode: string, country: string) {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-number?token=${
          this.apiKey
        }&country_id=${this.getCountryId(
          country
        )}&application_id=${this.getServiceId(serviceCode)}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

      if (data.error_code) {
        throw new Error(data.error || "Failed to request number");
      }

      return {
        id: data.request_id.toString(),
        phoneNumber: data.number,
      };
    } catch (error: any) {
      throw new Error(`SMS-Man API error: ${error.message}`);
    }
  }

  /**
   * Check if SMS has been received
   */
  async getSMS(requestId: string) {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-sms?token=${this.apiKey}&request_id=${requestId}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

      if (data.sms_code) {
        return {
          received: true,
          code: data.sms_code,
          text: data.sms_text || data.sms_code,
        };
      }

      return { received: false };
    } catch (error) {
      console.error("SMS-Man getSMS error:", error);
      return { received: false };
    }
  }

  /**
   * Close/cancel a request
   */
  async closeRequest(requestId: string) {
    try {
      await fetch(
        `${this.apiUrl}/set-status?token=${this.apiKey}&request_id=${requestId}&status=close`,
        {
          method: "GET",
        }
      );
    } catch (error) {
      console.error("SMS-Man closeRequest error:", error);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-balance?token=${this.apiKey}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      return data.balance || 0;
    } catch (error) {
      console.error("SMS-Man getBalance error:", error);
      return 0;
    }
  }

  /**
   * Get available services
   */
  async getServices() {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-services?token=${this.apiKey}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      return data.services || [];
    } catch (error) {
      console.error("SMS-Man getServices error:", error);
      return [];
    }
  }

  /**
   * Get pricing for a service
   */
  async getPricing(serviceCode: string, country: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-prices?token=${
          this.apiKey
        }&country_id=${this.getCountryId(
          country
        )}&application_id=${this.getServiceId(serviceCode)}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      return data.price || 0;
    } catch (error) {
      console.error("SMS-Man getPricing error:", error);
      return 0;
    }
  }

  /**
   * Check service availability
   */
  async checkAvailability(
    serviceCode: string,
    country: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/get-availability?token=${
          this.apiKey
        }&country_id=${this.getCountryId(
          country
        )}&application_id=${this.getServiceId(serviceCode)}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      return data.available === true;
    } catch (error) {
      console.error("SMS-Man checkAvailability error:", error);
      return false;
    }
  }

  /**
   * Map country codes to SMS-Man IDs
   */
  private getCountryId(country: string): string {
    const countryMap: Record<string, string> = {
      US: "1",
      GB: "2",
      UK: "2",
      RU: "3",
      CA: "4",
      FR: "5",
      DE: "6",
      IT: "7",
      ES: "8",
      NL: "9",
      PL: "10",
      BR: "11",
      MX: "12",
      IN: "13",
      CN: "14",
      JP: "15",
      AU: "16",
      AR: "17",
      TR: "18",
      SA: "19",
      ZA: "20",
    };
    return countryMap[country.toUpperCase()] || "1";
  }

  /**
   * Map service codes to SMS-Man application IDs
   */
  private getServiceId(serviceCode: string): string {
    const serviceMap: Record<string, string> = {
      google: "go",
      facebook: "fb",
      whatsapp: "wa",
      instagram: "ig",
      twitter: "tw",
      telegram: "tg",
      discord: "ds",
      tiktok: "tt",
      snapchat: "sc",
      microsoft: "mm",
      amazon: "am",
      uber: "ub",
      lyft: "ly",
      linkedin: "li",
      yahoo: "ya",
      paypal: "pp",
      netflix: "nf",
      spotify: "sp",
      apple: "ap",
      samsung: "ss",
      nike: "nk",
      ebay: "eb",
      airbnb: "ab",
      tinder: "tn",
      coinbase: "cb",
      binance: "bn",
      cashapp: "ca",
      venmo: "vm",
    };
    return serviceMap[serviceCode.toLowerCase()] || serviceCode;
  }
}
