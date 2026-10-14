import express from "express";
import { validate } from "../middleware/validateMiddleware.js";
import { planListQuerySchema } from "../validations/planSchema.js";
import { listPlans } from "../controllers/planController.js";

const planRoutes = express.Router();

planRoutes.get("/", validate(planListQuerySchema, "query"), listPlans);

export { planRoutes };
