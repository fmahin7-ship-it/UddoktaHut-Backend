import express from "express";
import { validate } from "../../middleware/validateMiddleware.ts";
import { planListQuerySchema } from "./plans.schema.ts";
import { listPlans } from "./plans.controller.ts";

const planRoutes = express.Router();

planRoutes.get("/", validate(planListQuerySchema, "query"), listPlans);

export { planRoutes };
