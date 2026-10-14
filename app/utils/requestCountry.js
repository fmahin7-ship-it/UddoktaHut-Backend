import geoip from "geoip-country";
import { isMarket, marketFromCountry } from "../constants/markets.js";

/** ISO country of the caller's IP, or null for private/unknown IPs (e.g. localhost). */
const lookupRequestCountry = (req) => {
  const ip = (req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  return geoip.lookup(ip)?.country ?? null;
};

/**
 * A new store's country comes from where the seller signs up, not from the
 * request body, so a hand-crafted request cannot pick a cheaper market.
 * The body value is only used when the IP has no country (local development).
 */
const resolveSignupCountry = (req, requestedCountry) => {
  const ipCountry = lookupRequestCountry(req);
  if (ipCountry) return marketFromCountry(ipCountry);
  return isMarket(requestedCountry) ? requestedCountry : marketFromCountry(null);
};

export { lookupRequestCountry, resolveSignupCountry };
