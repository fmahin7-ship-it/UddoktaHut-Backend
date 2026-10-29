/** Sales markets — must match plan_prices.market and stores.country. */
const MARKETS = {
  BD: { code: "BD" as const, currency: "BDT" as const },
  AU: { code: "AU" as const, currency: "AUD" as const },
} as const;

type MarketCode = keyof typeof MARKETS;

const MARKET_CODES = ["BD", "AU"] as const satisfies readonly MarketCode[];

const DEFAULT_MARKET: MarketCode = MARKETS.AU.code;

const isMarket = (value: unknown): value is MarketCode =>
  typeof value === "string" && value in MARKETS;

/** Any country without its own market is billed in the default market. */
const marketFromCountry = (country: unknown): MarketCode => {
  const code = String(country ?? "").toUpperCase();
  return isMarket(code) ? code : DEFAULT_MARKET;
};

export {
  MARKETS,
  MARKET_CODES,
  DEFAULT_MARKET,
  isMarket,
  marketFromCountry,
};
export type { MarketCode };
