import { z } from "zod";
import {
  DEFAULT_MARKET,
  MARKET_CODES,
  type MarketCode,
} from "../../constants/markets.ts";

const marketEnum = z.enum(
  MARKET_CODES as unknown as [MarketCode, ...MarketCode[]]
);

const planListQuerySchema = z.object({
  market: z
    .string()
    .toUpperCase()
    .pipe(
      marketEnum.refine(() => true, {
        message: `Market must be one of: ${MARKET_CODES.join(", ")}`,
      })
    )
    .default(DEFAULT_MARKET),
});

export { planListQuerySchema };
