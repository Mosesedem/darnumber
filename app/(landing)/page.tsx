import Link from "next/link";
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
} from "lucide-react";
import {
  SiWhatsapp,
  SiTelegram,
  SiGoogle,
  SiFacebook,
  SiInstagram,
  SiTiktok,
  SiDiscord,
  SiNetflix,
  SiUber,
  SiAmazon,
  SiPaypal,
} from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { WhatsAppVerification } from "@/components/WhatsAppVerification";
import { NumberSelectionAnimation } from "@/components/NumberSelectionAnimation";
import { DashboardAnimation } from "@/components/DashboardAnimation";
import NavBar from "@/components/Navbar";
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
  { name: "X (Twitter)", Icon: FaXTwitter, color: "#000000", popular: false },
  { name: "Instagram", Icon: SiInstagram, color: "#E4405F", popular: false },
  { name: "TikTok", Icon: SiTiktok, color: "#010101", popular: false },
  { name: "Discord", Icon: SiDiscord, color: "#5865F2", popular: false },
  { name: "Netflix", Icon: SiNetflix, color: "#E50914", popular: false },
  { name: "Uber", Icon: SiUber, color: "#000000", popular: false },
  { name: "Amazon", Icon: SiAmazon, color: "#FF9900", popular: false },
  { name: "PayPal", Icon: SiPaypal, color: "#003087", popular: false },
];

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

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <NavBar />
      {/* Hero Section */}
      <section
        className="relative overflow-hidden top-8"
        style={{ background: "var(--linear-hero)" }}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left order-1 lg:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10 border-primary/20">
                🚀 Nigeria&apos;s #1 SMS Verification Service
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
                Verify Accounts{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary">
                  Instantly
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                Get virtual phone numbers for SMS verification. Works with
                WhatsApp, Telegram, Google, and 7,500+ services. Fast, secure,
                and affordable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="w-full sm:w-auto text-base px-8"
                  asChild
                >
                  <Link href="/login">
                    Start Verifying
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base px-8"
                  asChild
                >
                  <Link href="/#how-it-works">See How It Works</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  No SIM card needed
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  Instant delivery
                </div>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="relative order-2 lg:order-2 flex justify-center">
              <WhatsAppVerification />

              {/* Decorative blurs */}
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-48 md:w-72 h-48 md:h-72 bg-purple-300 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-48 md:w-72 h-48 md:h-72 bg-primary/30 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-10 md:py-12 bg-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-background">
                  {stat.value}
                </p>
                <p className="text-muted text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
              Features
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose DarNumber?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              The most reliable SMS verification service designed for
              developers, marketers, and businesses in Nigeria and beyond.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={i}
                  className="p-6 hover:shadow-lg transition-shadow border bg-card"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="py-16 md:py-24 lg:py-28 bg-muted/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100">
              How It Works
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get Verified in 3 Simple Steps
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              No technical knowledge required. Get your verification code in
              under a minute.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border hover:shadow-md transition-shadow">
                  <div className="text-4xl md:text-5xl font-bold text-primary/20 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {step.description}
                  </p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 md:py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-success/10 text-success hover:bg-success/10">
              Supported Services
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Works with Your Favorite Apps
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Verify accounts on 7,500+ platforms and services. New services
              added weekly.
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {services.map((service, i) => {
              const Icon = service.Icon;
              return (
                <div
                  key={i}
                  className="relative bg-card rounded-xl p-3 sm:p-4 text-center border hover:shadow-md transition-shadow cursor-pointer group"
                >
                  {service.popular && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-warning rounded-full flex items-center justify-center">
                      <Star className="w-3 h-3 text-warning-foreground fill-warning-foreground" />
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-center">
                    <Icon size={24} style={{ color: service.color }} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {service.name}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-center text-muted-foreground mt-8 text-sm sm:text-base">
            And 7,500+ more services…
          </p>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-16 md:py-24 lg:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 md:space-y-24">
          {/* Get numbers in seconds */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="flex justify-center">
              <NumberSelectionAnimation />
            </div>
            <div className="text-center md:text-left">
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
                Simple & Fast
              </Badge>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3">
                Get numbers in seconds
              </h3>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                Reserve a number from your preferred country, use it instantly,
                and receive your code with industry-leading delivery speed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button asChild>
                  <Link href="/signup">Create Account</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/#how-it-works">How it works</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Designed for real workflows */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="md:order-2 flex justify-center">
              <DashboardAnimation />
            </div>
            <div className="md:order-1 text-center md:text-left">
              <Badge className="mb-4 bg-success/10 text-success hover:bg-success/10">
                Modern & Flexible
              </Badge>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3">
                Designed for real workflows
              </h3>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                Clean, minimal UI with delightful interactions. Optimized for
                speed, clarity, and accessibility across devices.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button variant="default" asChild>
                  <Link href="/dashboard">Explore Dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-warning/10 text-warning hover:bg-warning/10">
              Testimonials
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by Thousands
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              See what our customers have to say about DarNumber.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-5 h-5 text-warning fill-warning"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  &quot;{testimonial.content}&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 lg:py-28 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust DarNumber for their SMS
            verification needs. Sign up today and get your first verification
            free!
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-base px-8"
            asChild
          >
            <Link href="/signup">
              Create Free Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-linear-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-background">
                  DarNumber
                </span>
              </Link>
              <p className="text-sm text-muted">
                Nigeria&apos;s trusted SMS verification service. Fast, secure,
                and affordable virtual numbers for all your verification needs.
              </p>
            </div>
            <div>
              <h4 className="text-background font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#features"
                    className="hover:text-background transition"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-background transition"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#services"
                    className="hover:text-background transition"
                  >
                    Services
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Dashboard
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-background font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-background transition">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-background font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-background transition">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    API Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-background transition">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              © {new Date().getFullYear()} DarNumber. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-background transition text-lg">
                𝕏
              </a>
              <a href="#" className="hover:text-background transition text-lg">
                📘
              </a>
              <a href="#" className="hover:text-background transition text-lg">
                📷
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
