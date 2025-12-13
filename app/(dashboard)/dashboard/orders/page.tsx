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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <Button onClick={() => router.push("/dashboard/orders/new")}>
          Create New Order
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No orders yet</p>
          <Button onClick={() => router.push("/dashboard/orders/new")}>
            Create Your First Order
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {order.serviceCode.toUpperCase()}
                      </h3>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Order #{order.orderNumber}
                    </p>
                    {order.phoneNumber && (
                      <p className="text-sm font-mono">{order.phoneNumber}</p>
                    )}
                    {order.smsCode && (
                      <p className="text-lg font-bold text-green-600">
                        Code: {order.smsCode}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-2xl font-bold">${order.finalPrice}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
