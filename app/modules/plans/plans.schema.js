import { z } from "zod";
import { DEFAULT_MARKET, MARKET_CODES } from "../../constants/markets.js";

const planListQuerySchema = z.object({
  market: z
    .string()
    .toUpperCase()
    .pipe(z.enum(MARKET_CODES, { message: `Market must be one of: ${MARKET_CODES.join(", ")}` }))
    .default(DEFAULT_MARKET),
});

export { planListQuerySchema };
