import { marketFromCountry } from "../../constants/markets.ts";
import type { AsyncRoute } from "../../types/http.ts";
import { getPublicPlans } from "./plans.service.ts";

const listPlans: AsyncRoute = async (req, res, next) => {
  try {
    const market = marketFromCountry(
      typeof req.query.market === "string" ? req.query.market : undefined
    );
    const result = await getPublicPlans(market);
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export { listPlans };
