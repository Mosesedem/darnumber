// Service mappings for display names
export const SERVICES: Record<string, { name: string; icon: string }> = {
  wa: { name: "WhatsApp", icon: "💬" },
  tg: { name: "Telegram", icon: "✈️" },
  go: { name: "Google", icon: "🔍" },
  fb: { name: "Facebook", icon: "👥" },
  ig: { name: "Instagram", icon: "📷" },
  tw: { name: "Twitter", icon: "🐦" },
  tt: { name: "TikTok", icon: "🎵" },
  vk: { name: "VKontakte", icon: "🔵" },
  ok: { name: "Odnoklassniki", icon: "🟠" },
  am: { name: "Amazon", icon: "📦" },
  mb: { name: "Microsoft", icon: "🪟" },
  ya: { name: "Yandex", icon: "🔴" },
  ma: { name: "Mail.ru", icon: "📧" },
  av: { name: "Avito", icon: "🛒" },
  uber: { name: "Uber", icon: "🚗" },
  netflix: { name: "Netflix", icon: "🎬" },
  spotify: { name: "Spotify", icon: "🎵" },
  discord: { name: "Discord", icon: "💬" },
  signal: { name: "Signal", icon: "🔒" },
  viber: { name: "Viber", icon: "📞" },
  wechat: { name: "WeChat", icon: "💬" },
  linkedin: { name: "LinkedIn", icon: "💼" },
  snapchat: { name: "Snapchat", icon: "👻" },
  reddit: { name: "Reddit", icon: "🤖" },
  twitch: { name: "Twitch", icon: "🎮" },
  yahoo: { name: "Yahoo", icon: "🟣" },
  apple: { name: "Apple", icon: "🍎" },
  steam: { name: "Steam", icon: "🎮" },
  paypal: { name: "PayPal", icon: "💰" },
  line: { name: "LINE", icon: "📱" },
  kakao: { name: "KakaoTalk", icon: "💬" },
};

export const getServiceName = (code: string): string => {
  const service = SERVICES[code.toLowerCase()];
  return service ? service.name : code.toUpperCase();
};

export const getServiceIcon = (code: string): string => {
  const service = SERVICES[code.toLowerCase()];
  return service?.icon || "📱";
};
