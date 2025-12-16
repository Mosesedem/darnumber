"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    userName: "",
    phone: "",
    country: "US",
    referralCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userNameAvailable, setUserNameAvailable] = useState<null | boolean>(
    null
  );
  const [checkingUserName, setCheckingUserName] = useState(false);

  // simple debounce util
  const debounce = (fn: (...args: any[]) => void, delay = 400) => {
    let timer: any;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const checkUserName = useMemo(
    () =>
      debounce(async (value: string) => {
        if (!value || value.trim().length < 3) {
          setUserNameAvailable(null);
          setCheckingUserName(false);
          return;
        }
        try {
          setCheckingUserName(true);
          const res = await fetch(
            `/api/auth/username?userName=${encodeURIComponent(value.trim())}`
          );
          const data = await res.json();
          if (!res.ok || !data?.ok) {
            setUserNameAvailable(null);
          } else {
            setUserNameAvailable(Boolean(data.available));
          }
        } catch {
          setUserNameAvailable(null);
        } finally {
          setCheckingUserName(false);
        }
      }, 500),
    []
  );

  useEffect(() => {
    checkUserName(formData.userName);
  }, [formData.userName, checkUserName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || undefined,
          email: formData.email,
          password: formData.password,
          userName: formData.userName,
          phone: formData.phone || undefined,
          country: formData.country || undefined,
          referralCode: formData.referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg = data?.error?.message || "Registration failed";
        setError(msg);
        toast.auth.signupError(msg);
      } else {
        toast.auth.signupSuccess();
        // Auto-login after successful signup
        const loginRes = await signIn("credentials", {
          identifier: formData.email,
          password: formData.password,
          redirect: false,
        });
        if (loginRes?.error) {
          // If auto-login fails, redirect to login page
          toast.info("Please sign in with your credentials.");
          router.push("/login?registered=true");
        } else {
          toast.auth.loginSuccess();
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError("Registration failed. Please try again.");
      toast.auth.signupError("Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-muted-foreground mt-2">
            Get started with SMS verification service
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="userName">Username</Label>
            <Input
              id="userName"
              name="userName"
              value={formData.userName}
              onChange={handleChange}
              placeholder="johndoe"
              required
              disabled={loading}
            />
            <div className="mt-1 text-xs">
              {checkingUserName && (
                <span className="text-muted-foreground">
                  Checking availability…
                </span>
              )}
              {!checkingUserName && userNameAvailable === true && (
                <span className="text-green-600">Username is available</span>
              )}
              {!checkingUserName && userNameAvailable === false && (
                <span className="text-red-600">Username is already taken</span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1234567890"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Must be at least 8 characters with uppercase, lowercase, and
              number
            </p>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="referralCode">Referral Code (Optional)</Label>
            <Input
              id="referralCode"
              name="referralCode"
              value={formData.referralCode}
              onChange={handleChange}
              placeholder="Enter referral code"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              userNameAvailable === false ||
              formData.userName.trim().length < 3
            }
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
