"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, balanceRes, ordersRes] = await Promise.all([
        api.getUserStats(),
        api.getBalance(),
        api.getOrders(1, 5),
      ]);

      setStats(statsRes.data);
      setBalance(balanceRes.data.balance);
      setRecentOrders(ordersRes.data);
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
      if (error.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={() => router.push("/dashboard/orders/new")}>
          Create Order
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="space-y-2">
          <p className="text-sm opacity-90">Available Balance</p>
          <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/wallet")}
            >
              Add Funds
            </Button>
            <Button
              variant="outline"
              className="text-white border-white hover:bg-white/20"
              onClick={() => router.push("/dashboard/wallet/withdraw")}
            >
              Withdraw
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="text-3xl font-bold">{stats?.totalOrders || 0}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {stats?.ordersByStatus?.COMPLETED || 0}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">
            {(stats?.ordersByStatus?.PENDING || 0) +
              (stats?.ordersByStatus?.WAITING_SMS || 0)}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="text-3xl font-bold">
            ${stats?.totalSpent.toFixed(2) || "0.00"}
          </p>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Orders</h2>
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/orders")}
          >
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {recentOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orders yet. Create your first order to get started!
            </p>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <div>
                  <p className="font-medium">{order.serviceCode}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.orderNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${order.finalPrice}</p>
                  <p
                    className={`text-sm ${
                      order.status === "COMPLETED"
                        ? "text-green-600"
                        : order.status === "WAITING_SMS"
                        ? "text-yellow-600"
                        : "text-gray-600"
                    }`}
                  >
                    {order.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
