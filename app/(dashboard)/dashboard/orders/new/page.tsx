"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [country, setCountry] = useState("US");
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, balanceRes] = await Promise.all([
        api.getAvailableServices(),
        api.getBalance(),
      ]);
      setServices(servicesRes.data);
      setBalance(balanceRes.data.balance);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedService) {
      setError("Please select a service");
      return;
    }

    const service = services.find((s) => s.code === selectedService);
    if (balance < service.price) {
      setError("Insufficient balance. Please add funds to your wallet.");
      return;
    }

    setCreating(true);

    try {
      const response = await api.createOrder({
        serviceCode: selectedService,
        country,
      });

      if (response.success) {
        router.push(`/orders/${response.data.id}`);
      } else {
        setError(response.error || "Failed to create order");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to create order. Please try again."
      );
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

  const selectedServiceData = services.find((s) => s.code === selectedService);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        ← Back
      </Button>

      <Card className="p-8">
        <h1 className="text-3xl font-bold mb-6">Buy Number</h1>

        {/* Balance Display */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold">₦{balance.toLocaleString()}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="service">Service</Label>
            <Select
              value={selectedService}
              onValueChange={setSelectedService}
              disabled={creating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.code} value={service.code}>
                    {service.name} - ₦{service.price.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Select
              value={country}
              onValueChange={setCountry}
              disabled={creating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="BR">Brazil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedServiceData && (
            <Card className="p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Order Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Service:</span>
                  <span>{selectedServiceData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Country:</span>
                  <span>{country}</span>
                </div>
                <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t">
                  <span>Total:</span>
                  <span>₦{selectedServiceData.price.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          )}

          <Button type="submit" className="w-full" disabled={creating}>
            {creating ? "Processing..." : "Buy Number"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
