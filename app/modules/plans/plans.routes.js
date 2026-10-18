import express from "express";
import { validate } from "../../middleware/validateMiddleware.js";
import { planListQuerySchema } from "./plans.schema.js";
import { listPlans } from "./plans.controller.js";

const planRoutes = express.Router();

planRoutes.get("/", validate(planListQuerySchema, "query"), listPlans);

export { planRoutes };
