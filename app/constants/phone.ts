import { marketFromCountry } from "./markets.ts";

/** Strip spaces, dashes, and parentheses so sellers can paste formatted numbers. */
const normalizePhone = (phone: string): string =>
  String(phone ?? "").trim().replace(/[\s\-()]/g, "");

const BD_MOBILE = /^01[0-9]{9}$/;
/** AU mobile: 04XXXXXXXX, +614XXXXXXXX, or 614XXXXXXXX */
const AU_MOBILE = /^(?:\+?61|0)4\d{8}$/;

const phoneErrorForCountry = (country: unknown): string => {
  const market = marketFromCountry(country);
  if (market === "BD") {
    return "Phone must be a valid 11-digit Bangladesh number";
  }
  return "Phone must be a valid Australian mobile number (04XXXXXXXX)";
};

const isValidPhoneForCountry = (phone: string, country: unknown): boolean => {
  const normalized = normalizePhone(phone);
  const market = marketFromCountry(country);
  if (market === "BD") return BD_MOBILE.test(normalized);
  return AU_MOBILE.test(normalized);
};

export {
  normalizePhone,
  isValidPhoneForCountry,
  phoneErrorForCountry,
};
