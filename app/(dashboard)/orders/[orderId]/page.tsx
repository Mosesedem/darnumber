"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  // Tick every second to update countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      // Poll for updates every 10 seconds if order is active
      const interval = setInterval(() => {
        const activeStatuses = ["WAITING_FOR_SMS", "PENDING", "PROCESSING"];
        if (activeStatuses.includes(order?.status)) {
          fetchOrder();
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [orderId, order?.status]);

  const fetchOrder = async () => {
    try {
      const response = await api.getOrder(orderId);
      setOrder(response.data);
    } catch (error) {
      console.error("Failed to fetch order:", error);
      setError("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setCancelling(true);
    try {
      await api.cancelOrder(orderId);
      fetchOrder();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">Order not found</Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500";
      case "WAITING_FOR_SMS":
        return "bg-yellow-500";
      case "PENDING":
        return "bg-blue-500";
      case "PROCESSING":
        return "bg-indigo-500";
      case "EXPIRED":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const canCancel = ["PENDING", "PROCESSING", "WAITING_FOR_SMS"].includes(
    order.status
  );

  const expiresAtMs = useMemo(() => {
    return order?.expiresAt ? new Date(order.expiresAt).getTime() : null;
  }, [order?.expiresAt]);

  const remainingMs = useMemo(() => {
    if (!expiresAtMs) return null;
    return Math.max(0, expiresAtMs - now);
  }, [expiresAtMs, now]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m ${sec}s` : `${min}m ${sec}s`;
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        ← Back to Orders
      </Button>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {order.serviceCode.toUpperCase()}
            </h1>
            <p className="text-muted-foreground">Order #{order.orderNumber}</p>
          </div>
          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
        </div>

        {/* Phone Number */}
        {order.phoneNumber && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Phone Number</p>
            <p className="text-2xl font-bold font-mono">{order.phoneNumber}</p>
          </div>
        )}

        {/* SMS Code */}
        {order.smsCode && (
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">
              SMS Verification Code
            </p>
            <p className="text-3xl font-bold text-green-600">{order.smsCode}</p>
          </div>
        )}

        {/* Order Details */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium">{order.serviceCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Country</span>
            <span className="font-medium">{order.country}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium">{order.provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium">
              ₦{Number(order.finalPrice).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
          {order.completedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-medium">
                {new Date(order.completedAt).toLocaleString()}
              </span>
            </div>
          )}
          {order.expiresAt && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">
                {new Date(order.expiresAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Countdown & Status Messages */}
        {remainingMs !== null && canCancel && remainingMs > 0 && (
          <Alert className="bg-amber-50 border-amber-200 mt-4">
            <div className="flex flex-col">
              <span className="font-medium">Time remaining</span>
              <span className="text-sm text-muted-foreground">
                This number will auto-cancel and refund in{" "}
                {formatDuration(remainingMs)}.
              </span>
            </div>
          </Alert>
        )}

        {order.status === "WAITING_FOR_SMS" && (
          <Alert className="mt-4">
            Waiting for SMS code. This page will automatically update when the
            code is received.
          </Alert>
        )}

        {order.status === "COMPLETED" && (
          <Alert className="bg-green-50 border-green-200 mt-4">
            Order completed successfully! Your SMS code is displayed above.
          </Alert>
        )}

        {order.status === "EXPIRED" && (
          <Alert className="bg-red-50 border-red-200 mt-4">
            This order has expired and has been refunded.
          </Alert>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <Button
            variant="destructive"
            className="w-full mt-6"
            onClick={handleCancel}
            disabled={cancelling || (remainingMs !== null && remainingMs === 0)}
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </Button>
        )}
      </Card>
    </div>
  );
}
