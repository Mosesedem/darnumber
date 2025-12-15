// Country configuration with flags and metadata
export const COUNTRIES = {
  US: { name: "United States", flag: "🇺🇸", code: "US" },
  GB: { name: "United Kingdom", flag: "🇬🇧", code: "GB" },
  CA: { name: "Canada", flag: "🇨🇦", code: "CA" },
  AU: { name: "Australia", flag: "🇦🇺", code: "AU" },
  DE: { name: "Germany", flag: "🇩🇪", code: "DE" },
  FR: { name: "France", flag: "🇫🇷", code: "FR" },
  IN: { name: "India", flag: "🇮🇳", code: "IN" },
  BR: { name: "Brazil", flag: "🇧🇷", code: "BR" },
  NG: { name: "Nigeria", flag: "🇳🇬", code: "NG" },
  KE: { name: "Kenya", flag: "🇰🇪", code: "KE" },
  ZA: { name: "South Africa", flag: "🇿🇦", code: "ZA" },
  GH: { name: "Ghana", flag: "🇬🇭", code: "GH" },
  KG: { name: "Kyrgyzstan", flag: "🇰🇬", code: "KG" },
  RU: { name: "Russia", flag: "🇷🇺", code: "RU" },
  CN: { name: "China", flag: "🇨🇳", code: "CN" },
  JP: { name: "Japan", flag: "🇯🇵", code: "JP" },
  MX: { name: "Mexico", flag: "🇲🇽", code: "MX" },
  IT: { name: "Italy", flag: "🇮🇹", code: "IT" },
  ES: { name: "Spain", flag: "🇪🇸", code: "ES" },
  NL: { name: "Netherlands", flag: "🇳🇱", code: "NL" },
  PL: { name: "Poland", flag: "🇵🇱", code: "PL" },
  UA: { name: "Ukraine", flag: "🇺🇦", code: "UA" },
  ID: { name: "Indonesia", flag: "🇮🇩", code: "ID" },
  TR: { name: "Turkey", flag: "🇹🇷", code: "TR" },
  TH: { name: "Thailand", flag: "🇹🇭", code: "TH" },
  PH: { name: "Philippines", flag: "🇵🇭", code: "PH" },
  VN: { name: "Vietnam", flag: "🇻🇳", code: "VN" },
  MY: { name: "Malaysia", flag: "🇲🇾", code: "MY" },
  SG: { name: "Singapore", flag: "🇸🇬", code: "SG" },
  AR: { name: "Argentina", flag: "🇦🇷", code: "AR" },
  CO: { name: "Colombia", flag: "🇨🇴", code: "CO" },
  EG: { name: "Egypt", flag: "🇪🇬", code: "EG" },
  SA: { name: "Saudi Arabia", flag: "🇸🇦", code: "SA" },
  AE: { name: "United Arab Emirates", flag: "🇦🇪", code: "AE" },
  IL: { name: "Israel", flag: "🇮🇱", code: "IL" },
  SE: { name: "Sweden", flag: "🇸🇪", code: "SE" },
  NO: { name: "Norway", flag: "🇳🇴", code: "NO" },
  DK: { name: "Denmark", flag: "🇩🇰", code: "DK" },
  FI: { name: "Finland", flag: "🇫🇮", code: "FI" },
  BE: { name: "Belgium", flag: "🇧🇪", code: "BE" },
  CH: { name: "Switzerland", flag: "🇨🇭", code: "CH" },
  AT: { name: "Austria", flag: "🇦🇹", code: "AT" },
  PT: { name: "Portugal", flag: "🇵🇹", code: "PT" },
  GR: { name: "Greece", flag: "🇬🇷", code: "GR" },
  CZ: { name: "Czech Republic", flag: "🇨🇿", code: "CZ" },
  RO: { name: "Romania", flag: "🇷🇴", code: "RO" },
  HU: { name: "Hungary", flag: "🇭🇺", code: "HU" },
  BG: { name: "Bulgaria", flag: "🇧🇬", code: "BG" },
  NZ: { name: "New Zealand", flag: "🇳🇿", code: "NZ" },
  IE: { name: "Ireland", flag: "🇮🇪", code: "IE" },
  KR: { name: "South Korea", flag: "🇰🇷", code: "KR" },
  PK: { name: "Pakistan", flag: "🇵🇰", code: "PK" },
  BD: { name: "Bangladesh", flag: "🇧🇩", code: "BD" },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

export const getCountryList = () =>
  Object.entries(COUNTRIES).map(([code, data]) => ({
    ...data,
  }));

export const getCountryName = (code: string): string => {
  const country = COUNTRIES[code as CountryCode];
  return country ? country.name : code;
};

export const getCountryFlag = (code: string): string => {
  const country = COUNTRIES[code as CountryCode];
  return country?.flag || "🌍";
};
