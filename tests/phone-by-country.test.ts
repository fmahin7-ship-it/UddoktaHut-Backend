import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidPhoneForCountry,
  normalizePhone,
  phoneErrorForCountry,
} from "../app/constants/phone.ts";

describe("normalizePhone", () => {
  it("strips spaces and dashes", () => {
    assert.equal(normalizePhone(" 04 1234 5678 "), "0412345678");
    assert.equal(normalizePhone("017-1234-5678"), "01712345678");
  });
});

describe("isValidPhoneForCountry", () => {
  it("accepts BD mobiles for BD stores", () => {
    assert.equal(isValidPhoneForCountry("01712345678", "BD"), true);
    assert.equal(isValidPhoneForCountry("0412345678", "BD"), false);
  });

  it("accepts AU mobiles for AU stores", () => {
    assert.equal(isValidPhoneForCountry("0412345678", "AU"), true);
    assert.equal(isValidPhoneForCountry("+61412345678", "AU"), true);
    assert.equal(isValidPhoneForCountry("61412345678", "AU"), true);
    assert.equal(isValidPhoneForCountry("01712345678", "AU"), false);
  });

  it("treats unknown countries like AU", () => {
    assert.equal(isValidPhoneForCountry("0412345678", "US"), true);
    assert.equal(isValidPhoneForCountry("01712345678", "US"), false);
  });
});

describe("phoneErrorForCountry", () => {
  it("mentions Bangladesh or Australia", () => {
    assert.match(phoneErrorForCountry("BD"), /Bangladesh/i);
    assert.match(phoneErrorForCountry("AU"), /Australian/i);
  });
});
