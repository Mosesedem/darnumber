"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

export default function OrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const fetchOrders = async () => {
    try {
      const response = await api.getOrders(page, 20);
      setOrders(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500";
      case "WAITING_SMS":
        return "bg-yellow-500";
      case "PENDING":
        return "bg-blue-500";
      case "FAILED":
      case "EXPIRED":
        return "bg-red-500";
      case "CANCELLED":
      case "REFUNDED":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">My Orders</h1>
          <Button
            onClick={() => router.push("/orders/new")}
            className="w-full sm:w-auto"
          >
            Buy Number
          </Button>
        </div>

        {orders.length === 0 ? (
          <Card className="p-8 md:p-12 text-center">
            <p className="text-muted-foreground mb-4 text-sm md:text-base">
              No orders yet
            </p>
            <Button
              onClick={() => router.push("/orders/new")}
              className="w-full sm:w-auto"
            >
              Buy Your First Number
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 md:gap-4">
              {orders.map((order) => (
                <Card
                  key={order.id}
                  className="p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base md:text-lg font-semibold truncate">
                          {order.serviceCode.toUpperCase()}
                        </h3>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        Order #{order.orderNumber}
                      </p>
                      {order.phoneNumber && (
                        <p className="text-xs md:text-sm font-mono break-all">
                          {order.phoneNumber}
                        </p>
                      )}
                      {order.smsCode && (
                        <p className="text-base md:text-lg font-bold text-green-600">
                          Code: {order.smsCode}
                        </p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:text-right space-y-0 sm:space-y-2">
                      <p className="text-xl md:text-2xl font-bold">
                        ${order.finalPrice}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="w-full sm:w-auto"
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm md:text-base">
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === pagination.pages}
                  onClick={() => setPage(page + 1)}
                  className="w-full sm:w-auto"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
