"use client";

import { useEffect, useState, useMemo, useDeferredValue } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Removed Radix Select in favor of virtualized Dialog lists
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { FixedSizeList as List } from "react-window";
import type { ListChildComponentProps } from "react-window";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  cover: string;
  logo?: ReactNode | string;
}

interface ServiceUi {
  displayName?: string;
  color?: string;
  logo?: ReactNode | string;
}

interface Service {
  code: string;
  name: string;
  country: string;
  price: number;
  providers: Provider[];
  ui?: ServiceUi;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(0);
  const [serviceSearch, setServiceSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const [countryNameByCode, setCountryNameByCode] = useState<
    Map<string, string>
  >(new Map());
  const [usdToNgn, setUsdToNgn] = useState<number>(0);
  const [rubToUsd, setRubToUsd] = useState<number>(0);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>(
    {}
  );
  const [isPriceLoading, setIsPriceLoading] = useState<Record<string, boolean>>(
    {}
  );

  const deferredServiceSearch = useDeferredValue(serviceSearch);
  const deferredCountrySearch = useDeferredValue(countrySearch);

  // Fetch countries from SMS-Man API and map code -> full name
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const map = new Map<string, string>();
        // Prefer server-proxied list (supports server env secret)
        try {
          const res = await fetch("/api/providers/smsman/countries");
          if (res.ok) {
            const out = await res.json();
            const countries = out?.data?.countries || {};
            Object.entries(countries).forEach(([code, title]) => {
              if (code && title)
                map.set(String(code).toUpperCase(), String(title));
            });
          }
        } catch (_) {
          // ignore and fallback
        }

        // Fallback to static country list if API/token unavailable
        if (map.size === 0) {
          try {
            const mod = await import("@/lib/constants/countries");
            const list = mod.getCountryList?.() || [];
            list.forEach((c: any) => {
              if (c?.code && c?.name) {
                map.set(String(c.code).toUpperCase(), c.name);
              }
            });
          } catch (_) {
            // ignore
          }
        }

        setCountryNameByCode(map);
      } catch (e) {
        console.error("[NewOrderPage] Failed to fetch countries list:", e);
        // Try fallback to static country list
        try {
          const mod = await import("@/lib/constants/countries");
          const list = mod.getCountryList?.() || [];
          const map = new Map<string, string>();
          list.forEach((c: any) => {
            if (c?.code && c?.name) {
              map.set(String(c.code).toUpperCase(), c.name);
            }
          });
          setCountryNameByCode(map);
        } catch (_) {
          // Leave map empty; UI will fall back to service.country
        }
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch exchange rates: RUB→USD and USD→NGN
  useEffect(() => {
    const loadRates = async () => {
      try {
        const res = await fetch(
          "https://openexchangerates.org/api/latest.json?app_id=5e1de33c06ec43ad8047ef4b9fc163c4"
        );
        if (!res.ok) throw new Error("Failed to fetch exchange rates");
        const data = (await res.json()) as {
          rates?: Record<string, number>;
          base?: string;
        };
        const ngnRate = data?.rates?.NGN || 0;
        const rubRate = data?.rates?.RUB || 0;

        // Calculate RUB→USD (since base is USD, RUB rate is RUB per 1 USD)
        // So 1 RUB = 1/rubRate USD
        const rubToUsdRate = rubRate > 0 ? 1 / rubRate : 0;

        setUsdToNgn(ngnRate);
        setRubToUsd(rubToUsdRate);

        console.log("[NewOrderPage] 💱 Exchange rates loaded:", {
          base: data.base || "USD",
          "USD → NGN": ngnRate,
          "RUB → USD": rubToUsdRate.toFixed(6),
          "1 RUB": `$${rubToUsdRate.toFixed(4)} = ₦${(
            rubToUsdRate * ngnRate
          ).toFixed(2)}`,
        });
      } catch (e) {
        console.error("[NewOrderPage] Failed to fetch exchange rates:", e);
        setUsdToNgn(0);
        setRubToUsd(0);
      }
    };
    loadRates();
  }, []);

  const fetchData = async () => {
    try {
      console.log("[NewOrderPage] Fetching services and balance...");

      const [servicesRes, balanceRes] = await Promise.all([
        api.getAvailableServices(),
        api.getBalance(),
      ]);

      const services: Service[] = servicesRes?.data?.services || [];
      const providersFromApi: Provider[] = servicesRes?.data?.providers || [];

      console.log(
        `[NewOrderPage] Loaded ${services.length} services from ${providersFromApi.length} providers`
      );

      setAllServices(services);

      // Use providers from API or fallback to defaults
      const finalProviders =
        providersFromApi.length > 0
          ? providersFromApi
          : [
              {
                id: "lion",
                name: "sms-man",
                displayName: "Lion SMS",
                cover: "All Countries",
              },
              {
                id: "panda",
                name: "textverified",
                displayName: "Panda Verify",
                cover: "United States",
              },
            ];

      setProviders(finalProviders);
      setBalance(balanceRes.data.balance);

      // Set default provider
      if (finalProviders.length > 0) {
        setSelectedProvider(finalProviders[0].id);
      }
    } catch (error) {
      console.error("[NewOrderPage] Failed to fetch data:", error);
      setError("Failed to load services. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  // Get unique service codes for the selected provider
  const availableServices = useMemo(() => {
    if (!selectedProvider || !allServices.length) return [];

    const serviceMap = new Map<string, Service>();

    allServices.forEach((service) => {
      const hasProvider = service.providers.some(
        (p) => p.id === selectedProvider
      );
      if (hasProvider && !serviceMap.has(service.code)) {
        serviceMap.set(service.code, service);
      }
    });

    return Array.from(serviceMap.values());
  }, [allServices, selectedProvider]);

  // Get available countries for selected service and provider
  const availableCountries = useMemo(() => {
    if (!selectedService || !selectedProvider) return [];

    const countries = allServices
      .filter(
        (s) =>
          s.code === selectedService &&
          s.providers.some((p) => p.id === selectedProvider)
      )
      .map((s) => {
        // Backend sends USD price with full markup already applied: (base × 1.20) + 2000 NGN
        // Frontend only converts USD → NGN
        const priceUsd = (s as any).prices?.[selectedProvider] ?? s.price ?? 0;
        const priceNgn = Math.round(priceUsd * (usdToNgn || 0));

        return {
          code: s.country,
          name:
            countryNameByCode.get(String(s.country).toUpperCase()) || s.country,
          priceUsd,
          priceNgn,
        };
      });

    return countries;
  }, [
    allServices,
    selectedService,
    selectedProvider,
    countryNameByCode,
    usdToNgn,
    rubToUsd,
  ]);

  // Filter services based on search
  // Lightweight fuzzy search scoring
  const fuzzyScore = (text: string, query: string) => {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    if (!q) return 0;
    if (t.includes(q)) return 100 - t.indexOf(q); // prefer early matches
    // subsequence match
    let ti = 0,
      qi = 0,
      score = 0;
    while (ti < t.length && qi < q.length) {
      if (t[ti] === q[qi]) {
        score += 5; // reward matched char
        qi++;
      }
      ti++;
    }
    // small bonus if all chars found
    if (qi === q.length) score += 20;
    return score;
  };

  const filteredServices = useMemo(() => {
    const query = deferredServiceSearch || "";
    if (!query) return availableServices;
    return [...availableServices]
      .map((service) => {
        const display = service.ui?.displayName || service.name || "";
        const s1 = fuzzyScore(display, query);
        const s2 = fuzzyScore(service.code || "", query);
        return { service, score: Math.max(s1, s2) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.service);
  }, [availableServices, deferredServiceSearch]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    const query = deferredCountrySearch || "";
    if (!query) return availableCountries;
    return [...availableCountries]
      .map((country) => {
        const s1 = fuzzyScore(country.name, query);
        const s2 = fuzzyScore(country.code, query);
        return { country, score: Math.max(s1, s2) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.country);
  }, [availableCountries, deferredCountrySearch]);

  // Reset selections when provider changes
  useEffect(() => {
    setSelectedService("");
    setSelectedCountry("");
  }, [selectedProvider]);

  // Reset country when service changes
  useEffect(() => {
    setSelectedCountry("");
  }, [selectedService]);

  // Debounced price fetcher
  const fetchPrice = useMemo(() => {
    const debounce = (func, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
      };
    };

    const getPrice = async (serviceName: string) => {
      if (!serviceName || servicePrices[serviceName] !== undefined) return;

      setIsPriceLoading((prev) => ({ ...prev, [serviceName]: true }));
      try {
        const res = await api.getTextVerifiedPrice(serviceName);
        if (res.ok && res.data.price > 0) {
          setServicePrices((prev) => ({
            ...prev,
            [serviceName]: res.data.price,
          }));
        } else {
          // Cache failure locally to avoid re-fetching
          setServicePrices((prev) => ({ ...prev, [serviceName]: -1 }));
        }
      } catch (e) {
        console.error(`Failed to fetch price for ${serviceName}`, e);
        setServicePrices((prev) => ({ ...prev, [serviceName]: -1 }));
      } finally {
        setIsPriceLoading((prev) => ({ ...prev, [serviceName]: false }));
      }
    };

    return debounce(getPrice, 300);
  }, [servicePrices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedService || !selectedCountry || !selectedProvider) {
      setError("Please select service, country, and provider");
      return;
    }

    const service = allServices.find(
      (s) =>
        s.code === selectedService &&
        s.country === selectedCountry &&
        s.providers.some((p) => p.id === selectedProvider)
    );

    if (!service) {
      setError("Service not found");
      return;
    }

    if (balance < Math.round(service.price * (usdToNgn || 0))) {
      setError(
        `Insufficient balance. You need ₦${currentPriceNgn.toLocaleString()} but only have ₦${balance.toLocaleString()}. Please add ₦${(
          currentPriceNgn - balance
        ).toLocaleString()} to your wallet.`
      );
      return;
    }

    setCreating(true);

    try {
      const provider = providers.find((p) => p.id === selectedProvider);
      // Always charge in NGN (backend stores and operates in NGN)
      const price = currentPriceNgn;

      if (!price || price <= 0) {
        setError(
          "Could not determine the price for this service. Please try again."
        );
        setCreating(false);
        return;
      }

      const response = await api.createOrder({
        serviceCode: selectedService,
        country: selectedCountry,
        provider: provider?.name,
        price: price, // NGN amount
      });
      console.log("[NewOrderPage] Creating order with pricing:", {
        serviceCode: selectedService,
        country: selectedCountry,
        provider: provider?.name,
        price_ngn: price,
      });

      if (response.ok) {
        router.push(`/orders/${response.data.orderId}`);
      } else {
        setError(response.error || "Failed to create order");
      }
    } catch (err: unknown) {
      let message = "Failed to create order. Please try again.";
      if (typeof err === "object" && err && "response" in err) {
        const e = err as { response?: { data?: { error?: string } } };
        message = e.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  const currentService = allServices.find(
    (s) => s.code === selectedService && s.country === selectedCountry
  );
  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // Backend already applied full markup: (base × 1.20) + 2000 NGN
  // Frontend only converts USD → NGN
  const currentPriceUsd =
    (currentService as any)?.prices?.[selectedProvider] ??
    currentService?.price ??
    0;
  const currentPriceNgn = Math.round(currentPriceUsd * (usdToNgn || 0));
  const insufficientBalance = currentService && balance < currentPriceNgn;

  // Virtualized row renderer for services list
  const renderServiceRow = ({ index, style }: ListChildComponentProps) => {
    const service = filteredServices[index];
    const isSelected = selectedService === service.code;
    const price = servicePrices[service.code];
    const isLoadingPrice = isPriceLoading[service.code];

    // Fetch price when the row is rendered
    useEffect(() => {
      if (
        service.providers.some((p) => p.name.includes("textverified")) &&
        price === undefined
      ) {
        fetchPrice(service.code);
      }
    }, [service.code, price]);

    return (
      <div
        style={style}
        key={`${service.code}-${service.country}`}
        className="px-3 py-2 border-b last:border-b-0"
      >
        <button
          type="button"
          onClick={() => {
            setSelectedService(service.code);
            setServiceDialogOpen(false);
          }}
          className="w-full flex items-center gap-3 text-left hover:bg-accent rounded-md px-2 py-2"
        >
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs bg-gray-200`}
          >
            📱
          </div>
          <span className="font-medium truncate flex-1">{service.name}</span>
          <div className="flex-shrink-0">
            {isLoadingPrice ? (
              <Spinner className="w-4 h-4" />
            ) : price && price > 0 ? (
              <div className="font-mono text-sm">~${price.toFixed(2)}</div>
            ) : (
              <div className="text-xs text-muted-foreground">✅</div>
            )}
          </div>
        </button>
      </div>
    );
  };

  // Virtualized row renderer for countries list
  const renderCountryRow = ({ index, style }: ListChildComponentProps) => {
    const country = filteredCountries[index];
    const logo = null; // remove hardcoded symbol
    return (
      <div
        style={style}
        key={country.code}
        className="px-3 py-2 border-b last:border-b-0"
      >
        <button
          type="button"
          onClick={() => {
            setSelectedCountry(country.code);
            setCountryDialogOpen(false);
          }}
          className="w-full flex items-center justify-between gap-3 text-left hover:bg-accent rounded-md px-2 py-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-gray-200"></div>
            <span className="font-medium truncate">{country.name}</span>
          </div>
          <span className="font-bold text-primary">
            ₦{(country.priceNgn || 0).toLocaleString()}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        ← Back
      </Button>

      {/* Hybrid Layout: Mobile stacks vertically, Desktop uses sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Main Content (Mobile: full width, Desktop: 2/3) */}
        <div className="flex-1 lg:w-2/3 space-y-6">
          {/* Balance & Provider Info - TOP on Mobile, Hidden on Desktop */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Balance Card */}
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-muted-foreground">
                  Available Balance
                </p>
              </div>
              <p className="text-2xl md:text-3xl font-bold">
                ₦{balance.toLocaleString()}
              </p>
              <Button
                variant="link"
                className="p-0 h-auto mt-2 text-sm"
                onClick={() => router.push("/wallet")}
              >
                Add funds →
              </Button>
            </Card>

            {/* Current Provider Card */}
            {currentProvider && (
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-xl font-bold">
                    {currentProvider.displayName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      {currentProvider.displayName}
                    </h3>
                    <Badge variant="secondary" className="text-xs mt-1">
                      Active Provider
                    </Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Main Order Form */}
          <Card className="p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-6">Buy Number</h1>

            {error && (
              <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="ml-2 text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" id="order-form">
              {/* Provider Selection */}
              <div>
                <Label className="mb-3 block text-base font-semibold">
                  Select Provider
                </Label>

                {/* Mobile: Dialog Trigger */}
                <div className="lg:hidden">
                  <Dialog
                    open={providerDialogOpen}
                    onOpenChange={setProviderDialogOpen}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-14 justify-between text-left font-normal"
                      disabled={creating}
                      onClick={() => setProviderDialogOpen(true)}
                    >
                      {currentProvider ? (
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl font-bold ${
                              currentProvider.name
                                .toLowerCase()
                                .includes("lion") ||
                              currentProvider.name
                                .toLowerCase()
                                .includes("sms-man")
                                ? "bg-amber-100 dark:bg-amber-900"
                                : currentProvider.name
                                    .toLowerCase()
                                    .includes("panda") ||
                                  currentProvider.name
                                    .toLowerCase()
                                    .includes("textverified")
                                ? "bg-green-100 dark:bg-green-900"
                                : "bg-primary/10"
                            }`}
                          >
                            {currentProvider.name
                              .toLowerCase()
                              .includes("lion") ||
                            currentProvider.name
                              .toLowerCase()
                              .includes("sms-man")
                              ? "🦁"
                              : currentProvider.name
                                  .toLowerCase()
                                  .includes("panda") ||
                                currentProvider.name
                                  .toLowerCase()
                                  .includes("textverified")
                              ? "🐼"
                              : currentProvider.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {currentProvider.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {currentProvider.cover}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Select a provider
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Select Provider</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-4">
                        {providers.length === 0 && (
                          <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                            No providers available right now. Pull to refresh or
                            try again later.
                          </div>
                        )}
                        {providers.map((provider) => {
                          // Map provider icons based on name
                          const getProviderIcon = (name: string) => {
                            return (
                              provider.logo ||
                              (name.toLowerCase().includes("lion") ||
                              name.toLowerCase().includes("sms-man")
                                ? "🦁"
                                : name.toLowerCase().includes("panda") ||
                                  name.toLowerCase().includes("textverified")
                                ? "🐼"
                                : provider.displayName.charAt(0))
                            );
                          };

                          const getProviderBg = (name: string) => {
                            if (
                              name.toLowerCase().includes("lion") ||
                              name.toLowerCase().includes("sms-man")
                            ) {
                              return selectedProvider === provider.id
                                ? "bg-amber-500 text-white"
                                : "bg-amber-100 dark:bg-amber-900";
                            }
                            if (
                              name.toLowerCase().includes("panda") ||
                              name.toLowerCase().includes("textverified")
                            ) {
                              return selectedProvider === provider.id
                                ? "bg-green-500 text-white"
                                : "bg-green-100 dark:bg-green-900";
                            }
                            return selectedProvider === provider.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary";
                          };

                          return (
                            <button
                              key={provider.id}
                              type="button"
                              onClick={() => {
                                setSelectedProvider(provider.id);
                                setProviderDialogOpen(false);
                              }}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                selectedProvider === provider.id
                                  ? "border-primary bg-primary/5 shadow-md"
                                  : "border-gray-200 hover:border-primary/50 dark:border-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold flex-shrink-0 ${getProviderBg(
                                      provider.cover
                                    )}`}
                                  >
                                    {getProviderIcon(provider.name)}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-base">
                                      {provider.displayName}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                      {provider.cover}
                                    </p>
                                  </div>
                                </div>
                                {selectedProvider === provider.id && (
                                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Desktop: Card Grid */}
                <div className="hidden lg:grid lg:grid-cols-2 gap-4">
                  {providers.length === 0 ? (
                    <div className="col-span-2 p-4 text-center text-sm text-muted-foreground border rounded-md">
                      No providers available. Please try again later.
                    </div>
                  ) : (
                    providers.map((provider) => {
                      // Map provider icons based on name
                      const getProviderIcon = (name: string) => {
                        return (
                          provider.logo ||
                          (name.toLowerCase().includes("lion") ||
                          name.toLowerCase().includes("sms-man")
                            ? "🦁"
                            : name.toLowerCase().includes("panda") ||
                              name.toLowerCase().includes("textverified")
                            ? "🐼"
                            : provider.displayName.charAt(0))
                        );
                      };

                      const getProviderBg = (name: string) => {
                        if (
                          name.toLowerCase().includes("lion") ||
                          name.toLowerCase().includes("sms-man")
                        ) {
                          return selectedProvider === provider.id
                            ? "bg-amber-500"
                            : "bg-amber-100 dark:bg-amber-900";
                        }
                        if (
                          name.toLowerCase().includes("panda") ||
                          name.toLowerCase().includes("textverified")
                        ) {
                          return selectedProvider === provider.id
                            ? "bg-green-500"
                            : "bg-green-100 dark:bg-green-900";
                        }
                        return selectedProvider === provider.id
                          ? "bg-primary"
                          : "bg-primary/10";
                      };

                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedProvider(provider.id);
                          }}
                          disabled={creating}
                          className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-lg active:scale-[0.98] ${
                            selectedProvider === provider.id
                              ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/30"
                              : "border-gray-200 hover:border-primary/50 hover:bg-accent dark:border-gray-700 dark:hover:border-primary/50"
                          } ${
                            creating
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                          style={{
                            userSelect: "none",
                            WebkitUserSelect: "none",
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold flex-shrink-0 transition-all ${getProviderBg(
                                provider.cover
                              )} ${
                                selectedProvider === provider.id
                                  ? "text-white"
                                  : ""
                              }`}
                            >
                              {getProviderIcon(provider.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h3 className="font-bold text-lg mb-1">
                                    {provider.displayName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {provider.cover}
                                  </p>
                                </div>
                                {selectedProvider === provider.id && (
                                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 animate-in zoom-in duration-200" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Service Selection - Virtualized Dialog */}
              <div>
                <Label className="mb-2 block text-base font-semibold">
                  Service
                  {availableServices.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs font-normal"
                    >
                      {availableServices.length} available
                    </Badge>
                  )}
                </Label>

                <Dialog
                  open={serviceDialogOpen}
                  onOpenChange={setServiceDialogOpen}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 justify-between text-left"
                    disabled={creating || !selectedProvider}
                    onClick={() => setServiceDialogOpen(true)}
                  >
                    {selectedService ? (
                      <span className="truncate">
                        {allServices.find((s) => s.code === selectedService)?.ui
                          ?.displayName ||
                          allServices.find((s) => s.code === selectedService)
                            ?.name ||
                          "Selected service"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Select a service
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Select Service</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search services..."
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          className="pl-9 h-11"
                          disabled={creating || !selectedProvider}
                        />
                      </div>

                      {filteredServices.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                          {selectedProvider
                            ? serviceSearch
                              ? "No services match your search"
                              : "No services available for this provider"
                            : "Please select a provider first"}
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          {/* Virtualized list to handle thousands of items smoothly */}
                          <List
                            height={400}
                            width="100%"
                            itemCount={filteredServices.length}
                            itemSize={52}
                          >
                            {renderServiceRow}
                          </List>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Country Selection - Virtualized Dialog */}
              <div>
                <Label className="mb-2 block text-base font-semibold">
                  Country
                  {availableCountries.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs font-normal"
                    >
                      {availableCountries.length} available
                    </Badge>
                  )}
                </Label>

                <Dialog
                  open={countryDialogOpen}
                  onOpenChange={setCountryDialogOpen}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 justify-between text-left"
                    disabled={creating || !selectedService}
                    onClick={() => setCountryDialogOpen(true)}
                  >
                    {selectedCountry ? (
                      <span className="truncate">
                        {countryNameByCode.get(
                          String(selectedCountry).toUpperCase()
                        ) ||
                          availableCountries.find(
                            (c) => c.code === selectedCountry
                          )?.name ||
                          selectedCountry}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Select a country
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Select Country</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="pl-9 h-11"
                          disabled={creating || !selectedService}
                        />
                      </div>

                      {filteredCountries.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                          {selectedService
                            ? "No countries available"
                            : "Please select a service first"}
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          <List
                            height={400}
                            width="100%"
                            itemCount={filteredCountries.length}
                            itemSize={52}
                          >
                            {renderCountryRow}
                          </List>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Submit Button - Mobile */}
              <Button
                type="submit"
                className="w-full h-12 text-base lg:hidden"
                disabled={
                  creating ||
                  insufficientBalance ||
                  !selectedService ||
                  !selectedCountry ||
                  !selectedProvider
                }
              >
                {creating ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Processing...
                  </>
                ) : insufficientBalance ? (
                  "Insufficient Balance"
                ) : (
                  "Buy Number"
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Sidebar - Desktop Only */}
        <div className="hidden lg:block lg:w-1/3">
          <div className="sticky top-6 space-y-4">
            {/* Balance Card */}
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-muted-foreground">
                  Available Balance
                </p>
              </div>
              <p className="text-3xl font-bold mb-3">
                ₦{balance.toLocaleString()}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push("/wallet")}
              >
                Add Funds
              </Button>
            </Card>

            {/* Current Provider Card */}
            {currentProvider && (
              <Card className="p-5 shadow-lg border-2 border-primary/20">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {currentProvider.displayName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base">
                      {currentProvider.displayName}
                    </h3>
                    <Badge variant="default" className="text-xs mt-1">
                      Active Provider
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This provider will be used to purchase your virtual number.
                </p>
              </Card>
            )}

            {/* Order Summary */}
            {currentService ? (
              <Card className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-lg">
                <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                  <span>Order Summary</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="font-semibold">
                      {currentService?.ui?.displayName || currentService.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Country:</span>
                    <span className="font-semibold">
                      {countryNameByCode.get(
                        String(currentService.country).toUpperCase()
                      ) || currentService.country}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="font-semibold">
                      {currentProvider?.displayName}
                    </span>
                  </div>
                  <div className="pt-3 border-t-2 border-gray-300 dark:border-gray-600 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">Total:</span>
                      <span
                        className={`font-bold text-2xl ${
                          insufficientBalance ? "text-red-600" : "text-primary"
                        }`}
                      >
                        ₦{currentPriceNgn.toLocaleString()}
                      </span>
                    </div>
                    {insufficientBalance && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          ⚠️ Insufficient balance
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Need ₦{(currentPriceNgn - balance).toLocaleString()}{" "}
                          more
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button - Desktop */}
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  className="w-full h-12 text-base mt-5 shadow-lg"
                  disabled={
                    creating ||
                    insufficientBalance ||
                    !selectedService ||
                    !selectedCountry ||
                    !selectedProvider
                  }
                >
                  {creating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Processing...
                    </>
                  ) : insufficientBalance ? (
                    "Insufficient Balance"
                  ) : (
                    "Buy Number Now"
                  )}
                </Button>
              </Card>
            ) : (
              <Card className="p-5 bg-gray-50 dark:bg-gray-900 border-dashed">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a service and country to see the order summary
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
