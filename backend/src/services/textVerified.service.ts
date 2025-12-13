// ============================================
// TEXTVERIFIED PROVIDER SERVICE
// ============================================

export class TextVerifiedService {
  private apiUrl = "https://www.textverified.com/api";
  private apiKey = process.env.TEXTVERIFIED_API_KEY!;
  private bearerToken = process.env.TEXTVERIFIED_BEARER_TOKEN!;

  /**
   * Request a phone number from TextVerified
   */
  async requestNumber(serviceCode: string, country: string) {
    try {
      const response = await fetch(`${this.apiUrl}/Verifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify({
          target: this.getTargetName(serviceCode),
          country_code: this.getCountryCode(country),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.message || "Failed to request number");
      }

      return {
        id: data.id.toString(),
        phoneNumber: data.number,
      };
    } catch (error: any) {
      throw new Error(`TextVerified API error: ${error.message}`);
    }
  }

  /**
   * Check if SMS has been received
   */
  async getSMS(verificationId: string) {
    try {
      const response = await fetch(
        `${this.apiUrl}/Verifications/${verificationId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { received: false };
      }

      if (data.status === "COMPLETE" && data.code) {
        return {
          received: true,
          code: data.code,
          text: data.sms_text || data.code,
        };
      }

      return { received: false };
    } catch (error) {
      console.error("TextVerified getSMS error:", error);
      return { received: false };
    }
  }

  /**
   * Close/cancel a verification request
   */
  async closeRequest(verificationId: string) {
    try {
      await fetch(`${this.apiUrl}/Verifications/${verificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });
    } catch (error) {
      console.error("TextVerified closeRequest error:", error);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/balance`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });

      const data = await response.json();
      return data.balance || 0;
    } catch (error) {
      console.error("TextVerified getBalance error:", error);
      return 0;
    }
  }

  /**
   * Get available services and pricing
   */
  async getServices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiUrl}/targets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });

      const data = await response.json();
      return data.targets || [];
    } catch (error) {
      console.error("TextVerified getServices error:", error);
      return [];
    }
  }

  /**
   * Get pricing for a specific service and country
   */
  async getPricing(serviceCode: string, country: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.apiUrl}/pricing?target=${this.getTargetName(
          serviceCode
        )}&country_code=${this.getCountryCode(country)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
        }
      );

      const data = await response.json();
      return data.price || 0;
    } catch (error) {
      console.error("TextVerified getPricing error:", error);
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
        `${this.apiUrl}/availability?target=${this.getTargetName(
          serviceCode
        )}&country_code=${this.getCountryCode(country)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
          },
        }
      );

      const data = await response.json();
      return data.available === true;
    } catch (error) {
      console.error("TextVerified checkAvailability error:", error);
      return false;
    }
  }

  /**
   * Map service codes to TextVerified target names
   */
  private getTargetName(serviceCode: string): string {
    const serviceMap: Record<string, string> = {
      google: "Google",
      facebook: "Facebook",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
      twitter: "Twitter",
      telegram: "Telegram",
      discord: "Discord",
      tiktok: "TikTok",
      snapchat: "Snapchat",
      microsoft: "Microsoft",
      amazon: "Amazon",
      uber: "Uber",
      lyft: "Lyft",
      linkedin: "LinkedIn",
      yahoo: "Yahoo",
      outlook: "Outlook",
      paypal: "PayPal",
      netflix: "Netflix",
      spotify: "Spotify",
      apple: "Apple",
      samsung: "Samsung",
      nike: "Nike",
      ebay: "eBay",
      airbnb: "Airbnb",
      tinder: "Tinder",
      bumble: "Bumble",
      coinbase: "Coinbase",
      binance: "Binance",
      cashapp: "CashApp",
      venmo: "Venmo",
      doordash: "DoorDash",
      grubhub: "Grubhub",
      postmates: "Postmates",
      instacart: "Instacart",
      walmart: "Walmart",
      target: "Target",
      bestbuy: "BestBuy",
      gamestop: "GameStop",
      steam: "Steam",
      epicgames: "EpicGames",
      twitch: "Twitch",
      reddit: "Reddit",
      pinterest: "Pinterest",
      tumblr: "Tumblr",
      quora: "Quora",
      viber: "Viber",
      wechat: "WeChat",
      line: "Line",
      kakao: "Kakao",
      signal: "Signal",
      wickr: "Wickr",
      skype: "Skype",
      zoom: "Zoom",
    };

    return serviceMap[serviceCode.toLowerCase()] || serviceCode;
  }

  /**
   * Map country codes to TextVerified format
   */
  private getCountryCode(country: string): string {
    const countryMap: Record<string, string> = {
      US: "US",
      CA: "CA",
      GB: "GB",
      UK: "GB",
      AU: "AU",
      DE: "DE",
      FR: "FR",
      IT: "IT",
      ES: "ES",
      NL: "NL",
      BE: "BE",
      AT: "AT",
      CH: "CH",
      SE: "SE",
      NO: "NO",
      DK: "DK",
      FI: "FI",
      PL: "PL",
      CZ: "CZ",
      RO: "RO",
      HU: "HU",
      GR: "GR",
      PT: "PT",
      IE: "IE",
      BR: "BR",
      MX: "MX",
      AR: "AR",
      CL: "CL",
      CO: "CO",
      PE: "PE",
      VE: "VE",
      IN: "IN",
      PK: "PK",
      BD: "BD",
      LK: "LK",
      NP: "NP",
      CN: "CN",
      JP: "JP",
      KR: "KR",
      TW: "TW",
      HK: "HK",
      SG: "SG",
      MY: "MY",
      TH: "TH",
      VN: "VN",
      PH: "PH",
      ID: "ID",
      RU: "RU",
      UA: "UA",
      BY: "BY",
      KZ: "KZ",
      UZ: "UZ",
      TR: "TR",
      SA: "SA",
      AE: "AE",
      IL: "IL",
      EG: "EG",
      ZA: "ZA",
      NG: "NG",
      KE: "KE",
      GH: "GH",
      UG: "UG",
      TZ: "TZ",
      NZ: "NZ",
    };

    return countryMap[country.toUpperCase()] || country;
  }
}
