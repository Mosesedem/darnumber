import { prisma } from "@/lib/server/prisma";
import { RedisService } from "@/lib/server/services/redis.service";

const redis = new RedisService();

export class PaymentService {
  async initializePayment(input: {
    userId: string;
    amount: number;
    provider: "etegram" | "paystack" | "flutterwave";
  }) {
    const { userId, amount, provider } = input;
    if (amount <= 0) throw new Error("Invalid amount");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true, phone: true, currency: true },
    });
    if (!user) throw new Error("User not found");

    if (provider === "etegram") {
      const projectId = process.env.ETEGRAM_PROJECT_ID;
      const publicKey = process.env.ETEGRAM_PUBLIC_KEY;
      if (!projectId || !publicKey)
        throw new Error(
          "Etegram credentials not configured. Please set ETEGRAM_PROJECT_ID and ETEGRAM_PUBLIC_KEY in .env"
        );

      const reference = `ETG-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const initUrl = `https://api-checkout.etegram.com/api/transaction/initialize/${projectId}`;
      const res = await fetch(initUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${publicKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount)),
          email: user.email,
          phone: user.phone || undefined,
          firstname: user.userName || undefined,
          lastname: undefined,
          reference,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Failed to initialize Etegram payment${errText ? ": " + errText : ""}`
        );
      }
      const data = (await res.json()) as any;
      const authUrl = data?.data?.authorization_url;
      const accessCode = data?.data?.access_code;
      const ref = data?.data?.reference || reference;
      if (!authUrl || !accessCode)
        throw new Error("Invalid Etegram init response");

      await prisma.transaction.create({
        data: {
          userId,
          transactionNumber: `DEP-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          type: "DEPOSIT",
          amount: Math.round(Number(amount)),
          currency: "NGN",
          balanceBefore: 0 as any,
          balanceAfter: 0 as any,
          status: "PENDING",
          description: "Deposit via Etegram",
          paymentMethod: "etegram",
          referenceId: ref,
          paymentDetails: { accessCode, authorizationUrl: authUrl },
        },
      });

      return { authorizationUrl: authUrl, reference: ref };
    }

    if (provider === "paystack") {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret)
        throw new Error(
          "Paystack secret not configured. Please set PAYSTACK_SECRET_KEY in .env"
        );

      const reference = `PST-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const res = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(Number(amount) * 100),
            email: user.email,
            currency: "NGN",
            reference,
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Failed to initialize Paystack payment${
            errText ? ": " + errText : ""
          }`
        );
      }
      const data = (await res.json()) as any;
      const authUrl = data?.data?.authorization_url;
      const ref = data?.data?.reference || reference;
      if (!authUrl || !ref) throw new Error("Invalid Paystack init response");

      await prisma.transaction.create({
        data: {
          userId,
          transactionNumber: `DEP-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          type: "DEPOSIT",
          amount: Math.round(Number(amount)),
          currency: "NGN",
          balanceBefore: 0 as any,
          balanceAfter: 0 as any,
          status: "PENDING",
          description: "Deposit via Paystack",
          paymentMethod: "paystack",
          referenceId: ref,
          paymentDetails: { authorizationUrl: authUrl },
        },
      });

      return { authorizationUrl: authUrl, reference: ref };
    }

    if (provider === "flutterwave") {
      const secret = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!secret)
        throw new Error(
          "Flutterwave secret not configured. Please set FLUTTERWAVE_SECRET_KEY in .env"
        );

      if (!process.env.NEXTAUTH_URL) {
        throw new Error(
          "Missing NEXTAUTH_URL for Flutterwave redirect. Set NEXTAUTH_URL (e.g., http://localhost:3000)."
        );
      }

      const reference = `FLW-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const body = {
        tx_ref: reference,
        amount: Math.round(Number(amount)),
        currency: "NGN",
        redirect_url: `${
          process.env.NEXTAUTH_URL || ""
        }/wallet/verify?ref=${reference}&provider=flutterwave`,
        customer: {
          email: user.email,
          phonenumber: user.phone,
          name: user.userName,
        },
        customizations: { title: "Wallet Top-up", description: "Fund wallet" },
      };

      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Failed to initialize Flutterwave${errText ? ": " + errText : ""}`
        );
      }
      const data = (await res.json()) as any;
      const link = data?.data?.link;
      if (!link) throw new Error("Invalid Flutterwave init response");

      await prisma.transaction.create({
        data: {
          userId,
          transactionNumber: `DEP-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          type: "DEPOSIT",
          amount: Math.round(Number(amount)),
          currency: "NGN",
          balanceBefore: 0 as any,
          balanceAfter: 0 as any,
          status: "PENDING",
          description: "Deposit via Flutterwave",
          paymentMethod: "flutterwave",
          referenceId: reference,
          paymentDetails: { link },
        },
      });

      return { authorizationUrl: link, reference };
    }

    throw new Error("Payment provider not implemented");
  }

  async verifyPayment(input: {
    userId: string;
    reference: string;
    provider: "etegram" | "paystack" | "flutterwave";
  }) {
    const { userId, reference, provider } = input;
    const txn = await prisma.transaction.findFirst({
      where: {
        userId,
        type: "DEPOSIT",
        referenceId: reference,
        status: "PENDING",
      },
    });
    if (!txn) throw new Error("Pending transaction not found");

    if (provider === "paystack") {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret)
        throw new Error(
          "Paystack secret not configured. Please set PAYSTACK_SECRET_KEY in .env"
        );
      const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
      const res = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Failed to verify Paystack payment${errText ? ": " + errText : ""}`
        );
      }
      const data = (await res.json()) as any;
      const status = data?.data?.status?.toLowerCase();
      const paid = status === "success";
      const amountPaid = Number(data?.data?.amount ?? 0) / 100;

      if (!paid)
        return { success: false, status: data?.data?.status || "failed" };

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true, currency: true },
        });
        if (!user) throw new Error("User not found");
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountPaid } },
        });
        await tx.transaction.update({
          where: { id: txn.id },
          data: {
            status: "COMPLETED",
            balanceBefore: user.balance,
            balanceAfter: Number(user.balance) + amountPaid,
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            action: "DEPOSIT_COMPLETED",
            resource: "transaction",
            resourceId: txn.id,
            metadata: { provider, reference, amount: amountPaid },
          },
        });
      });
      await redis.invalidateUserBalance(userId);
      return {
        success: true,
        status: "success",
        amount: amountPaid,
        reference,
      };
    }

    if (provider === "flutterwave") {
      const secret = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!secret)
        throw new Error(
          "Flutterwave secret not configured. Please set FLUTTERWAVE_SECRET_KEY in .env"
        );
      const verifyUrl = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`;
      const res = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Failed to verify Flutterwave payment${errText ? ": " + errText : ""}`
        );
      }
      const data = (await res.json()) as any;
      const status = (data?.data?.status || "").toString().toLowerCase();
      const paid = status === "successful" || status === "success";
      const amountPaid = Number(data?.data?.amount ?? txn.amount);

      if (!paid)
        return { success: false, status: data?.data?.status || "failed" };

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true, currency: true },
        });
        if (!user) throw new Error("User not found");
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountPaid } },
        });
        await tx.transaction.update({
          where: { id: txn.id },
          data: {
            status: "COMPLETED",
            balanceBefore: user.balance,
            balanceAfter: Number(user.balance) + amountPaid,
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            action: "DEPOSIT_COMPLETED",
            resource: "transaction",
            resourceId: txn.id,
            metadata: { provider, reference, amount: amountPaid },
          },
        });
      });
      await redis.invalidateUserBalance(userId);
      return {
        success: true,
        status: "success",
        amount: amountPaid,
        reference,
      };
    }

    if (provider === "etegram") {
      const projectId = process.env.ETEGRAM_PROJECT_ID;
      const publicKey = process.env.ETEGRAM_PUBLIC_KEY;
      if (!projectId || !publicKey)
        throw new Error(
          "Etegram credentials not configured. Please set ETEGRAM_PROJECT_ID and ETEGRAM_PUBLIC_KEY in .env"
        );
      const accessCode = (txn.paymentDetails as any)?.accessCode;

      // Etegram uses webhook for verification, so return pending status
      return {
        success: false,
        status: "PENDING",
        message: "Awaiting Etegram webhook confirmation",
      };
    }

    throw new Error("Payment provider not implemented");
  }
  async requestWithdrawal(userId: string, amount: number, bankDetails: any) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (Number(user.balance) < amount) throw new Error("Insufficient balance");
    if (amount < 10) throw new Error("Minimum withdrawal amount is $10");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });
      await tx.transaction.create({
        data: {
          userId,
          transactionNumber: `WD-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`,
          type: "WITHDRAWAL",
          amount,
          currency: user.currency,
          balanceBefore: user.balance,
          balanceAfter: Number(user.balance) - amount,
          status: "PENDING",
          description: "Withdrawal to bank account",
          paymentMethod: "bank_transfer",
          paymentDetails: bankDetails,
        },
      });
    });

    await redis.invalidateUserBalance(userId);
    return {
      message:
        "Withdrawal request submitted. Processing time: 1-3 business days",
    };
  }

  private async completeDeposit(
    userId: string,
    transactionId: string,
    amount: number,
    meta: Record<string, unknown>
  ) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) throw new Error("User not found");
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: "COMPLETED",
          balanceBefore: user.balance,
          balanceAfter: Number(user.balance) + amount,
        },
      });
      await tx.activityLog.create({
        data: {
          userId,
          action: "DEPOSIT_COMPLETED",
          resource: "transaction",
          resourceId: transactionId,
          metadata: meta,
        },
      });
    });
    await redis.invalidateUserBalance(userId);
  }

  async handleEtegramWebhook(payload: any) {
    const reference: string | undefined =
      payload?.reference || payload?.data?.reference;
    const status = (payload?.status || payload?.data?.status || "")
      .toString()
      .toLowerCase();
    const amount = Number(payload?.amount ?? payload?.data?.amount ?? 0);
    if (!reference) return { ok: false };
    const txn = await prisma.transaction.findFirst({
      where: { referenceId: reference },
    });
    if (!txn || txn.status !== "PENDING") return { ok: true };
    if (!(status === "successful" || status === "success"))
      return { ok: false };
    await this.completeDeposit(txn.userId, txn.id, amount, {
      provider: "etegram",
      reference,
    });
    return { ok: true };
  }

  async handlePaystackWebhook(rawBody: string, signature: string | null) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return { ok: false, status: 400 };
    const crypto = await import("crypto");
    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");
    if (!signature || signature !== hash) return { ok: false, status: 401 };

    const event = JSON.parse(rawBody);
    console.log(
      "[Paystack Webhook] Event:",
      event?.event,
      "Data:",
      JSON.stringify(event?.data || {}).substring(0, 200)
    );

    // Handle regular charge success (card/bank transfer/USSD payments)
    if (event?.event === "charge.success") {
      const ref = event?.data?.reference;
      const amount = Number(event?.data?.amount ?? 0) / 100;

      if (ref) {
        const txn = await prisma.transaction.findFirst({
          where: { referenceId: ref },
        });
        if (txn && txn.status === "PENDING") {
          console.log(
            "[Paystack Webhook] Completing charge for ref:",
            ref,
            "amount:",
            amount
          );
          await this.completeDeposit(txn.userId, txn.id, amount, {
            provider: "paystack",
            reference: ref,
            channel: event?.data?.channel,
          });
        }
      }
    }

    // Handle dedicated virtual account transactions
    // Event: "charge.success" with paid_at and customer details
    // Or sometimes "customeridentification.success" for DVA assignment
    if (event?.event === "charge.success" && event?.data?.customer?.email) {
      const customerEmail = event?.data?.customer?.email;
      const amount = Number(event?.data?.amount ?? 0) / 100;
      const paidAt = event?.data?.paid_at;
      const channel = event?.data?.channel; // "dedicated_nuban" for virtual account

      // Check if this is a DVA transaction (no reference from our system)
      if (
        channel === "dedicated_nuban" ||
        (paidAt && !event?.data?.metadata?.created_from_initialize)
      ) {
        console.log(
          "[Paystack Webhook] DVA transaction detected for:",
          customerEmail,
          "amount:",
          amount,
          "channel:",
          channel
        );

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });

        if (user) {
          // Create a new transaction for this DVA deposit
          const transactionNumber = `DVA-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`;
          const reference = event?.data?.reference || transactionNumber;

          // Check if we already processed this reference
          const existingTxn = await prisma.transaction.findFirst({
            where: { referenceId: reference },
          });

          if (!existingTxn) {
            console.log(
              "[Paystack Webhook] Creating new DVA transaction for user:",
              user.id
            );

            const newTxn = await prisma.transaction.create({
              data: {
                userId: user.id,
                transactionNumber,
                type: "DEPOSIT",
                amount: amount,
                currency: "NGN",
                balanceBefore: 0 as any,
                balanceAfter: 0 as any,
                status: "PENDING",
                description: "Deposit via Paystack Virtual Account",
                paymentMethod: "paystack",
                referenceId: reference,
                paymentDetails: {
                  channel,
                  paidAt,
                  customer: event?.data?.customer,
                },
              },
            });

            await this.completeDeposit(user.id, newTxn.id, amount, {
              provider: "paystack",
              reference,
              channel,
              type: "virtual_account",
            });

            console.log(
              "[Paystack Webhook] DVA deposit completed for user:",
              user.id,
              "txn:",
              newTxn.id
            );
          } else {
            console.log(
              "[Paystack Webhook] DVA transaction already exists, skipping:",
              reference
            );
          }
        } else {
          console.log(
            "[Paystack Webhook] User not found for email:",
            customerEmail
          );
        }
      }
    }

    return { ok: true, status: 200 };
  }

  async handleFlutterwaveWebhook(rawBody: string, signature: string | null) {
    const webhookHash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!webhookHash || !signature || signature !== webhookHash)
      return { ok: false, status: 401 };
    const event = JSON.parse(rawBody);
    const status = (event?.data?.status || "").toString().toLowerCase();
    if (status === "successful") {
      const ref = event?.data?.tx_ref;
      const amount = Number(event?.data?.amount ?? 0);
      if (ref) {
        const txn = await prisma.transaction.findFirst({
          where: { referenceId: ref },
        });
        if (txn && txn.status === "PENDING")
          await this.completeDeposit(txn.userId, txn.id, amount, {
            provider: "flutterwave",
            reference: ref,
          });
      }
    }
    return { ok: true, status: 200 };
  }

  async requestPaystackDedicatedAccount(
    userId: string,
    preferredBank?: string
  ) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack secret not configured");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (!user.email)
      throw new Error(
        "User missing email. A Paystack customer requires an email address."
      );
    console.log(
      "[DVA][Service] user=",
      userId,
      "preferredBank=",
      preferredBank,
      "currency=",
      user.currency
    );
    // Try to find an existing Paystack customer by email via listing
    let customerCode: string | undefined;
    try {
      const listRes = await fetch(
        `https://api.paystack.co/customer?perPage=50&page=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (listRes.ok) {
        const listJson = (await listRes.json()) as any;
        const match = Array.isArray(listJson?.data)
          ? listJson.data.find(
              (c: any) =>
                (c?.email || "").toLowerCase() === user.email.toLowerCase()
            )
          : undefined;
        if (match?.customer_code) customerCode = match.customer_code;
        console.log("[DVA][Service] matchedCustomer=", match?.customer_code);
      }
    } catch {}

    // If not found, create a new customer
    if (!customerCode) {
      const custRes = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          first_name: user.userName,
          phone: user.phone,
        }),
      });
      if (!custRes.ok) {
        const errText = await custRes.text().catch(() => "");
        throw new Error(
          `Failed to create Paystack customer${errText ? ": " + errText : ""}`
        );
      }
      const cust = (await custRes.json()) as any;
      customerCode = cust?.data?.customer_code;
      console.log("[DVA][Service] createdCustomerCode=", customerCode);
      if (!customerCode) {
        throw new Error(
          "Failed to create Paystack customer: missing customer_code"
        );
      }
    }

    const assignRes = await fetch(
      "https://api.paystack.co/dedicated_account/assign",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: (preferredBank || "wema-bank").toLowerCase(),
          // country and currency can help avoid ambiguous defaults
          country: "NG",
          currency: "NGN",
          // Required customer identity fields for assignment
          first_name: (user.userName || "").split(" ")[0] || "User",
          last_name:
            (user.userName || "").split(" ")[1] ||
            (user.userName ? user.userName : "User"),
          email: user.email,
          phone: user.phone || undefined,
        }),
      }
    );
    if (!assignRes.ok) {
      const errText = await assignRes.text().catch(() => "");
      console.error(
        "[DVA][Service][Assign][ERROR] code=",
        customerCode,
        "resp=",
        errText
      );
      throw new Error(
        `Failed to assign dedicated account${errText ? ": " + errText : ""}`
      );
    }
    const assign = (await assignRes.json()) as any;
    const bankName = assign?.data?.bank?.name;
    const accountNumber = assign?.data?.account_number;
    const accountName = assign?.data?.account_name;
    console.log("[DVA][Service] assigned=", {
      bankName,
      accountNumber,
      accountName,
    });
    // Paystack may respond with an in-progress status; surface as pending
    if (!bankName || !accountNumber || !accountName) {
      const msg = (assign?.message || "").toString().toLowerCase();
      if (msg.includes("in progress") || msg.includes("pending")) {
        return {
          status: "PENDING",
          message: assign?.message || "Assign dedicated account in progress",
        } as any;
      }
      throw new Error(
        `Invalid dedicated account response: ${JSON.stringify(assign)}`
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { bankName, accountNumber, bankAccount: accountName },
    });
    await prisma.activityLog.create({
      data: {
        userId,
        action: "DVA_ASSIGNED",
        resource: "user",
        resourceId: userId,
        metadata: { bankName, accountNumber },
      },
    });
    return { bankName, accountNumber, accountName };
  }
  async getPaymentHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, type: { in: ["DEPOSIT", "WITHDRAWAL"] } },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({
        where: { userId, type: { in: ["DEPOSIT", "WITHDRAWAL"] } },
      }),
    ]);
    return {
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
