"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Shield,
  Zap,
  Globe,
  Check,
  ChevronRight,
  Menu,
  X,
  Clock,
  Star,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import {
  SiWhatsapp,
  SiTelegram,
  SiGoogle,
  SiFacebook,
  SiX,
  SiInstagram,
  SiTiktok,
  SiDiscord,
  SiNetflix,
  SiUber,
  SiAmazon,
  SiPaypal,
} from "react-icons/si";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Shield,
      title: "Secure & Private",
      description:
        "Your verification codes are encrypted and never shared. Complete privacy for all your accounts.",
    },
    {
      icon: Zap,
      title: "Instant Delivery",
      description:
        "Receive SMS codes within seconds. Our network ensures 99.9% delivery rate.",
    },
    {
      icon: Globe,
      title: "Global Coverage",
      description:
        "Access phone numbers from 50+ countries for any verification service worldwide.",
    },
    {
      icon: Clock,
      title: "24/7 Availability",
      description:
        "Our service runs around the clock. Get verified anytime, anywhere.",
    },
  ];

  const services = [
    { name: "WhatsApp", Icon: SiWhatsapp, color: "#25D366", popular: true },
    { name: "Telegram", Icon: SiTelegram, color: "#26A5E4", popular: true },
    { name: "Google", Icon: SiGoogle, color: "#4285F4", popular: true },
    { name: "Facebook", Icon: SiFacebook, color: "#1877F2", popular: false },
    { name: "X (Twitter)", Icon: SiX, color: "#000000", popular: false },
    { name: "Instagram", Icon: SiInstagram, color: "#E4405F", popular: false },
    { name: "TikTok", Icon: SiTiktok, color: "#010101", popular: false },
    { name: "Discord", Icon: SiDiscord, color: "#5865F2", popular: false },
    { name: "Netflix", Icon: SiNetflix, color: "#E50914", popular: false },
    { name: "Uber", Icon: SiUber, color: "#000000", popular: false },
    { name: "Amazon", Icon: SiAmazon, color: "#FF9900", popular: false },
    { name: "PayPal", Icon: SiPaypal, color: "#003087", popular: false },
  ];

  // pricing removed by request

  const steps = [
    {
      number: "01",
      title: "Choose a Service",
      description:
        "Select the app or platform you need to verify (WhatsApp, Telegram, etc.)",
    },
    {
      number: "02",
      title: "Get Your Number",
      description:
        "Receive an instant virtual phone number from your preferred country.",
    },
    {
      number: "03",
      title: "Receive SMS Code",
      description:
        "Enter the number in the app and get your verification code in seconds.",
    },
  ];

  const testimonials = [
    {
      name: "Adebayo O.",
      role: "App Developer",
      content:
        "DarNumber saved me countless hours testing my apps. The instant delivery is impressive!",
      rating: 5,
    },
    {
      name: "Sarah M.",
      role: "Digital Marketer",
      content:
        "Managing multiple social media accounts has never been easier. Highly recommended!",
      rating: 5,
    },
    {
      name: "Emeka C.",
      role: "Business Owner",
      content:
        "Reliable, fast, and affordable. Best SMS verification service I've used in Nigeria.",
      rating: 5,
    },
  ];

  const stats = [
    { value: "500K+", label: "Verifications Completed" },
    { value: "50+", label: "Countries Supported" },
    { value: "99.9%", label: "Delivery Rate" },
    { value: "24/7", label: "Customer Support" },
  ];

  // Hero verification animation state (looping)
  const targetCode = "482916";
  const [enteredCode, setEnteredCode] = useState("");
  const [phase, setPhase] = useState<"typing" | "processing" | "verified">(
    "typing"
  );
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
    clearTimers();

    if (phase === "typing") {
      setEnteredCode("");
      // type each digit
      targetCode.split("").forEach((ch, idx) => {
        const t = window.setTimeout(() => {
          setEnteredCode((prev) => prev + ch);
          if (idx === targetCode.length - 1) {
            const t2 = window.setTimeout(() => setPhase("processing"), 450);
            timersRef.current.push(t2);
          }
        }, 220 * (idx + 1));
        timersRef.current.push(t);
      });
    } else if (phase === "processing") {
      const t = window.setTimeout(() => setPhase("verified"), 650);
      timersRef.current.push(t);
    } else if (phase === "verified") {
      const t = window.setTimeout(() => setPhase("typing"), 2000);
      timersRef.current.push(t);
    }

    return () => {
      clearTimers();
    };
  }, [phase, targetCode]);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">
                  DarNumber
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#features"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                How it Works
              </Link>
              <Link
                href="#pricing"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                Pricing
              </Link>
              <Link
                href="#services"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                Services
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-3">
              <Link
                href="#features"
                className="block px-3 py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="block px-3 py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it Works
              </Link>
              <Link
                href="#pricing"
                className="block px-3 py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="#services"
                className="block px-3 py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </Link>
              <div className="pt-4 space-y-2 border-t">
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup" className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                🚀 Nigeria&apos;s #1 SMS Verification Service
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Verify Accounts{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Instantly
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                Get virtual phone numbers for SMS verification. Works with
                WhatsApp, Telegram, Google, and 7,500+ services. Fast, secure,
                and affordable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-lg px-8"
                  >
                    Start Verifying
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto text-lg px-8"
                  >
                    See How It Works
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-8 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  No SIM card needed
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Instant delivery
                </div>
              </div>
            </div>
            <div className="relative">
              <div
                className={`relative z-10 mx-auto max-w-md transition-all duration-500 ${
                  phase === "verified"
                    ? "ring-4 ring-green-300/40 rounded-[1.2rem]"
                    : ""
                }`}
              >
                {/* Typing / Processing Card */}
                <div
                  className={`absolute inset-0 ${
                    phase === "verified"
                      ? "opacity-0 -translate-y-2 scale-95 pointer-events-none"
                      : "opacity-100 translate-y-0 scale-100"
                  } transition-all duration-500 ease-out`}
                  aria-hidden={phase === "verified"}
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-blue-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <MessageCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">WhatsApp Verification</p>
                          <p className="text-sm text-gray-500">+234 XXX XXX XXXX</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-sm text-gray-500 mb-3">Your verification code:</p>
                      <div className="flex gap-2 justify-center" aria-live="polite">
                        {Array.from({ length: targetCode.length }).map((_, i) => {
                          const isFilled = i < enteredCode.length;
                          const char = isFilled ? enteredCode[i] : "";
                          return (
                            <div
                              key={i}
                              className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all duration-300 ${
                                isFilled
                                  ? "bg-blue-50 border-blue-400 text-blue-700 scale-105"
                                  : "bg-white border-blue-200 text-blue-600"
                              }`}
                            >
                              {char}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{phase === "typing" ? "Receiving SMS…" : "Received code"}</span>
                      <span
                        className={`font-medium ${
                          phase === "processing" ? "text-blue-600 animate-pulse" : "text-gray-400"
                        }`}
                      >
                        {phase === "processing" ? "Processing" : "Awaiting"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verified Card (pop-in) */}
                <div
                  className={`relative ${
                    phase === "verified"
                      ? "opacity-100 translate-y-0 scale-100"
                      : "opacity-0 translate-y-2 scale-95 pointer-events-none"
                  } transition-all duration-500 ease-out`}
                  aria-hidden={phase !== "verified"}
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-green-200">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Verification Successful</p>
                          <p className="text-sm text-gray-500">+234 XXX XXX XXXX</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white">Verified</Badge>
                    </div>
                    <div className="bg-green-50 rounded-xl p-5 mb-2">
                      <p className="text-sm text-green-700 mb-2">Code accepted:</p>
                      <div className="flex gap-2 justify-center">
                        {targetCode.split("").map((d, i) => (
                          <div
                            key={i}
                            className="w-10 h-12 rounded-lg border-2 border-green-300 bg-white flex items-center justify-center text-xl font-bold text-green-700"
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center">Looping demo — new code incoming…</p>
                  </div>
                </div>
              </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-72 h-72 bg-purple-200 rounded-full blur-3xl opacity-40"></div>
                            <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-72 h-72 bg-blue-200 rounded-full blur-3xl opacity-40"></div>
            </div>
          </div>
        </div>
      </section>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-white">
                  {stat.value}
                </p>
                <p className="text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose DarNumber?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The most reliable SMS verification service designed for
              developers, marketers, and businesses in Nigeria and beyond.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={i}
                  className="p-6 hover:shadow-lg transition-shadow border-0 bg-gray-50"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 bg-gradient-to-b from-gray-50 to-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700">
              How It Works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Get Verified in 3 Simple Steps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              No technical knowledge required. Get your verification code in
              under a minute.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-white rounded-2xl p-8 shadow-sm border hover:shadow-md transition-shadow">
                  <div className="text-5xl font-bold text-blue-100 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 text-green-700">
              Supported Services
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Works with Your Favorite Apps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Verify accounts on 7,500+ platforms and services. New services
              added weekly.
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {services.map((service, i) => {
              const Icon = service.Icon as any;
              return (
                <div
                  key={i}
                  className="relative bg-white rounded-xl p-4 text-center border hover:shadow-md transition-shadow cursor-pointer group"
                >
                  {service.popular && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-center">
                    <Icon size={28} style={{ color: service.color }} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                    {service.name}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-center text-gray-500 mt-8">
            And 7,500+ more services…
          </p>
        </div>
      </section>

      {/* Showcase Section (alternating image/text) */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-1 md:order-none">
              <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-blue-100 via-white to-purple-100 border flex items-center justify-center text-sm text-gray-500">
                Add your image here
              </div>
            </div>
            <div>
              <Badge className="mb-4 bg-blue-100 text-blue-700">
                Simple & Fast
              </Badge>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                Get numbers in seconds
              </h3>
              <p className="text-gray-600 mb-6">
                Reserve a number from your preferred country, use it instantly,
                and receive your code with industry-leading delivery speed.
              </p>
              <div className="flex gap-3">
                <Link href="/signup">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Create Account
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline">How it works</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="md:order-2">
              <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-emerald-100 via-white to-blue-100 border flex items-center justify-center text-sm text-gray-500">
                Add your image here
              </div>
            </div>
            <div className="md:order-1">
              <Badge className="mb-4 bg-emerald-100 text-emerald-700">
                Modern & Flexible
              </Badge>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                Designed for real workflows
              </h3>
              <p className="text-gray-600 mb-6">
                Clean, minimal UI with delightful interactions. Optimized for
                speed, clarity, and accessibility across devices.
              </p>
              <div className="flex gap-3">
                <Link href="/dashboard">
                  <Button variant="secondary">Explore Dashboard</Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline">Talk to sales</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section removed by request */}

      {/* Testimonials Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-100 text-yellow-700">
              Testimonials
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Thousands
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See what our customers have to say about DarNumber.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-5 h-5 text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust DarNumber for their SMS
            verification needs. Sign up today and get your first verification
            free!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto text-lg px-8"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-lg px-8 text-white border-white hover:bg-white/10"
              >
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">DarNumber</span>
              </Link>
              <p className="text-sm">
                Nigeria&apos;s trusted SMS verification service. Fast, secure,
                and affordable virtual numbers for all your verification needs.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-white transition"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-white transition">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="#services"
                    className="hover:text-white transition"
                  >
                    Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="hover:text-white transition"
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white transition">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    API Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm">
              © {new Date().getFullYear()} DarNumber. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="#" className="hover:text-white transition">
                <span className="sr-only">Twitter</span>
                𝕏
              </Link>
              <Link href="#" className="hover:text-white transition">
                <span className="sr-only">Facebook</span>
                📘
              </Link>
              <Link href="#" className="hover:text-white transition">
                <span className="sr-only">Instagram</span>
                📷
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
