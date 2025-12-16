"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

function VerifyContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const ref = sp.get("ref");
  const provider = sp.get("provider") as string | null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      if (!ref || !provider) {
        setError("Missing reference or provider");
        setLoading(false);
        return;
      }
      if (provider === "etegram") {
        // Etegram is webhook-only; show pending message
        setResult({
          success: false,
          status: "PENDING",
          message: "Awaiting Etegram webhook confirmation",
        });
        setLoading(false);
        return;
      }
      try {
        const res = await api.verifyPayment(ref, provider);
        setResult(res?.data);
        if (res?.data?.success) {
          toast.payment.success(res.data.amount, "NGN");
        } else if (res?.data?.status !== "PENDING") {
          toast.payment.failed(
            res?.data?.message || "Payment verification failed"
          );
        }
      } catch (e: any) {
        const errorMsg =
          e?.response?.data?.error?.message ||
          e?.message ||
          "Verification failed";
        setError(errorMsg);
        toast.payment.failed(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [ref, provider]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Payment Verification</h1>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-6 space-y-3">
        <div className="text-sm text-muted-foreground">Reference: {ref}</div>
        {result?.status === "PENDING" && (
          <div>
            <p className="font-medium">Awaiting Confirmation</p>
            <p className="text-sm text-muted-foreground">
              We are waiting for the payment provider to confirm your
              transaction. If you paid via Etegram bank transfer, your wallet
              will be credited automatically once the webhook is received.
            </p>
          </div>
        )}
        {result?.success && (
          <div>
            <p className="font-medium text-green-600">Payment Successful</p>
            <p className="text-sm text-muted-foreground">
              Amount: ₦{Number(result.amount || 0).toLocaleString()}
            </p>
          </div>
        )}
        {result && result.success === false && result.status !== "PENDING" && (
          <div>
            <p className="font-medium text-red-600">Payment Failed</p>
            <p className="text-sm text-muted-foreground">
              Status: {result.status}
            </p>
          </div>
        )}
        <div className="pt-2">
          <Button onClick={() => router.push("/wallet")} className="w-full">
            Back to Wallet
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
