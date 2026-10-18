import { getPublicPlans } from "./plans.service.js";

const listPlans = async (req, res, next) => {
  try {
    const result = await getPublicPlans(req.query.market);
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export { listPlans };
