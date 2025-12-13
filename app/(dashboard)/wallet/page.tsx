"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function WalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        api.getBalance(),
        api.getTransactions(1, 10),
      ]);
      setBalance(balanceRes.data.balance);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 5) {
      setError("Minimum deposit amount is $5");
      return;
    }

    setProcessing(true);

    try {
      const response = await api.createPaymentIntent(amount);

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe not loaded");
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId,
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to process deposit");
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      setError("Minimum withdrawal amount is $10");
      return;
    }

    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }

    setProcessing(true);

    try {
      await api.requestWithdrawal(amount, "bank_transfer");
      setWithdrawAmount("");
      fetchWalletData();
      alert(
        "Withdrawal request submitted. Processing may take 1-3 business days."
      );
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to process withdrawal");
    } finally {
      setProcessing(false);
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
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Wallet</h1>

      {/* Balance Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <p className="text-sm opacity-90">Available Balance</p>
        <p className="text-5xl font-bold mt-2">${balance.toFixed(2)}</p>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Deposit/Withdraw Tabs */}
      <Tabs defaultValue="deposit">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Add Funds</h2>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <Label htmlFor="depositAmount">Amount (USD)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  min="5"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Minimum $5"
                  required
                  disabled={processing}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum deposit: $5. Payment processed via Stripe.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? "Processing..." : "Continue to Payment"}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Withdraw Funds</h2>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <Label htmlFor="withdrawAmount">Amount (USD)</Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  step="0.01"
                  min="10"
                  max={balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Minimum $10"
                  required
                  disabled={processing}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum withdrawal: $10. Processing takes 1-3 business days.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={processing || balance < 10}
              >
                {processing ? "Processing..." : "Request Withdrawal"}
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction History */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet
            </p>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold ${
                      tx.type === "DEPOSIT" || tx.type === "REFUND"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type === "DEPOSIT" || tx.type === "REFUND" ? "+" : "-"}$
                    {tx.amount}
                  </p>
                  <p className="text-sm text-muted-foreground">{tx.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
