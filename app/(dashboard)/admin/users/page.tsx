"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceType, setBalanceType] = useState<"add" | "deduct">("add");

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery]);

  const fetchUsers = async () => {
    try {
      const response = await api.getAdminUsers(page, 20, searchQuery);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      if (error.response?.status === 403) {
        toast.api.unauthorized();
      } else {
        toast.error("Failed to load users", "Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceAdjustment = async () => {
    if (!selectedUser || !balanceAmount) return;

    try {
      await api.adjustUserBalance(
        selectedUser.id,
        balanceType === "add"
          ? parseFloat(balanceAmount)
          : -parseFloat(balanceAmount),
        `Manual ${balanceType} by admin`
      );
      toast.success(
        "Balance adjusted",
        `Successfully ${
          balanceType === "add" ? "added" : "deducted"
        } ₦${parseFloat(balanceAmount).toLocaleString()}`
      );
      setBalanceAmount("");
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to adjust balance:", error);
      toast.error(
        "Balance adjustment failed",
        error.response?.data?.error || "Please try again."
      );
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.updateUser(userId, {
        accountStatus: newStatus,
      });
      toast.success(
        "Status updated",
        `User has been ${newStatus === "ACTIVE" ? "activated" : "suspended"}.`
      );
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to update user status:", error);
      toast.error(
        "Status update failed",
        error.response?.data?.error || "Please try again."
      );
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
      <h1 className="text-3xl font-bold">User Management</h1>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by email or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Users Table */}
      <Card className="p-6">
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{user.userName}</p>
                  <Badge
                    className={
                      user.accountStatus === "ACTIVE"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }
                  >
                    {user.accountStatus}
                  </Badge>
                  {user.role === "ADMIN" && (
                    <Badge className="bg-purple-500">ADMIN</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-sm">
                  Balance: <span className="font-bold">${user.balance}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                    >
                      Adjust Balance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Adjust Balance - {user.userName}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Current Balance</Label>
                        <p className="text-2xl font-bold">${user.balance}</p>
                      </div>
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={balanceAmount}
                          onChange={(e) => setBalanceAmount(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          variant={
                            balanceType === "add" ? "default" : "outline"
                          }
                          onClick={() => setBalanceType("add")}
                        >
                          Add
                        </Button>
                        <Button
                          className="flex-1"
                          variant={
                            balanceType === "deduct" ? "default" : "outline"
                          }
                          onClick={() => setBalanceType("deduct")}
                        >
                          Deduct
                        </Button>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleBalanceAdjustment}
                      >
                        Confirm
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant={
                    user.accountStatus === "ACTIVE" ? "destructive" : "default"
                  }
                  size="sm"
                  onClick={() =>
                    handleToggleStatus(user.id, user.accountStatus)
                  }
                >
                  {user.accountStatus === "ACTIVE" ? "Suspend" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
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
      </Card>
    </div>
  );
}
