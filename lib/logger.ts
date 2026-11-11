import { createLogStack, type LogContext } from "logstack-js";

type Meta = Record<string, unknown>;

const LOG_LEVEL = (process.env.LOG_LEVEL || "warn").toLowerCase();
const DEBUG_ENABLED = LOG_LEVEL === "debug";
const INFO_ENABLED = DEBUG_ENABLED || LOG_LEVEL === "info";

const SENSITIVE_KEYS = new Set([
  "email",
  "password",
  "passwd",
  "token",
  "apikey",
  "authorization",
  "bearer",
  "bearertoken",
  "secret",
  "phone",
  "phonenumber",
  "mobile",
  "number",
  "sms",
  "smscode",
  "smsmessage",
  "smscontent",
  "parsedcode",
  "balance",
  "balancebefore",
  "balanceafter",
  "body",
  "externalid",
  "accesstoken",
  "refreshtoken",
  "otp",
  "pin",
  "cvv",
  "cardnumber",
  "accountnumber",
  "accountname",
  "bankaccount",
  "accesscode",
  "customercode",
  "authorizationurl",
  "href",
  "verificationid",
  "reservationid",
  "userid",
  "resp",
  "errortext",
  "errtext",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\-\s]/g, "");
}

function redactString(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\b\d{10,15}\b/g, "[redacted]")
    .replace(
      /(token|api[_-]?key|authorization|password|secret)=([^&\s"']+)/gi,
      "$1=[redacted]",
    )
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]*textverified\.com[^\s"'<>]*/gi, "[redacted-url]")
    .replace(/\blr_[A-Za-z0-9]+\b/g, "[redacted]")
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g, "[redacted]");
}

function redact(value: unknown, key: string | null = null): unknown {
  if (key && SENSITIVE_KEYS.has(normalizeKey(key))) return "[redacted]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" && key && SENSITIVE_KEYS.has(normalizeKey(key))) {
    return "[redacted]";
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = redact(child, childKey);
    }
    return out;
  }
  return value;
}

function serialize(value: unknown): unknown {
  return redact(value);
}

function toMetadata(args: unknown[]): Meta | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1) {
    const arg = redact(args[0]);
    if (arg instanceof Error) return { error: serialize(arg) as Meta };
    if (arg && typeof arg === "object" && !Array.isArray(arg)) {
      return arg as Meta;
    }
    return { value: arg as unknown };
  }
  return { extra: args.map((arg) => redact(arg)) };
}

function messageOf(value: unknown): string {
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return redactString(value.message);
  try {
    return redactString(JSON.stringify(redact(value)));
  } catch {
    return "[unserializable]";
  }
}

const apiKey =
  process.env.LOGSTACK_API_KEY ||
  process.env.NEXT_PUBLIC_LOGSTACK_API_KEY ||
  "";

const client = createLogStack({
  apiKey,
  endpoint: process.env.LOGSTACK_ENDPOINT || process.env.NEXT_PUBLIC_LOGSTACK_ENDPOINT,
  captureConsole: false,
  consoleInProduction: true,
  disabled: !apiKey,
  onError: (error) => {
    globalThis.console.error("[LogStack] Failed to ship logs", error);
  },
});

/**
 * App logger. Info is off unless LOG_LEVEL=info or LOG_LEVEL=debug.
 * Debug is off unless LOG_LEVEL=debug.
 * Emails, phone numbers, balances, tokens, verification ids, and SMS
 * content are redacted before anything is printed or shipped.
 */
export const logger = {
  debug: (message: unknown, ...args: unknown[]) => {
    if (!DEBUG_ENABLED) return;
    client.debug(messageOf(message), toMetadata(args));
  },
  info: (message: unknown, ...args: unknown[]) => {
    if (!INFO_ENABLED) return;
    client.info(messageOf(message), toMetadata(args));
  },
  log: (message: unknown, ...args: unknown[]) => {
    if (!INFO_ENABLED) return;
    client.info(messageOf(message), toMetadata(args));
  },
  warn: (message: unknown, ...args: unknown[]) =>
    client.warn(messageOf(message), toMetadata(args)),
  error: (message: unknown, ...args: unknown[]) =>
    client.error(messageOf(message), toMetadata(args)),
  critical: (message: unknown, ...args: unknown[]) =>
    client.critical(messageOf(message), toMetadata(args)),
  fatal: (message: unknown, ...args: unknown[]) =>
    client.fatal(messageOf(message), toMetadata(args)),
  flush: () => client.flush(),
  close: () => client.close(),
  setContext: (context: LogContext) => client.setContext(context),
  clearContext: () => client.clearContext(),
};

export type Logger = typeof logger;
