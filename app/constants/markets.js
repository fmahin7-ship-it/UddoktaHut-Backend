/** Sales markets — must match plan_prices.market and stores.country. */
const MARKETS = Object.freeze({
  BD: Object.freeze({ code: "BD", currency: "BDT" }),
  AU: Object.freeze({ code: "AU", currency: "AUD" }),
});

const MARKET_CODES = Object.freeze(Object.keys(MARKETS));

const DEFAULT_MARKET = MARKETS.AU.code;

const isMarket = (value) => Boolean(MARKETS[value]);

/** Any country without its own market is billed in the default market. */
const marketFromCountry = (country) => {
  const code = String(country ?? "").toUpperCase();
  return isMarket(code) ? code : DEFAULT_MARKET;
};

export { MARKETS, MARKET_CODES, DEFAULT_MARKET, isMarket, marketFromCountry };
