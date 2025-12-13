// ============================================
// NOTIFICATION SERVICE
// ============================================

import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import AWS from "aws-sdk";

const prisma = new PrismaClient();

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export class NotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Use AWS SES for production
    if (process.env.NODE_ENV === "production") {
      this.transporter = nodemailer.createTransport({
        SES: { ses, aws: AWS },
      });
    } else {
      // Use SMTP for development
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: parseInt(process.env.SMTP_PORT || "1025"),
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
    }
  }

  // ============================================
  // EMAIL NOTIFICATIONS
  // ============================================

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@smsservice.com",
        to,
        subject,
        html,
      });
      console.log(`✉️  Email sent to ${to}: ${subject}`);
    } catch (error) {
      console.error("Email sending error:", error);
      throw error;
    }
  }

  async sendSMSReceivedNotification(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true },
    });

    if (!user) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>SMS Code Received!</h2>
        <p>Hi ${user.userName},</p>
        <p>Your SMS verification code has been received:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h1 style="text-align: center; color: #333; margin: 0;">${data.smsCode}</h1>
        </div>
        <p><strong>Phone Number:</strong> ${data.phoneNumber}</p>
        <p><strong>Order ID:</strong> ${data.orderId}</p>
        <p>This code is now available in your dashboard.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, "SMS Code Received", html);
  }

  async sendOrderExpiredNotification(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true },
    });

    if (!user) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Expired</h2>
        <p>Hi ${user.userName},</p>
        <p>Your order has expired without receiving an SMS code.</p>
        <p><strong>Order ID:</strong> ${data.orderId}</p>
        <p>We have automatically refunded the amount to your account balance.</p>
        <p>You can place a new order from your dashboard.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, "Order Expired - Refund Processed", html);
  }

  async sendPaymentReceivedNotification(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true },
    });

    if (!user) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Received</h2>
        <p>Hi ${user.userName},</p>
        <p>Your payment has been successfully processed!</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
          <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
          <p><strong>Transaction ID:</strong> ${data.transactionNumber}</p>
          <p><strong>New Balance:</strong> ${data.currency} ${data.newBalance}</p>
        </div>
        <p>Your account has been credited and you can now place orders.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, "Payment Received Successfully", html);
  }

  async sendLowBalanceNotification(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true },
    });

    if (!user) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Low Balance Alert</h2>
        <p>Hi ${user.userName},</p>
        <p>Your account balance is running low.</p>
        <p><strong>Current Balance:</strong> ${data.currency} ${data.balance}</p>
        <p>To continue using our service, please add funds to your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/wallet" 
             style="background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Add Funds
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, "Low Balance Alert", html);
  }

  async sendWelcomeEmail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true, referralCode: true },
    });

    if (!user) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0ea5e9;">Welcome to SMS Service!</h1>
        <p>Hi ${user.userName},</p>
        <p>Thank you for joining us! Your account has been successfully created.</p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your Referral Code:</h3>
          <p style="font-size: 24px; font-weight: bold; color: #0ea5e9; margin: 10px 0;">
            ${user.referralCode}
          </p>
          <p>Share this code with friends and earn rewards!</p>
        </div>

        <h3>Getting Started:</h3>
        <ol>
          <li>Add funds to your wallet</li>
          <li>Browse available services</li>
          <li>Place your first order</li>
          <li>Receive SMS codes instantly</li>
        </ol>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Need help? Contact us at support@smsservice.com
        </p>
      </div>
    `;

    await this.sendEmail(user.email, "Welcome to SMS Service!", html);
  }

  // ============================================
  // PUSH NOTIFICATIONS (for mobile app)
  // ============================================

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any
  ) {
    // TODO: Implement FCM (Firebase Cloud Messaging) for mobile push notifications
    // This would require storing device tokens in the database
    console.log(`📱 Push notification to ${userId}: ${title}`);
  }

  // ============================================
  // IN-APP NOTIFICATIONS
  // ============================================

  async createInAppNotification(
    userId: string,
    title: string,
    message: string,
    type: string = "INFO"
  ) {
    // Store notification in database for in-app display
    // You might want to create a Notification model in Prisma schema
    console.log(`🔔 In-app notification to ${userId}: ${title}`);
  }
}
